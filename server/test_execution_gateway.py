"""Real loopback HTTP peers exercise the gateway's distributed protocol boundaries."""
import copy
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
import http.client
import json
from pathlib import Path
import socket
import sqlite3
import tempfile
import threading
import time
import unittest
import uuid
from unittest.mock import patch
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from executor import BoundedServer, load_runtimes
from execution_gateway import AdmissionError, Gateway, Routes, handler, metadata
from execution_nodes import load_nodes
from mcp_http import readonly_token
from observability import STATES

ORIGIN = 'https://museum.example.test'
PUBLIC_TOKEN = 'gateway-' + 'p' * 48
SESSION = 'a' * 32
OTHER_SESSION = 'c' * 32
RUNTIMES = load_runtimes(Path(__file__).with_name('runtime-images.json'))


def metrics(count, run_mean, language='python'):
    states = {state: 0 for state in STATES}
    states['completed'] = count
    return dict(startedAt='2026-11-09T00:00:00Z', persistent=True,
                missedRecordsSinceRestart=0, total=count, states=states,
                languages={language: {'total': count, 'states': {'completed': count}}} if count else {}, timings={phase: {'samples': count, 'meanMs': run_mean}
                                       for phase in ('queue', 'compile', 'run')})


class FakeWorker:
    def __init__(self, language, token):
        self.language, self.token = language, token
        self.healthy = True
        self.runtime_override = None
        self.sandbox = 'runsc'
        self.post_status = 202
        self.drop_after_accept = False
        self.delay_post = 0
        self.post_entered = threading.Event()
        self.release_post = threading.Event()
        self.oversized_job = False
        self.job_override = None
        self.rows, self.calls = {}, []
        self.snapshot = metrics(0, None)
        worker = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def send(self, status, value):
                raw = json.dumps(value, ensure_ascii=True).encode()
                self.send_response(status)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(raw)))
                self.end_headers()
                try:
                    self.wfile.write(raw)
                except OSError:
                    pass

            def identity(self):
                return (self.headers.get('Authorization') == 'Bearer ' + worker.token and
                        self.headers.get('Origin') == ORIGIN and
                        self.headers.get('X-Execution-Session'))

            def do_GET(self):
                worker.calls.append((self.command, self.path, dict(self.headers)))
                if self.path == '/api/runtimes':
                    row = metadata(RUNTIMES[worker.language])
                    if worker.runtime_override is not None:
                        row = worker.runtime_override
                    return self.send(200, {'private': True, 'available': worker.healthy,
                                          'sandbox': {'runtime': worker.sandbox},
                                          'runtimes': [row],
                                          'limits': {'seconds': 3, 'outputBytes': 32768,
                                                     'concurrency': 1, 'network': False}})
                session = self.identity()
                if not session:
                    return self.send(401, {'error': 'unauthorized'})
                if self.path == '/api/executor-status':
                    return self.send(200, dict(available=worker.healthy, queue=0, active=0,
                                               metrics=worker.snapshot))
                return self.job(session)

            def do_DELETE(self):
                worker.calls.append((self.command, self.path, dict(self.headers)))
                session = self.identity()
                if not session:
                    return self.send(401, {'error': 'unauthorized'})
                return self.job(session, True)

            def job(self, session, cancel=False):
                ident = self.path.rsplit('/', 1)[-1]
                row = worker.rows.get(ident)
                if row is None or row['session'] != session:
                    return self.send(404, {'error': 'not found'})
                value = copy.deepcopy(row['public'])
                if worker.job_override is not None:
                    value.update(worker.job_override)
                if cancel:
                    value['state'] = 'cancelled'
                    row['public']['state'] = 'cancelled'
                if worker.oversized_job:
                    value['stdout'] = '\u0001' * 32769
                return self.send(200, value)

            def do_POST(self):
                worker.calls.append((self.command, self.path, dict(self.headers)))
                session = self.identity()
                if not session:
                    return self.send(401, {'error': 'unauthorized'})
                value = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                if worker.post_status != 202:
                    return self.send(worker.post_status, {'error': 'busy'})
                ident = uuid.uuid4().hex
                result = dict(id=ident, language=value['language'], state='queued')
                worker.rows[ident] = dict(public=result, session=session, submitted=value)
                worker.post_entered.set()
                if worker.delay_post:
                    worker.release_post.wait(worker.delay_post)
                if worker.drop_after_accept:
                    self.connection.shutdown(socket.SHUT_RDWR)
                    self.connection.close()
                    return
                return self.send(202, result)

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.server.daemon_threads = True
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': .01}, daemon=True)
        self.thread.start()
        self.url = 'http://127.0.0.1:' + str(self.server.server_port)

    def count(self, method, prefix='/api/executions'):
        return sum(m == method and path.startswith(prefix) for m, path, _ in self.calls)

    def close(self):
        self.release_post.set()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)


