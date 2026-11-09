#!/usr/bin/env python3
"""Execution router with optional bounded guest access. No Docker permission or POST retries."""
import argparse
import collections
from concurrent.futures import ThreadPoolExecutor
import datetime
import hashlib
import hmac
import http.client
from http.cookies import CookieError, SimpleCookie
import json
import math
import os
from pathlib import Path
import re
import signal
import sqlite3
import threading
import time
import uuid
from urllib.parse import urlsplit
from http.server import BaseHTTPRequestHandler

from executor import BoundedServer, COMPILED, FINAL, MAX_BODY, MAX_OUTPUT, RUN_SECONDS, load_runtimes, validate_submission
from execution_nodes import load_nodes
from mcp_http import MuseumProvider, readonly_token, handle as handle_mcp
from observability import STATES, PHASES

MAX_RESPONSE = 262144
JOB_STATES = FINAL | {'queued', 'running', 'compiling'}
ACTIVE_TTL, FINAL_TTL = 420, 300
GUEST_IDLE_SECONDS = 300
BUSY_MESSAGE = '当前访问比较多，请稍后重试。'
Identity = collections.namedtuple('Identity', 'owner session guest_nonce')


class AdmissionError(OverflowError):
    def __init__(self, code='execution_busy', retry_after=5):
        self.code, self.retry_after = code, max(1, math.ceil(retry_after))
        super().__init__(BUSY_MESSAGE)


def private_token(value):
    if not isinstance(value, str) or len(value) < 32 or not all(33 <= ord(c) <= 126 for c in value):
        raise ValueError('Expected private printable ASCII token of at least 32 characters')
    return value


def metadata(row):
    return {**{k: row[k] for k in ('id', 'version', 'memoryMiB', 'source')},
            'compileSeconds': COMPILED[row['id']][3] if row['id'] in COMPILED else 0, 'runSeconds': RUN_SECONDS.get(row['id'],3)}


class UpstreamError(Exception):
    pass


class Worker:
    def __init__(self, node, runtimes, token, origin, timeout=2, health_ttl=1, require_sandbox=False):
        self.id, self.url = node['id'], urlsplit(node['url'])
        self.languages = set(node['languages'])
        self.expected = {ident: metadata(runtimes[ident]) for ident in self.languages}
        self.token, self.origin, self.timeout = private_token(token), origin, timeout
        self.health_ttl, self.lock, self.checked, self.available = health_ttl, threading.Lock(), 0, False
        self.require_sandbox = require_sandbox

    def request(self, method, path, session=None, data=None):
        # HTTPConnection performs a single request and never follows a redirect or retries a POST.
        connection = http.client.HTTPConnection(self.url.hostname, self.url.port, timeout=self.timeout)
        body = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8') if data is not None else None
        headers = {'Origin': self.origin, 'Accept': 'application/json', 'Connection': 'close'}
        if session is not None:
            headers.update(Authorization='Bearer ' + self.token)
            headers['X-Execution-Session'] = session
        if body is not None: headers['Content-Type'] = 'application/json'
        try:
            connection.request(method, path, body=body, headers=headers)
            response = connection.getresponse()
            if response.getheader('Content-Type', '').split(';')[0].strip() != 'application/json':
                raise UpstreamError('Worker protocol unavailable')
            raw = response.read(MAX_RESPONSE + 1)
            if len(raw) > MAX_RESPONSE: raise UpstreamError('Worker response limit exceeded')
            value = json.loads(raw)
            if not isinstance(value, dict): raise UpstreamError('Invalid worker response')
            return response.status, value
        except (OSError, ValueError, http.client.HTTPException):
            raise UpstreamError('Worker connection unavailable') from None
        finally: connection.close()

    def health(self, force=False):
        with self.lock:
            now = time.monotonic()
            if not force and self.checked and now - self.checked < self.health_ttl: return self.available
            self.available = False
            try:
                status, data = self.request('GET', '/api/runtimes')
                rows = data.get('runtimes')
                if (status == 200 and data.get('available') is True and data.get('private') is True and
                        (not self.require_sandbox or data.get('sandbox') == {'runtime': 'runsc'}) and
                        isinstance(rows, list) and len(rows) == len(self.expected) and
                        all(isinstance(r, dict) and isinstance(r.get('id'), str) and
                            set(r) == set(self.expected.get(r['id'], {})) and r == self.expected.get(r['id']) and
                            all(type(r[k]) is type(self.expected[r['id']][k]) for k in r) for r in rows) and
                        len({r['id'] for r in rows}) == len(rows) and
                        data.get('limits') == {'seconds': max(r['runSeconds'] for r in self.expected.values()), 'outputBytes': MAX_OUTPUT, 'concurrency': 1, 'network': False}):
                    self.available = True
            except (UpstreamError, TypeError, ValueError, KeyError): pass
            self.checked = time.monotonic()
            return self.available


class Routes:
    """Short-lived node/owner routing only. No source, input, output, session or tokens."""
    def __init__(self, filename=None):
        if filename:
            path = Path(filename)
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            descriptor = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
            os.close(descriptor); os.chmod(path, 0o600)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(filename or ':memory:', check_same_thread=False, timeout=2)
        self.db.execute('PRAGMA journal_mode=WAL'); self.db.execute('PRAGMA secure_delete=ON')
        self.db.execute('CREATE TABLE IF NOT EXISTS routes (reservation TEXT PRIMARY KEY, owner TEXT NOT NULL, node TEXT NOT NULL, language TEXT NOT NULL, job TEXT UNIQUE, state TEXT NOT NULL, expires REAL NOT NULL, admission REAL NOT NULL)')
        self.db.execute('CREATE TABLE IF NOT EXISTS requests (owner TEXT NOT NULL, at REAL NOT NULL)')
        self.db.execute('CREATE TABLE IF NOT EXISTS guest_leases (owner TEXT PRIMARY KEY, expires REAL NOT NULL)')
        self.db.commit()
        self.closed = threading.Event()
        self.cleaner = threading.Thread(target=self.clean, daemon=True); self.cleaner.start()

    def prune(self, now):
        self.db.execute('DELETE FROM routes WHERE expires <= ?', (now,))
        self.db.execute('DELETE FROM requests WHERE at <= ?', (now - 60,))
        self.db.execute('DELETE FROM guest_leases WHERE expires <= ?', (now,))

    def clean(self):
        while not self.closed.wait(30):
            with self.lock, self.db: self.prune(time.time())

    def reserve(self, owner, node, language, capacity, guest_limit=0):
        now = time.time(); ident = uuid.uuid4().hex; fresh_guest = False
        with self.lock, self.db:
            self.db.execute('BEGIN IMMEDIATE'); self.prune(now)
            total, owned = self.db.execute('SELECT count(*),coalesce(sum(owner=?),0) FROM requests', (owner,)).fetchone()
            active, retained = self.db.execute("SELECT coalesce(sum(admission > ? AND state NOT IN (" + ','.join('?' for _ in FINAL) + ")),0),count(*) FROM routes", (now, *FINAL)).fetchone()
            if total >= 30 or owned >= 10 or active >= capacity or retained >= 100: raise AdmissionError()
            if guest_limit:
                in_flight = self.db.execute('SELECT count(*) FROM routes WHERE owner=? AND admission>? AND state NOT IN (' + ','.join('?' for _ in FINAL) + ')', (owner, now, *FINAL)).fetchone()[0]
                if in_flight: raise AdmissionError('guest_task_active')
                lease = self.db.execute('SELECT expires FROM guest_leases WHERE owner=?', (owner,)).fetchone()
                if lease is None:
                    count, earliest = self.db.execute('SELECT count(*),min(expires) FROM guest_leases').fetchone()
                    if count >= guest_limit: raise AdmissionError('guest_capacity', earliest - now)
                    fresh_guest = True
                self.db.execute('INSERT INTO guest_leases VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET expires=excluded.expires', (owner, now + GUEST_IDLE_SECONDS))
            self.db.execute('INSERT INTO requests VALUES (?,?)', (owner, now))
            self.db.execute('INSERT INTO routes VALUES (?,?,?,?,NULL,?,?,?)', (ident, owner, node, language, 'dispatching', now + ACTIVE_TTL, now + 120))
        return ident, fresh_guest

    def guest_active(self, owner, touch=False):
        now = time.time()
        with self.lock, self.db:
            if touch:
                return bool(self.db.execute('UPDATE guest_leases SET expires=? WHERE owner=? AND expires>?', (now + GUEST_IDLE_SECONDS, owner, now)).rowcount)
            return self.db.execute('SELECT 1 FROM guest_leases WHERE owner=? AND expires>?', (owner, now)).fetchone() is not None

    def bind(self, reservation, job):
        with self.lock, self.db:
            self.db.execute('UPDATE routes SET job=?,state=? WHERE reservation=?', (job['id'], job['state'], reservation))
            if job['state'] in FINAL:
                self.db.execute('UPDATE routes SET expires=? WHERE reservation=?', (time.time() + FINAL_TTL, reservation))

    def abandon(self, reservation, certain=False, fresh_guest_owner=None):
        with self.lock, self.db:
            if certain:
                self.db.execute('DELETE FROM routes WHERE reservation=?', (reservation,))
                if fresh_guest_owner is not None:
                    self.db.execute('DELETE FROM guest_leases WHERE owner=?', (fresh_guest_owner,))
            else: self.db.execute("UPDATE routes SET state='unknown',expires=? WHERE reservation=?", (time.time() + 120, reservation))

    def lookup(self, ident, owner):
        with self.lock, self.db:
            self.prune(time.time())
            row = self.db.execute('SELECT node,language,state FROM routes WHERE job=? AND owner=?', (ident, owner)).fetchone()
            return row

    def update(self, ident, job):
        with self.lock, self.db:
            if job['state'] in FINAL:
                self.db.execute('UPDATE routes SET expires=? WHERE job=? AND state NOT IN (' + ','.join('?' for _ in FINAL) + ')', (time.time() + FINAL_TTL, ident, *FINAL))
            self.db.execute('UPDATE routes SET state=? WHERE job=?', (job['state'], ident))

    def close(self):
        self.closed.set(); self.cleaner.join(timeout=2)
        with self.lock: self.db.close()