class GatewayCase(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='museum-gateway-')
        self.route_path = Path(self.directory.name) / 'routes.sqlite'
        self.a = FakeWorker('python', 'worker-a-' + 'x' * 48)
        self.b = FakeWorker('bcpl', 'worker-b-' + 'y' * 48)
        self.nodes = {
            'xshow': dict(id='xshow', url=self.a.url, tokenEnv='EXECUTOR_NODE_XSHOW_TOKEN', languages=['python']),
            'xshow2': dict(id='xshow2', url=self.b.url, tokenEnv='EXECUTOR_NODE_XSHOW2_TOKEN', languages=['bcpl'])}
        self.tokens = {'EXECUTOR_NODE_XSHOW_TOKEN': self.a.token,
                       'EXECUTOR_NODE_XSHOW2_TOKEN': self.b.token}
        self.gateway = self.httpd = self.http_thread = None
        self.start_gateway()

    def start_gateway(self, nodes=None, provider=None, guest_sessions=0, origin=ORIGIN):
        self.gateway = Gateway(nodes or self.nodes, RUNTIMES, PUBLIC_TOKEN, self.tokens, origin,
                               str(self.route_path), timeout=.5, health_ttl=0, guest_sessions=guest_sessions)
        self.httpd = BoundedServer(('127.0.0.1', 0), handler(self.gateway, provider))
        self.http_thread = threading.Thread(target=self.httpd.serve_forever, kwargs={'poll_interval': .01}, daemon=True)
        self.http_thread.start()

    def stop_gateway(self):
        if self.httpd:
            self.httpd.shutdown()
            self.httpd.server_close()
            self.http_thread.join(timeout=2)
            self.httpd = None
        if self.gateway:
            self.gateway.close()
            self.gateway = None

    def tearDown(self):
        self.stop_gateway()
        self.a.close()
        self.b.close()
        self.directory.cleanup()

    def request(self, method, path, value=None, token=PUBLIC_TOKEN, session=SESSION, origin=ORIGIN, cookie=None, with_headers=False, fetch_site=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.httpd.server_port, timeout=3)
        headers = {'Accept': 'application/json'}
        if token is not None:
            headers['Authorization'] = 'Bearer ' + token
        if session is not None:
            headers['X-Execution-Session'] = session
        if origin is not None:
            headers['Origin'] = origin
        if cookie is not None:
            headers['Cookie'] = cookie
        if fetch_site is not None:
            headers['Sec-Fetch-Site'] = fetch_site
        raw = json.dumps(value).encode() if value is not None else None
        if raw is not None:
            headers['Content-Type'] = 'application/json'
        try:
            connection.request(method, path, raw, headers)
            response = connection.getresponse()
            data = response.read()
            result = response.status, json.loads(data) if data else None
            return (*result, dict(response.getheaders())) if with_headers else result
        finally:
            connection.close()

    def submit(self, language='python', session=SESSION):
        return self.request('POST', '/api/executions',
                            {'language': language, 'code': 'secret-source-marker', 'stdin': 'secret-input-marker'},
                            session=session)