def public_job(data, language, ident=None):
    if (not isinstance(data, dict) or not isinstance(data.get('id'), str) or not re.fullmatch('[a-f0-9]{32}', data['id']) or
            ident is not None and data['id'] != ident or data.get('language') != language or
            not isinstance(data.get('state'), str) or data['state'] not in JOB_STATES):
        raise UpstreamError('Invalid worker job')
    allowed = {'id', 'language', 'state', 'phase', 'stdout', 'stderr', 'exitCode', 'elapsedMs', 'queueMs', 'compileMs', 'runMs', 'compilerStdout', 'compilerStderr', 'runtimeVersion'}
    result = {k: v for k, v in data.items() if k in allowed}
    output_size = 0
    for field in ('stdout', 'stderr', 'compilerStdout', 'compilerStderr'):
        if field in result:
            if not isinstance(result[field], str): raise UpstreamError('Invalid worker output')
            try: output_size += len(result[field].encode('utf-8'))
            except UnicodeError: raise UpstreamError('Invalid worker UTF-8 output') from None
    if output_size > MAX_OUTPUT: raise UpstreamError('Invalid worker output limit')
    for field in ('elapsedMs', 'queueMs', 'compileMs', 'runMs'):
        if field in result and (type(result[field]) is not int or not 0 <= result[field] <= 3600000): raise UpstreamError('Invalid worker timing')
    if 'exitCode' in result and result['exitCode'] is not None and (type(result['exitCode']) is not int or not -255 <= result['exitCode'] <= 255): raise UpstreamError('Invalid exit code')
    if 'phase' in result and (not isinstance(result['phase'], str) or result['phase'] not in {'queued', 'compiling', 'running'}): raise UpstreamError('Invalid worker phase')
    if 'runtimeVersion' in result and (not isinstance(result['runtimeVersion'], str) or len(result['runtimeVersion']) > 256): raise UpstreamError('Invalid worker version')
    return result


def combined_metrics(snapshots, complete):
    states = {state: 0 for state in sorted(STATES)}; languages, timing = {}, {p: [0, 0] for p in PHASES}
    starts, persistent, missed = [], True, 0
    for value in snapshots:
        if not isinstance(value, dict): raise UpstreamError('Invalid worker metrics')
        def count(n): return type(n) is int and 0 <= n <= 10**12
        if (not isinstance(value.get('startedAt'), str) or len(value['startedAt']) > 64 or
                type(value.get('persistent')) is not bool or not count(value.get('missedRecordsSinceRestart')) or
                not count(value.get('total')) or not isinstance(value.get('states'), dict) or
                set(value['states']) != STATES or not all(count(n) for n in value['states'].values()) or
                sum(value['states'].values()) != value['total'] or not isinstance(value.get('languages'), dict) or
                len(value['languages']) > 200 or not isinstance(value.get('timings'), dict) or set(value['timings']) != set(PHASES)):
            raise UpstreamError('Invalid worker metrics')
        try:
            if datetime.datetime.fromisoformat(value['startedAt']).tzinfo is None: raise ValueError('Missing timezone')
        except ValueError: raise UpstreamError('Invalid metrics start time') from None
        starts.append(value['startedAt']); persistent &= value['persistent'] is True
        missed += value['missedRecordsSinceRestart']
        for state in states: states[state] += value['states'].get(state, 0)
        for language, row in value['languages'].items():
            if (not isinstance(language, str) or not re.fullmatch('[a-z][a-z0-9.-]*', language) or not isinstance(row, dict) or
                    not count(row.get('total')) or not isinstance(row.get('states'), dict) or
                    not set(row['states']) <= STATES or not all(count(n) for n in row['states'].values()) or
                    sum(row['states'].values()) != row['total']): raise UpstreamError('Invalid language metrics')
            group = languages.setdefault(language, {'total': 0, 'states': {}})
            group['total'] += row['total']
            for state, state_count in row['states'].items(): group['states'][state] = group['states'].get(state, 0) + state_count
        if sum(row['total'] for row in value['languages'].values()) != value['total']:
            raise UpstreamError('Language and global metrics totals differ')
        for phase in PHASES:
            row = value['timings'][phase]
            if not isinstance(row, dict): raise UpstreamError('Invalid worker timing metrics')
            n, mean = row['samples'], row['meanMs']
            if (not count(n) or n > value['total'] or n == 0 and mean is not None or
                    n and (type(mean) not in (int, float) or not math.isfinite(mean) or not 0 <= mean <= 3600000)):
                raise UpstreamError('Invalid worker timing metrics')
            timing[phase][0] += (mean or 0) * n; timing[phase][1] += n
    return {'startedAt': min(starts) if starts else datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'persistent': persistent and bool(snapshots), 'missedRecordsSinceRestart': missed,
            'total': sum(states.values()), 'states': states, 'languages': languages,
            'timings': {p: {'samples': n, 'meanMs': round(total / n, 1) if n else None} for p, (total, n) in timing.items()},
            'partial': not complete, 'scope': 'Sum of reachable workers; partial while a node is unavailable. Rounded timing means weighted by sample counts. No source, input, output or credentials stored by gateway.'}