class GatewayTests(GatewayCase):

    def test_node_inventory_is_exact_and_only_literal_loopback_endpoints_are_allowed(self):
        config = Path(self.directory.name) / 'nodes.json'
        runtimes = {key: RUNTIMES[key] for key in ('python', 'bcpl')}
        value = {'schemaVersion': 1, 'nodes': list(self.nodes.values())}
        config.write_text(json.dumps(value))
        self.assertEqual(set(load_nodes(config, runtimes)), {'xshow', 'xshow2'})
        for invalid in [
            {'schemaVersion': 1, 'nodes': [value['nodes'][0]]},
            {'schemaVersion': 1, 'nodes': [value['nodes'][0], {**value['nodes'][1], 'languages': ['python']}]},
            {'schemaVersion': 1, 'nodes': [{**value['nodes'][0], 'url': 'http://localhost:4182'}, value['nodes'][1]]},
            {'schemaVersion': 1, 'nodes': [{**value['nodes'][0], 'url': 'http://127.0.0.1:4182/path'}, value['nodes'][1]]},
            {'schemaVersion': 1, 'nodes': [{**value['nodes'][0], 'url': 'http://u:p@127.0.0.1:4182'}, value['nodes'][1]]},
        ]:
            with self.subTest(invalid=invalid):
                config.write_text(json.dumps(invalid))
                with self.assertRaises(ValueError):
                    load_nodes(config, runtimes)

    def test_live_metadata_union_isolates_offline_and_malformed_worker(self):
        status, data = self.request('GET', '/api/runtimes', token=None, session=None)
        self.assertEqual(status, 200)
        self.assertEqual({r['id'] for r in data['runtimes']}, {'python', 'bcpl'})
        self.assertEqual(data['limits']['concurrency'], 2)
        self.b.healthy = False
        status, data = self.request('GET', '/api/runtimes', token=None, session=None)
        self.assertTrue(data['available'])
        self.assertFalse(data['complete'])
        self.assertEqual([r['id'] for r in data['runtimes']], ['python'])
        self.b.healthy = True
        self.b.runtime_override = {**metadata(RUNTIMES['bcpl']), 'id': ['bcpl']}
        status, data = self.request('GET', '/api/runtimes', token=None, session=None)
        self.assertEqual(status, 200)
        self.assertEqual([r['id'] for r in data['runtimes']], ['python'])
        self.b.runtime_override = None
        self.assertTrue(self.request('GET', '/api/runtimes')[1]['complete'])

    def test_routing_preserves_owner_and_query_cancel_stay_on_original_node_after_gateway_restart(self):
        status, job = self.submit('python')
        self.assertEqual(status, 202)
        ident = job['id']
        self.assertEqual(self.a.count('POST'), 1)
        self.assertEqual(self.b.count('POST'), 0)
        forwarded = next(headers for method, _, headers in self.a.calls if method == 'POST')
        self.assertEqual(forwarded['Authorization'], 'Bearer ' + self.a.token)
        self.assertEqual(forwarded['X-Execution-Session'], SESSION)
        before = len(self.a.calls) + len(self.b.calls)
        self.assertEqual(self.request('GET', '/api/executions/' + ident, session=OTHER_SESSION)[0], 404)
        self.assertEqual(self.request('DELETE', '/api/executions/' + ident, session=OTHER_SESSION)[0], 404)
        self.assertEqual(len(self.a.calls) + len(self.b.calls), before)
        self.stop_gateway()
        moved = copy.deepcopy(self.nodes)
        moved['xshow']['languages'], moved['xshow2']['languages'] = ['bcpl'], ['python']
        self.start_gateway(moved)
        self.assertEqual(self.request('GET', '/api/executions/' + ident)[0], 200)
        status, job = self.request('DELETE', '/api/executions/' + ident)
        self.assertEqual((status, job['state']), (200, 'cancelled'))
        self.assertEqual(self.b.count('GET') + self.b.count('DELETE'), 0)
        self.assertEqual(self.a.count('POST'), 1)

    def test_accepted_then_disconnected_submission_is_not_retried_or_failed_over_and_stores_no_payload(self):
        self.b.drop_after_accept = True
        status, error = self.submit('bcpl')
        self.assertEqual(status, 503)
        self.assertFalse(error['retrySafe'])
        self.assertEqual(error['submissionState'], 'unknown')
        self.assertEqual(self.b.count('POST'), 1)
        self.assertEqual(self.a.count('POST'), 0)
        self.stop_gateway()
        with closing(sqlite3.connect(self.route_path)) as db:
            rows = db.execute('SELECT * FROM routes').fetchall()
            self.assertEqual(len(rows), 1)
            self.assertIn('unknown', rows[0])
        raw = b''.join(path.read_bytes() for path in Path(self.directory.name).glob('routes.sqlite*'))
        for secret in ('secret-source-marker', 'secret-input-marker', PUBLIC_TOKEN, self.a.token, self.b.token, SESSION):
            self.assertNotIn(secret.encode(), raw)

    def test_slow_node_post_does_not_hold_routing_database_or_block_healthy_node(self):
        self.b.delay_post = 2
        result = []
        thread = threading.Thread(target=lambda: result.append(self.submit('bcpl')))
        thread.start()
        self.assertTrue(self.b.post_entered.wait(1))
        started = time.monotonic()
        status, _ = self.submit('python', OTHER_SESSION)
        self.assertEqual(status, 202)
        self.assertLess(time.monotonic() - started, .4)
        self.b.release_post.set()
        thread.join(timeout=3)
        self.assertEqual(len(result), 1)

    def test_auth_origin_and_readonly_mcp_token_are_separate(self):
        for values in [dict(token=None), dict(token='wrong'), dict(session='bad'), dict(origin='https://attacker.example')]:
            status, _ = self.request('POST', '/api/executions', {'language': 'python', 'code': 'x'}, **values)
            self.assertEqual(status, 401)
        self.assertEqual(self.a.count('POST') + self.b.count('POST'), 0)
        status, _ = self.request('POST', '/api/executions', {'language': 'python', 'code': 'x'}, token=readonly_token(PUBLIC_TOKEN))
        self.assertEqual(status, 401)

        class Museum:
            def call(self, name, arguments):
                if name == 'get_execution_capabilities':
                    return {'configured': {'languages': ['python', 'bcpl']}, 'liveAvailabilityChecked': False}
                raise ValueError('Unknown read-only tool')

        class Provider:
            def get(self):
                return Museum()

        self.stop_gateway()
        self.start_gateway(provider=Provider())
        rpc = {'jsonrpc': '2.0', 'id': 1, 'method': 'tools/list'}
        self.assertEqual(self.request('POST', '/mcp', rpc)[0], 401)
        status, response = self.request('POST', '/mcp', rpc, token=readonly_token(PUBLIC_TOKEN))
        self.assertEqual(status, 200)
        self.assertTrue(all(tool['annotations']['readOnlyHint'] for tool in response['result']['tools']))
        rpc.update(method='tools/call', params={'name': 'get_execution_capabilities', 'arguments': {}})
        status, response = self.request('POST', '/mcp', rpc, token=readonly_token(PUBLIC_TOKEN))
        capability = json.loads(response['result']['content'][0]['text'])
        self.assertFalse(capability['liveAvailabilityChecked'])
        self.assertEqual(self.a.count('POST') + self.b.count('POST'), 0)

    def test_shared_owner_quota_cannot_be_doubled_by_using_both_nodes(self):
        for index in range(10):
            status, _ = self.submit('python' if index % 2 else 'bcpl')
            self.assertEqual(status, 202)
        self.assertEqual(self.submit('python')[0], 429)
        self.assertEqual(self.submit('bcpl')[0], 429)
        self.assertEqual(self.a.count('POST') + self.b.count('POST'), 10)

    def test_unpolled_completed_job_remains_routable_during_worker_result_retention(self):
        submitted_at = time.time()
        status, job = self.submit('python')
        self.assertEqual(status, 202)
        self.a.rows[job['id']]['public'].update(state='completed', stdout='42\n', exitCode=0)
        # Workers retain terminal results for 300 seconds. A client returning after
        # two minutes must not lose its route merely because it did not poll.
        with patch('execution_gateway.time.time', return_value=submitted_at + 121):
            status, result = self.request('GET', '/api/executions/' + job['id'])
        self.assertEqual(status, 200)
        self.assertEqual(result['stdout'], '42\n')

    def test_global_request_quota_is_shared_across_nodes_and_sessions(self):
        for index in range(30):
            language = 'python' if index % 2 else 'bcpl'
            session = str(index // 10) * 32
            status, job = self.submit(language, session)
            self.assertEqual(status, 202)
            worker = self.a if language == 'python' else self.b
            worker.rows[job['id']]['public'].update(state='completed', stdout='42\n', exitCode=0)
            self.assertEqual(self.request('GET', '/api/executions/' + job['id'], session=session)[0], 200)
        self.assertEqual(self.submit('bcpl', '3' * 32)[0], 429)
        self.assertEqual(self.a.count('POST') + self.b.count('POST'), 30)

    def test_output_limit_and_worker_restart_do_not_trigger_another_execution(self):
        status, job = self.submit('python')
        self.assertEqual(status, 202)
        self.a.oversized_job = True
        self.assertEqual(self.request('GET', '/api/executions/' + job['id'])[0], 503)
        self.a.oversized_job = False
        self.a.rows.clear()
        self.assertEqual(self.request('GET', '/api/executions/' + job['id'])[0], 404)
        self.assertEqual(self.a.count('POST'), 1)
        self.assertEqual(self.b.count('POST'), 0)

    def test_malformed_worker_fields_fail_closed_and_valid_json_expanded_output_is_preserved(self):
        status, job = self.submit('python')
        self.assertEqual(status, 202)
        ident = job['id']
        self.a.rows[ident]['public'].update(state='completed', stdout='\x01' * 32768, exitCode=0)
        status, value = self.request('GET', '/api/executions/' + ident)
        self.assertEqual(status, 200)
        self.assertEqual(value['stdout'], '\x01' * 32768)
        for override in [{'state': []}, {'phase': []}, {'runtimeVersion': []},
                         {'stdout': '\ud800'}, {'compileMs': True}, {'exitCode': '0'},
                         {'language': 'bcpl'}]:
            with self.subTest(override=override):
                self.a.job_override = override
                self.assertEqual(self.request('GET', '/api/executions/' + ident)[0], 503)
        self.assertEqual(self.a.count('POST'), 1)
        self.assertEqual(self.b.count('POST'), 0)

    def test_metrics_are_weighted_and_marked_partial_on_node_loss(self):
        self.a.snapshot = metrics(1, 100)
        self.b.snapshot = metrics(3, 300, 'bcpl')
        status, data = self.request('GET', '/api/executor-status')
        self.assertEqual(status, 200)
        self.assertEqual(data['metrics']['total'], 4)
        self.assertEqual(data['metrics']['timings']['run'], {'samples': 4, 'meanMs': 250})
        self.assertFalse(data['metrics']['partial'])
        self.b.healthy = False
        status, data = self.request('GET', '/api/executor-status')
        self.assertEqual(status, 200)
        self.assertEqual(data['metrics']['total'], 1)
        self.assertTrue(data['metrics']['partial'])
        self.assertTrue(data['available'])
        self.assertFalse(data['complete'])


class GuestGatewayTests(GatewayCase):
    def start_gateway(self, nodes=None, provider=None, guest_sessions=5, origin=ORIGIN):
        super().start_gateway(nodes, provider, guest_sessions, origin)

    def guest_request(self, method, path, value=None, cookie=None, **kwargs):
        return self.request(method, path, value, token=None, session=None, cookie=cookie, with_headers=True, **kwargs)

    def guest_submit(self, cookie=None, language='python', **kwargs):
        return self.guest_request('POST', '/api/executions', {'language': language, 'code': 'guest-source-marker', 'stdin': 'guest-input-marker'}, cookie, **kwargs)

    def cookie(self, headers):
        return headers['Set-Cookie'].split(';', 1)[0]

    def test_guest_capability_is_explicit_and_only_runsc_workers_are_eligible(self):
        status, value, headers = self.guest_request('GET', '/api/runtimes')
        self.assertEqual(status, 200)
        self.assertFalse(value['private'])
        self.assertEqual(value['access'], {'mode': 'guest', 'maxSessions': 5, 'idleSeconds': 300})
        self.assertEqual(value['limits']['concurrency'], 2)
        self.assertNotIn('Set-Cookie', headers)
        self.a.sandbox = 'runc'
        self.b.sandbox = None
        status, value, _ = self.guest_request('GET', '/api/runtimes')
        self.assertFalse(value['available'])
        self.assertEqual(value['runtimes'], [])
        self.assertEqual(self.guest_submit()[0], 503)
        self.assertEqual(self.a.count('POST') + self.b.count('POST'), 0)
        self.assertEqual(self.gateway.routes.db.execute('SELECT count(*) FROM guest_leases').fetchone()[0], 0)

    def test_default_private_mode_and_local_cookie_transport_remain_explicit(self):
        self.stop_gateway()
        self.start_gateway(guest_sessions=0)
        status, value, _ = self.guest_request('GET', '/api/runtimes')
        self.assertTrue(value['private'])
        self.assertNotIn('access', value)
        self.assertEqual(self.guest_submit()[0], 401)
        self.assertEqual(self.submit()[0], 202)
        self.stop_gateway()
        self.start_gateway(origin='http://127.0.0.1:4173')
        identity = self.gateway.guest_identity('', create=True)
        header = self.gateway.guest_headers(identity)['Set-Cookie']
        self.assertNotIn('; Secure', header)
        self.assertTrue(header.startswith('museum-execution='))
        with self.assertRaises(ValueError):
            Gateway(self.nodes, RUNTIMES, PUBLIC_TOKEN, self.tokens, 'http://museum.example.test', guest_sessions=5)

    def test_parallel_admission_is_five_sessions_and_full_capacity_keeps_existing_jobs_accessible(self):
        with ThreadPoolExecutor(max_workers=6) as pool:
            responses = list(pool.map(lambda _: self.guest_submit(), range(6)))
        self.assertEqual(sorted(status for status, _, _ in responses), [202] * 5 + [429])
        accepted = [(job, self.cookie(headers)) for status, job, headers in responses if status == 202]
        self.assertEqual(len({cookie for _, cookie in accepted}), 5)
        status, value, headers = next(row for row in responses if row[0] == 429)
        self.assertEqual(value['error'], '当前访问比较多，请稍后重试。')
        self.assertEqual(value['code'], 'guest_capacity')
        self.assertEqual(int(headers['Retry-After']), value['retryAfterSeconds'])
        job, cookie = accepted[0]
        for action in ('GET', 'DELETE'):
            self.assertEqual(self.guest_request(action, '/api/executions/' + job['id'], cookie=cookie)[0], 200)
        self.assertEqual(self.a.count('POST'), 5)
        self.assertEqual(self.gateway.routes.db.execute('SELECT count(*) FROM guest_leases').fetchone()[0], 5)

    def test_capacity_is_atomic_across_independent_sqlite_connections(self):
        other = Routes(self.route_path)
        def reserve(index):
            try:
                (self.gateway.routes if index % 2 else other).reserve('owner-' + str(index), 'xshow', 'python', 100, guest_limit=5)
                return True
            except AdmissionError as error:
                self.assertEqual(error.code, 'guest_capacity')
                return False
        try:
            with ThreadPoolExecutor(max_workers=8) as pool:
                admitted = list(pool.map(reserve, range(20)))
            self.assertEqual(sum(admitted), 5)
        finally:
            other.close()

    def test_signed_cookie_controls_ownership_and_worker_session_not_browser_headers(self):
        status, job, headers = self.guest_submit()
        self.assertEqual(status, 202)
        cookie = self.cookie(headers)
        self.assertTrue(cookie.startswith('__Host-museum-execution='))
        for flag in ('HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=300'):
            self.assertIn(flag, headers['Set-Cookie'])
        path = '/api/executions/' + job['id']
        status, value, _ = self.request('POST', '/api/executions', {'language': 'bcpl', 'code': 'x'}, token=None,
                                        session=OTHER_SESSION, cookie=cookie, with_headers=True)
        self.assertEqual((status, value['code']), (429, 'guest_task_active'))
        self.assertEqual(self.request('GET', path, token=None, session=OTHER_SESSION, cookie=cookie)[0], 200)
        _, other_job, other_headers = self.guest_submit(language='bcpl')
        other_cookie = self.cookie(other_headers)
        before = self.a.count('GET') + self.a.count('DELETE')
        for action in ('GET', 'DELETE'):
            self.assertEqual(self.guest_request(action, path, cookie=other_cookie)[0], 404)
        self.assertEqual(self.a.count('GET') + self.a.count('DELETE'), before)
        self.assertNotEqual(job['id'], other_job['id'])
        forwarded = [headers for method, _, headers in self.a.calls if method in ('POST', 'GET') and 'Authorization' in headers]
        self.assertEqual(len({h['X-Execution-Session'] for h in forwarded}), 1)
        self.assertNotIn(forwarded[0]['X-Execution-Session'], (SESSION, OTHER_SESSION))
        self.assertTrue(all(h['Authorization'] == 'Bearer ' + self.a.token and 'Cookie' not in h for h in forwarded))

    def test_tampered_cookie_wrong_authorization_and_cross_origin_never_downgrade(self):
        _, job, headers = self.guest_submit()
        cookie = self.cookie(headers)
        tampered = cookie[:-1] + ('0' if cookie[-1] != '0' else '1')
        self.assertEqual(self.guest_submit(cookie=tampered)[0], 401)
        self.assertEqual(self.guest_submit(cookie=self.gateway.guest_cookie_name + '="unterminated')[0], 401)
        self.assertEqual(self.guest_submit(cookie=cookie + '; ' + cookie)[0], 401)
        self.assertEqual(self.guest_submit(cookie=cookie, origin=None)[0], 401)
        self.assertEqual(self.guest_submit(cookie=cookie, origin='https://attacker.example')[0], 401)
        self.assertEqual(self.guest_submit(cookie=cookie, fetch_site='cross-site')[0], 401)
        self.assertEqual(self.request('POST', '/api/executions', {'language': 'python', 'code': 'x'}, token='wrong', cookie=cookie)[0], 401)
        self.assertEqual(self.guest_request('GET', '/api/executions/' + job['id'], cookie=tampered)[0], 401)
        for path in ('/api/executor-status', '/mcp'):
            self.assertEqual(self.guest_request('GET', path, cookie=cookie)[0], 401)
        self.assertEqual(self.a.count('POST'), 1)
        self.assertEqual(self.request('GET', '/api/executor-status')[0], 200)

    def test_same_guest_cannot_race_two_nodes_to_create_multiple_in_flight_jobs(self):
        _, job, headers = self.guest_submit()
        cookie = self.cookie(headers)
        self.assertEqual(self.guest_request('DELETE', '/api/executions/' + job['id'], cookie=cookie)[0], 200)
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda language: self.guest_submit(cookie, language), ('python', 'bcpl')))
        self.assertEqual(sorted(row[0] for row in responses), [202, 429])
        self.assertEqual(next(row[1]['code'] for row in responses if row[0] == 429), 'guest_task_active')
        self.assertEqual(self.a.count('POST') + self.b.count('POST'), 2)

    def test_guest_quota_is_shared_across_languages_and_header_changes(self):
        cookie = None
        for index in range(10):
            language = 'python' if index % 2 else 'bcpl'
            status, job, headers = self.guest_submit(cookie, language)
            self.assertEqual(status, 202)
            cookie = self.cookie(headers)
            self.assertEqual(self.request('DELETE', '/api/executions/' + job['id'], token=None,
                                          session=f'{index:032x}', cookie=cookie)[0], 200)
        status, value, headers = self.guest_submit(cookie, 'bcpl')
        self.assertEqual((status, value['code']), (429, 'execution_busy'))
        self.assertEqual(headers['Retry-After'], str(value['retryAfterSeconds']))
        self.assertEqual(self.a.count('POST') + self.b.count('POST'), 10)

    def test_restart_keeps_capacity_and_owned_polling_renews_idle_lease(self):
        responses = [self.guest_submit() for _ in range(5)]
        _, job, headers = responses[0]
        cookie = self.cookie(headers)
        self.stop_gateway()
        self.start_gateway()
        self.assertEqual(self.guest_submit()[0], 429)
        with patch('execution_gateway.time.time', return_value=time.time() + 290):
            self.assertEqual(self.guest_request('GET', '/api/executions/' + job['id'], cookie=cookie)[0], 200)
        with patch('execution_gateway.time.time', return_value=time.time() + 301):
            self.assertEqual(self.guest_submit()[0], 202)
            self.assertEqual(self.gateway.routes.db.execute('SELECT count(*) FROM guest_leases').fetchone()[0], 2)

    def test_invalid_requests_and_cross_owner_reads_do_not_claim_or_renew_leases(self):
        status, _, headers = self.guest_request('POST', '/api/executions', {'language': 'missing', 'code': 'x'})
        self.assertEqual(status, 400)
        self.assertNotIn('Set-Cookie', headers)
        self.assertEqual(self.gateway.routes.db.execute('SELECT count(*) FROM guest_leases').fetchone()[0], 0)
        _, job, headers = self.guest_submit()
        cookie = self.cookie(headers)
        expires = self.gateway.routes.db.execute('SELECT expires FROM guest_leases').fetchone()[0]
        with patch('execution_gateway.time.time', return_value=time.time() + 100):
            self.assertEqual(self.guest_request('GET', '/api/executions/' + 'f' * 32, cookie=cookie)[0], 404)
            self.assertEqual(self.guest_request('GET', '/api/runtimes', cookie=cookie)[0], 200)
        self.assertEqual(self.gateway.routes.db.execute('SELECT expires FROM guest_leases').fetchone()[0], expires)
        with patch('execution_gateway.time.time', return_value=time.time() + 301):
            self.assertEqual(self.guest_request('GET', '/api/executions/' + job['id'], cookie=cookie)[0], 401)

    def test_unknown_submission_retains_cookie_lease_and_one_in_flight_limit_without_replay(self):
        self.b.drop_after_accept = True
        status, error, headers = self.guest_submit(language='bcpl')
        self.assertEqual(status, 503)
        self.assertFalse(error['retrySafe'])
        cookie = self.cookie(headers)
        self.assertEqual(self.guest_submit(cookie, 'python')[1]['code'], 'guest_task_active')
        self.assertEqual(self.b.count('POST'), 1)
        self.assertEqual(self.a.count('POST'), 0)
        self.stop_gateway()
        raw = b''.join(path.read_bytes() for path in Path(self.directory.name).glob('routes.sqlite*'))
        for secret in (cookie.split('=', 1)[1], PUBLIC_TOKEN, self.a.token, self.b.token, 'guest-source-marker', 'guest-input-marker'):
            self.assertNotIn(secret.encode(), raw)

    def test_routing_write_failure_after_acceptance_still_returns_guest_cookie_and_no_retry(self):
        with patch.object(self.gateway.routes, 'bind', side_effect=sqlite3.OperationalError('unavailable')), \
                patch.object(self.gateway.routes, 'abandon', side_effect=sqlite3.OperationalError('unavailable')):
            status, error, headers = self.guest_submit()
        self.assertEqual(status, 503)
        self.assertEqual(error['submissionState'], 'unknown')
        self.assertFalse(error['retrySafe'])
        cookie = self.cookie(headers)
        self.assertEqual(self.guest_submit(cookie)[1]['code'], 'guest_task_active')
        self.assertEqual(self.a.count('POST'), 1)

    def test_worker_busy_response_is_actionable_and_never_retried(self):
        self.a.post_status = 429
        status, error, headers = self.guest_submit()
        self.assertEqual(status, 429)
        self.assertEqual(error['error'], '当前访问比较多，请稍后重试。')
        self.assertEqual(headers['Retry-After'], str(error['retryAfterSeconds']))
        cookie = self.cookie(headers)
        self.a.post_status = 202
        self.assertEqual(self.guest_submit(cookie)[0], 202)
        self.assertEqual(self.a.count('POST'), 2)

    def test_definite_worker_rejections_release_new_leases_and_preserve_existing_ones(self):
        for rejection in (400, 401, 413, 415, 429, 503):
            self.a.post_status = rejection
            status, _, _ = self.guest_submit()
            self.assertEqual(status, 429 if rejection == 429 else 503)
            self.assertEqual(self.gateway.routes.db.execute('SELECT count(*) FROM guest_leases').fetchone()[0], 0)
            self.assertEqual(self.gateway.routes.db.execute('SELECT count(*) FROM routes').fetchone()[0], 0)
        self.a.post_status = 202
        _, job, headers = self.guest_submit()
        cookie = self.cookie(headers)
        self.assertEqual(self.guest_request('DELETE', '/api/executions/' + job['id'], cookie=cookie)[0], 200)
        self.a.post_status = 429
        self.assertEqual(self.guest_submit(cookie)[0], 429)
        self.assertEqual(self.gateway.routes.db.execute('SELECT count(*) FROM guest_leases').fetchone()[0], 1)
        self.assertEqual(self.guest_request('GET', '/api/executions/' + job['id'], cookie=cookie)[0], 200)


if __name__ == '__main__':
    unittest.main()