class Gateway:
    def __init__(self, nodes, runtimes, token, node_tokens, origin, routes_file=None, timeout=2, health_ttl=1, guest_sessions=0):
        if type(guest_sessions) is not int or guest_sessions not in (0, 5): raise ValueError('Guest sessions must be disabled or limited to five')
        parsed_origin = urlsplit(origin)
        if guest_sessions and (parsed_origin.scheme != 'https' and not (parsed_origin.scheme == 'http' and parsed_origin.hostname in ('127.0.0.1', '::1', 'localhost'))):
            raise ValueError('Guest access requires HTTPS except for local development')
        self.guest_sessions = guest_sessions
        self.guest_cookie_name = '__Host-museum-execution' if parsed_origin.scheme == 'https' else 'museum-execution'
        self.guest_cookie_secure = parsed_origin.scheme == 'https'
        self.token, self.origin, self.routes = private_token(token), origin, Routes(routes_file)
        self.runtimes = {k: v for k, v in runtimes.items() if any(k in n['languages'] for n in nodes.values())}
        try:
            self.workers = {k: Worker(n, runtimes, node_tokens[n['tokenEnv']], origin, timeout, health_ttl, bool(guest_sessions)) for k, n in nodes.items()}
            if len({self.token, *(w.token for w in self.workers.values())}) != len(self.workers) + 1: raise ValueError('Public and worker tokens must be distinct')
        except Exception:
            self.routes.close(); raise
        self.placement = {language: k for k, n in nodes.items() for language in n['languages']}
        self.started, self.started_at = time.monotonic(), datetime.datetime.now(datetime.timezone.utc).isoformat()

    def guest_digest(self, purpose, nonce):
        return hmac.new(self.token.encode(), ('guest-' + purpose + ':' + nonce).encode(), hashlib.sha256).hexdigest()

    def guest_identity(self, cookie, create=False):
        """Authenticate only server-issued cookies; browser session headers never select a guest owner."""
        if len(cookie) > 8192: raise ValueError('Invalid guest cookie')
        occurrences = sum(part.split('=', 1)[0].strip() == self.guest_cookie_name for part in cookie.split(';'))
        if occurrences > 1: raise ValueError('Duplicate guest cookie')
        parsed = SimpleCookie()
        try: parsed.load(cookie)
        except CookieError: raise ValueError('Invalid guest cookie') from None
        morsel = parsed.get(self.guest_cookie_name)
        if morsel is None:
            if occurrences: raise ValueError('Invalid guest cookie')
            if not create: return None
            nonce = uuid.uuid4().hex
        else:
            value = morsel.value
            if not re.fullmatch('[a-f0-9]{32}\\.[a-f0-9]{64}', value): raise ValueError('Invalid guest cookie')
            nonce, signature = value.split('.')
            if not hmac.compare_digest(signature, self.guest_digest('cookie', nonce)): raise ValueError('Invalid guest cookie')
        return Identity(self.guest_digest('owner', nonce), self.guest_digest('worker', nonce)[:32], nonce)

    def guest_headers(self, identity):
        if identity.guest_nonce is None: return {}
        nonce = identity.guest_nonce
        return {'Set-Cookie': self.guest_cookie_name + '=' + nonce + '.' + self.guest_digest('cookie', nonce) +
                '; Path=/; Max-Age=' + str(GUEST_IDLE_SECONDS) + '; HttpOnly; SameSite=Strict' + ('; Secure' if self.guest_cookie_secure else '')}

    def capabilities(self):
        with ThreadPoolExecutor(max_workers=len(self.workers)) as pool:
            healthy = dict(zip(self.workers, pool.map(lambda w: w.health(), self.workers.values())))
        languages = sorted(k for k in self.runtimes if healthy[self.placement[k]])
        result = {'private': not bool(self.guest_sessions), 'available': bool(languages), 'complete': all(healthy.values()),
                'runtimes': [metadata(self.runtimes[k]) for k in languages],
                'unavailableLanguages': sorted(set(self.runtimes) - set(languages)),
                'limits': {'seconds': max((RUN_SECONDS.get(k,3) for k in languages),default=3), 'outputBytes': MAX_OUTPUT, 'concurrency': sum(healthy.values()), 'network': False}}
        if self.guest_sessions:
            result['access'] = {'mode': 'guest', 'maxSessions': self.guest_sessions, 'idleSeconds': GUEST_IDLE_SECONDS}
        return result

    def submit(self, owner, session, data, guest=False):
        data = validate_submission(data, self.runtimes)
        worker = self.workers[self.placement[data['language']]]
        if not worker.health(): return 503, {'error': 'Selected language node is unavailable; code was not submitted', 'retrySafe': True}
        reservation, fresh_guest = self.routes.reserve(owner, worker.id, data['language'], 10 + len(self.workers), self.guest_sessions if guest else 0)
        try:
            status, value = worker.request('POST', '/api/executions', session, data)
            if status in {400, 401, 413, 415, 429, 503}:
                self.routes.abandon(reservation, certain=True, fresh_guest_owner=owner if fresh_guest else None)
                if status == 429: return 429, {'error': BUSY_MESSAGE, 'code': 'execution_busy', 'retryAfterSeconds': 5, 'retrySafe': True}
                return 503, {'error': 'Worker rejected submission; code was not accepted', 'retrySafe': True}
            if status != 202: raise UpstreamError('Unexpected submission response')
            job = public_job(value, data['language'])
            self.routes.bind(reservation, job)
            return 202, job
        except (UpstreamError, sqlite3.Error):
            # The worker may already have executed. Even a routing write failure
            # must retain the caller's identity and the no-retry response.
            try: self.routes.abandon(reservation)
            except sqlite3.Error: pass
            return 503, {'error': 'Submission outcome is unknown; no retry or failover was performed. Wait before submitting again.', 'submissionState': 'unknown', 'retrySafe': False}

    def job(self, ident, owner, session, cancel=False, guest=False):
        row = self.routes.lookup(ident, owner)
        if row is None: return 404, {'error': 'Job not found'}
        if guest and not self.routes.guest_active(owner, touch=True): return 401, {'error': 'Guest session expired; submit again to request a place'}
        node, language, _ = row
        if node not in self.workers: return 503, {'error': 'Original execution node is not configured'}
        try:
            status, value = self.workers[node].request('DELETE' if cancel else 'GET', '/api/executions/' + ident, session)
            if status == 404: return 404, {'error': 'Job expired or worker restarted; execution was not resubmitted'}
            if status != 200: raise UpstreamError('Worker unavailable')
            job = public_job(value, language, ident)
            self.routes.update(ident, job)
            return 200, job
        except (UpstreamError, sqlite3.Error): return 503, {'error': 'Original execution node unavailable; execution was not resubmitted'}

    def status(self, session):
        def read(worker):
            if not worker.health(): return None
            try:
                status, data = worker.request('GET', '/api/executor-status', session)
                if status != 200 or data.get('available') is not True: return None
                if any(type(data.get(k)) is not int or not 0 <= data[k] <= 100 for k in ('queue', 'active')): return None
                combined_metrics([data['metrics']], True)
                return data
            except (UpstreamError, KeyError, TypeError, ValueError): return None
        with ThreadPoolExecutor(max_workers=len(self.workers)) as pool:
            data = dict(zip(self.workers, pool.map(read, self.workers.values())))
        live = [v for v in data.values() if v is not None]
        return {'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'available': bool(live), 'complete': len(live) == len(self.workers),
                'processStartedAt': self.started_at, 'uptimeSeconds': round(time.monotonic() - self.started),
                'queue': sum(v['queue'] for v in live), 'active': sum(v['active'] for v in live),
                'nodes': [{'id': k, 'available': v is not None} for k, v in data.items()],
                'metrics': combined_metrics([v['metrics'] for v in live], len(live) == len(self.workers))}

    def close(self): self.routes.close()


def handler(gateway, museum_provider=None):
    provider, mcp_token = museum_provider or MuseumProvider(None), readonly_token(gateway.token)
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup(); self.connection.settimeout(5)
        def log_message(self, *args): pass
        def respond(self, status, value, headers=None):
            raw = b'' if value is None else json.dumps(value, ensure_ascii=True).encode()
            self.send_response(status); self.send_header('Content-Type', 'application/json'); self.send_header('Cache-Control', 'no-store'); self.send_header('Content-Length', str(len(raw)))
            if isinstance(value, dict) and type(value.get('retryAfterSeconds')) is int:
                self.send_header('Retry-After', str(value['retryAfterSeconds']))
            for k, v in (headers or {}).items(): self.send_header(k, v)
            self.end_headers()
            try: self.wfile.write(raw)
            except OSError: pass
        def identity(self, allow_guest=False, create_guest=False):
            auth, session = self.headers.get('Authorization', ''), self.headers.get('X-Execution-Session', '')
            if self.headers.get('Origin') not in (None, gateway.origin) or len(self.headers.get_all('Origin', [])) > 1: return None
            if 'Authorization' in self.headers:
                if (len(self.headers.get_all('Authorization')) != 1 or not auth.isascii() or
                        not hmac.compare_digest(auth, 'Bearer ' + gateway.token) or not re.fullmatch('[a-f0-9]{32}', session)): return None
                return Identity(hashlib.sha256((gateway.token + ':' + session).encode()).hexdigest(), session, None)
            if not allow_guest or not gateway.guest_sessions: return None
            if ((self.command in ('POST', 'DELETE') and self.headers.get('Origin') != gateway.origin) or
                    self.headers.get('Sec-Fetch-Site') == 'cross-site' or len(self.headers.get_all('Cookie', [])) > 1): return None
            try:
                identity = gateway.guest_identity(self.headers.get('Cookie', ''), create=create_guest)
                if identity and (create_guest or gateway.routes.guest_active(identity.owner)): return identity
            except (ValueError, sqlite3.Error): pass
            return None
        def do_GET(self):
            if self.path == '/mcp': return handle_mcp(self, provider, mcp_token, gateway.origin)
            if self.path == '/api/runtimes': return self.respond(200, gateway.capabilities())
            identity = self.identity(allow_guest=self.path != '/api/executor-status')
            if not identity: return self.respond(401, {'error': 'Private execution token/session required'})
            if self.path == '/api/executor-status': return self.respond(200, gateway.status(identity[1]))
            return self.read_job(identity, False)
        def read_job(self, identity, cancel):
            match = re.fullmatch('/api/executions/([a-f0-9]{32})', self.path)
            if not match: return self.respond(404, {'error': 'Job not found'})
            try: status, value = gateway.job(match[1], identity.owner, identity.session, cancel, guest=identity.guest_nonce is not None)
            except sqlite3.Error: status, value = 503, {'error': 'Routing database unavailable'}
            return self.respond(status, value, gateway.guest_headers(identity) if status == 200 else None)
        def do_DELETE(self):
            if self.path == '/mcp': return handle_mcp(self, provider, mcp_token, gateway.origin)
            identity = self.identity(allow_guest=True)
            if not identity: return self.respond(401, {'error': 'Private execution token/session required'})
            return self.read_job(identity, True)
        def do_POST(self):
            if self.path == '/mcp': return handle_mcp(self, provider, mcp_token, gateway.origin)
            if self.path != '/api/executions': return self.respond(404, {'error': 'Not found'})
            identity = self.identity(allow_guest=True, create_guest=True)
            if not identity: return self.respond(401, {'error': 'Private execution token/session required'})
            if self.headers.get('Transfer-Encoding') or self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
                return self.respond(415, {'error': 'Expected length-delimited JSON'})
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= MAX_BODY: return self.respond(413, {'error': 'Request too large'})
                body = self.rfile.read(size)
                if len(body) != size: raise ValueError('Incomplete body')
                status, value = gateway.submit(identity.owner, identity.session, json.loads(body), guest=identity.guest_nonce is not None)
                return self.respond(status, value, gateway.guest_headers(identity))
            except (ValueError, TypeError, UnicodeError): return self.respond(400, {'error': 'Invalid code/language/input'})
            except AdmissionError as error: return self.respond(429, {'error': BUSY_MESSAGE, 'code': error.code, 'retryAfterSeconds': error.retry_after, 'retrySafe': True})
            except sqlite3.Error: return self.respond(503, {'error': 'Routing database unavailable; no automatic retry'})
    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--nodes', default=str(Path(__file__).with_name('execution-nodes.json')))
    parser.add_argument('--images', default=str(Path(__file__).with_name('runtime-images.json')))
    parser.add_argument('--routes-db', required=True)
    parser.add_argument('--museum-data')
    parser.add_argument('--port', type=int, default=4181)
    parser.add_argument('--origin', default='https://codemuseum.freexlib.com')
    parser.add_argument('--guest-sessions', type=int, choices=(0, 5), default=os.environ.get('EXECUTOR_GUEST_SESSIONS', '0'), help='Opt in to five anonymous execution sessions; requires runsc workers')
    parser.add_argument('--allow-partial', action='store_true', help='Temporary previews only: allow a subset of the fixed runtime manifest')
    args = parser.parse_args()
    runtimes = load_runtimes(args.images); nodes = load_nodes(args.nodes, runtimes, not args.allow_partial)
    gateway = Gateway(nodes, runtimes, os.environ.get('EXECUTOR_TOKEN'), os.environ, args.origin, args.routes_db, guest_sessions=args.guest_sessions)
    server = BoundedServer(('127.0.0.1', args.port), handler(gateway, MuseumProvider(args.museum_data)))
    def stop(*_): threading.Thread(target=server.shutdown, daemon=True).start()
    signal.signal(signal.SIGTERM, stop); signal.signal(signal.SIGINT, stop)
    print('Execution gateway listening on 127.0.0.1:' + str(server.server_port) + (' (five guest sessions)' if args.guest_sessions else ' (private)'), flush=True)
    try: server.serve_forever(poll_interval=.1)
    finally: server.server_close(); gateway.close()


if __name__ == '__main__': main()
