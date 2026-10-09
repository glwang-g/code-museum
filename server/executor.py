#!/usr/bin/env python3
"""Private Docker execution prototype. No runtime downloads or shell commands."""
import argparse
import collections
import hashlib
import hmac
import json
import os
import re
import selectors
import signal
import subprocess
import sys
import threading
import time
import uuid
import datetime
from observability import Metrics
from mcp_http import MuseumProvider, readonly_token, handle as handle_mcp
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

LABEL = 'code-museum.executor=private-v1'
PREFIX = 'cm-exec-'
MAX_BODY, MAX_CODE, MAX_STDIN, MAX_OUTPUT = 98304, 65536, 16384, 32768
FINAL = {'completed', 'failed', 'compile_error', 'compile_timed_out', 'timed_out', 'cancelled', 'output_limit', 'memory_limit', 'infrastructure_error'}
COMPILED = {
    'c': ('gcc', '/usr/local/bin/gcc', 512, 10, 'main.c', ['gcc', '-std=c11', '-O0', '-Wall', '-Wextra', '/work/main.c', '-o', '/work/program'], ['/work/program']),
    'cpp': ('gcc', '/usr/local/bin/g++', 512, 10, 'main.cpp', ['g++', '-std=c++17', '-O0', '-Wall', '-Wextra', '/work/main.cpp', '-o', '/work/program'], ['/work/program']),
    'rust': ('rust', '/usr/local/cargo/bin/rustc', 768, 15, 'main.rs', ['rustc', '--edition=2021', '/work/main.rs', '-o', '/work/program'], ['/work/program']),
    'go': ('golang', '/usr/local/go/bin/go', 768, 30, 'main.go', ['go', 'build', '-o', '/work/program', '/work/main.go'], ['/work/program']),
    'java': ('eclipse-temurin', '/opt/java/openjdk/bin/javac', 768, 15, 'Museum.java', ['javac', '-J-Xmx256m', '-J-XX:ActiveProcessorCount=1', '--release', '17', '/work/Museum.java'], ['java', '-Xmx256m', '-XX:ActiveProcessorCount=1', '-cp', '/work', 'Museum'])
}
PYTHON_BOOT = "import sys,json,io,runpy; p=json.load(sys.stdin); open('/work/main.py','w').write(p['code']); sys.stdin=io.StringIO(p['stdin']); sys.argv=['/work/main.py']; runpy.run_path('/work/main.py',run_name='__main__')"
RUBY_BOOT = "require 'json'; require 'stringio'; p=JSON.parse(STDIN.read); File.write('/work/main.rb',p['code']); $stdin=StringIO.new(p['stdin']); Object.send(:remove_const,:STDIN); STDIN=$stdin; ARGV.clear; load '/work/main.rb'"


def load_runtimes(file):
    manifest = json.loads(Path(file).read_text())
    rows = manifest.get('runtimes', [])
    if manifest.get('schemaVersion') != 1 or not {'python', 'ruby'} <= {r['id'] for r in rows} or len({r['id'] for r in rows}) != len(rows):
        raise ValueError('Expected unique pinned runtime manifest')
    for r in rows:
        if r['id'] not in {'python', 'ruby', *COMPILED}: raise ValueError('Unsupported runtime')
        repository, executable, memory = COMPILED[r['id']][:3] if r['id'] in COMPILED else (r['id'], '/usr/local/bin/' + r['id'], {'python':256, 'ruby':512}[r['id']])
        if not re.fullmatch(re.escape(repository) + r'@sha256:[a-f0-9]{64}', r['image']):
            raise ValueError('Runtime must use an official image digest')
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', r['imageId']) or r['os'] != 'linux':
            raise ValueError('Invalid image identity')
        if r['executable'] != executable or r['memoryMiB'] != memory or r['architecture'] != 'amd64':
            raise ValueError('Unexpected runtime command or memory limit')
    return {r['id']: r for r in rows}


def validate_submission(data, runtimes):
    if not isinstance(data, dict) or set(data) - {'language', 'code', 'stdin'} or not {'language', 'code'} <= set(data):
        raise ValueError('Expected language, code and optional stdin')
    if not isinstance(data.get('language'), str) or data['language'] not in runtimes:
        raise ValueError('Unsupported language')
    for field, limit in [('code', MAX_CODE), ('stdin', MAX_STDIN)]:
        value = data.get(field, '')
        if not isinstance(value, str) or len(value.encode('utf-8')) > limit:
            raise ValueError(field + ' exceeds its UTF-8 byte limit')
    return {'language': data['language'], 'code': data['code'], 'stdin': data.get('stdin', '')}


class DockerRunner:
    def __init__(self, runtimes, runtime='runc', namespace='private-v1'):
        if runtime not in ('runc', 'runsc'):
            raise ValueError('Unsupported Docker runtime')
        self.runtimes, self.runtime = runtimes, runtime
        if not re.fullmatch(r'[a-z][a-z0-9-]{0,31}', namespace): raise ValueError('Invalid executor namespace')
        self.namespace = namespace
        self.label = 'code-museum.executor=' + namespace
        self.prefix = PREFIX if namespace == 'private-v1' else 'cm-' + namespace + '-'
        self.healthy = True

    def verify(self):
        info = json.loads(subprocess.check_output(['docker', 'info', '--format', '{{json .}}'], timeout=8))
        if info.get('CgroupVersion') != '2' or self.runtime not in info.get('Runtimes', {}):
            raise ValueError('Requires cgroup v2 and selected Docker runtime')
        warnings = ' '.join(info.get('Warnings') or []).lower()
        if any(s in warnings for s in ['no memory limit', 'no swap limit', 'no cpu cfs', 'no pids limit']):
            raise ValueError('Docker reports missing resource controls')
        if not any('seccomp' in s for s in info.get('SecurityOptions', [])):
            raise ValueError('Docker default seccomp must be available')
        for row in self.runtimes.values():
            image = json.loads(subprocess.check_output(['docker', 'image', 'inspect', row['image']], timeout=8))[0]
            if image['Id'] != row['imageId'] or image['Architecture'] != row['architecture']:
                raise ValueError('Pinned image identity/platform mismatch; provision images explicitly')
        self.cleanup_stale()

    def cleanup_stale(self):
        names = subprocess.check_output(['docker', 'ps', '-a', '--filter', 'label=' + self.label, '--format', '{{.Names}}'], timeout=8).decode().splitlines()
        for name in names:
            if re.fullmatch(self.prefix + r'[a-f0-9]{32}', name):
                self.remove(name)

    def remove(self, name):
        result = subprocess.run(['docker', 'rm', '--force', name], capture_output=True, timeout=8)
        # A watchdog may have removed it already; verify absence, rather than ignoring errors.
        if result.returncode:
            check = subprocess.run(['docker', 'ps', '-a', '--filter', 'name=^/' + name + '$', '--format', '{{.Names}}'], capture_output=True, timeout=8)
            if check.returncode or check.stdout.strip():
                self.healthy = False
                raise RuntimeError('Container cleanup failed; runner disabled')

    def command(self, name, language):
        row = self.runtimes[language]
        compiled = language in COMPILED
        command = ['docker', 'create', '--pull=never', '--name', name, '--label', self.label,
                '--runtime', self.runtime, '--network=none', '--read-only', '--init', '--ipc=none',
                '--user=65534:65534', '--cap-drop=ALL', '--security-opt=no-new-privileges:true',
                '--memory=' + str(row['memoryMiB']) + 'm', '--memory-swap=' + str(row['memoryMiB']) + 'm',
                '--cpus=1', '--pids-limit=' + ('128' if compiled else '32'), '--ulimit=nofile=64:64', '--ulimit=fsize=16777216:16777216',
                '--log-driver=none', '--stop-timeout=1', '--workdir=/work',
                '--tmpfs=/work:rw,' + ('exec' if compiled else 'noexec') + ',nosuid,nodev,size=' + ('128m' if compiled else '16m') + ',mode=1777',
                '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=' + ('128m' if compiled else '8m') + ',mode=1777', '-i',
                ]
        if compiled:
            command += ['--env=HOME=/work', '--env=GOCACHE=/work/cache', '--env=GOPATH=/work/go', '--env=GOPROXY=off', '--env=GOSUMDB=off', '--env=GOTOOLCHAIN=local', '--env=CGO_ENABLED=0', '--env=GOMAXPROCS=1', '--env=RUSTUP_HOME=/usr/local/rustup', '--env=CARGO_HOME=/usr/local/cargo', '--entrypoint=/bin/sleep', row['image'], '60']
        else:
            command += ['--entrypoint', row['executable'], row['image'], *(['-I', '-u', '-c', PYTHON_BOOT] if language == 'python' else ['-e', RUBY_BOOT])]
        return command

    def compiled_execute(self, job):
        """No host mounts or artifact execution: compile and run inside one leased container."""
        name = self.prefix + job['id']; row = self.runtimes[job['language']]
        _, _, _, compile_seconds, filename, compiler, program = COMPILED[job['language']]
        started = time.monotonic(); watchdog = None
        buffers = {field: bytearray() for field in ('compilerStdout', 'compilerStderr', 'stdout', 'stderr')}
        timings = {}; phase = 'compiling'; exit_code = None
        def capture(args, seconds, payload=b''):
            process = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            def write():
                try: process.stdin.write(payload); process.stdin.close()
                except (OSError, ValueError): pass
            writer = threading.Thread(target=write, daemon=True); writer.start()
            reason = None; deadline = time.monotonic() + seconds
            try:
                with selectors.DefaultSelector() as selector:
                    for field in ('stdout', 'stderr'):
                        stream = getattr(process, field); os.set_blocking(stream.fileno(), False)
                        selector.register(stream, selectors.EVENT_READ, ('compilerStdout' if field == 'stdout' else 'compilerStderr') if phase == 'compiling' else field)
                    while selector.get_map():
                        if job['cancel'].is_set(): reason = 'cancelled'; break
                        if time.monotonic() >= deadline: reason = 'compile_timed_out' if phase == 'compiling' else 'timed_out'; break
                        for selected, _ in selector.select(.05):
                            chunk = os.read(selected.fileobj.fileno(),4096)
                            if not chunk: selector.unregister(selected.fileobj); continue
                            available = MAX_OUTPUT - sum(len(b) for b in buffers.values())
                            buffers[selected.data].extend(chunk[:available])
                            if len(chunk) > available: reason = 'output_limit'; break
                        if reason: break
                if reason:
                    # Killing docker exec alone does not stop the process inside the container.
                    process.kill()
                    process.wait(timeout=3)
                    self.remove(name)
                process.wait(timeout=3)
                return reason, process.returncode
            finally:
                if process.poll() is None: process.kill(); process.wait(timeout=3); self.remove(name)
                for stream in (process.stdin,process.stdout,process.stderr):
                    try: stream.close()
                    except OSError: pass
                writer.join(timeout=1)
        try:
            watchdog = subprocess.Popen([sys.executable,str(Path(__file__).resolve()),'--namespace',self.namespace,'--lease','60','--watchdog',name],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            subprocess.run(self.command(name,job['language']),check=True,capture_output=True,timeout=8)
            subprocess.run(['docker','start',name],check=True,capture_output=True,timeout=3)
            if job['cancel'].is_set(): return {'state':'cancelled','stdout':'','stderr':'','exitCode':None}
            # Docker cp rejects a read-only rootfs even when the target is tmpfs.
            # Stream bounded source to a fixed filename as the container's non-root user.
            subprocess.run(['docker','exec','-i',name,'/bin/dd','of=/work/'+filename,'status=none'],input=job['code'].encode('utf-8'),check=True,capture_output=True,timeout=8)
            job['state'] = 'compiling'
            tick = time.monotonic(); reason, exit_code = capture(['docker','exec',name,*compiler],compile_seconds)
            timings['compileMs'] = round((time.monotonic()-tick)*1000)
            if not reason and exit_code: reason = 'compile_error'
            if not reason:
                phase = 'running'; job['state'] = phase
                tick = time.monotonic(); reason, exit_code = capture(['docker','exec','-i',name,*program],3,job['stdin'].encode('utf-8'))
                timings['runMs'] = round((time.monotonic()-tick)*1000)
                reason = reason or ('completed' if exit_code == 0 else 'failed')
            decoded = {}; remaining = MAX_OUTPUT
            for field, raw in buffers.items():
                encoded = raw.decode('utf-8',errors='replace').encode('utf-8')
                if len(encoded)>remaining: reason='output_limit'
                decoded[field] = encoded[:remaining].decode('utf-8',errors='ignore'); remaining -= len(decoded[field].encode('utf-8'))
            return {'state':reason,'phase':phase,'exitCode':exit_code if reason in ('completed','failed','compile_error') else None,**decoded,**timings,'elapsedMs':round((time.monotonic()-started)*1000),'runtimeVersion':row['version']}
        except (OSError,ValueError,subprocess.SubprocessError,RuntimeError):
            return {'state':'cancelled' if job['cancel'].is_set() else 'infrastructure_error','phase':phase,'stdout':'','stderr':'Compilation/execution infrastructure unavailable; no fallback was used.','exitCode':None}
        finally:
            try: self.remove(name)
            except (OSError,subprocess.SubprocessError,RuntimeError): self.healthy=False
            if watchdog:
                try: watchdog.stdin.write(b'done\n');watchdog.stdin.close();watchdog.wait(timeout=10)
                except (OSError,subprocess.SubprocessError): self.healthy=False

    def execute(self, job):
        if job['language'] in COMPILED: return self.compiled_execute(job)
        name = self.prefix + job['id']
        process = watchdog = None
        started = time.monotonic()
        output = {'stdout': bytearray(), 'stderr': bytearray()}
        reason = None; run_ms = None
        try:
            # Start the lease before create, covering API death during Docker setup as well.
            watchdog = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), '--namespace', self.namespace, '--watchdog', name], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            created = subprocess.run(self.command(name, job['language']), capture_output=True, timeout=8)
            if created.returncode:
                raise RuntimeError('Docker could not create the restricted environment')
            # Independent host process removes the container on API death (stdin EOF), or hard lease expiry.
            if job['cancel'].is_set():
                reason = 'cancelled'
            else:
                run_tick = time.monotonic()
                process = subprocess.Popen(['docker', 'start', '--attach', '--interactive', name], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                payload = json.dumps({'code': job['code'], 'stdin': job['stdin']}).encode()
                def send_input():
                    try:
                        process.stdin.write(payload)
                        process.stdin.close()
                    except (BrokenPipeError, OSError, ValueError):
                        pass
                writer = threading.Thread(target=send_input, daemon=True)
                writer.start()
                with selectors.DefaultSelector() as selector:
                    for field in output:
                        stream = getattr(process, field)
                        os.set_blocking(stream.fileno(), False)
                        selector.register(stream, selectors.EVENT_READ, field)
                    deadline = time.monotonic() + 3
                    while selector.get_map():
                        if job['cancel'].is_set():
                            reason = 'cancelled'; break
                        if time.monotonic() >= deadline:
                            reason = 'timed_out'; break
                        for selected, _ in selector.select(.05):
                            chunk = os.read(selected.fileobj.fileno(), 4096)
                            if not chunk:
                                selector.unregister(selected.fileobj); continue
                            available = MAX_OUTPUT - sum(len(v) for v in output.values())
                            output[selected.data].extend(chunk[:available])
                            if len(chunk) > available:
                                reason = 'output_limit'; break
                        if reason: break
                if not reason:
                    process.wait(timeout=1)
                run_ms = round((time.monotonic() - run_tick) * 1000)
            state = json.loads(subprocess.check_output(['docker', 'inspect', '--format', '{{json .State}}', name], timeout=5))
            reason = reason or ('memory_limit' if state.get('OOMKilled') else 'completed' if state.get('ExitCode') == 0 else 'failed')
            decoded = {};remaining = MAX_OUTPUT
            for field, raw in output.items():
                encoded = raw.decode('utf-8', errors='replace').encode('utf-8')
                if len(encoded) > remaining: reason = 'output_limit'
                decoded[field] = encoded[:remaining].decode('utf-8', errors='ignore')
                remaining -= len(decoded[field].encode('utf-8'))
            return {'state': reason, 'exitCode': state.get('ExitCode') if reason in ('completed', 'failed', 'memory_limit') else None,
                    **decoded, **({'runMs': run_ms} if run_ms is not None else {}),
                    'elapsedMs': round((time.monotonic() - started) * 1000), 'runtimeVersion': self.runtimes[job['language']]['version']}
        except (OSError, ValueError, subprocess.SubprocessError, RuntimeError):
            return {'state': 'cancelled' if job['cancel'].is_set() else 'infrastructure_error', 'stdout': '', 'stderr': 'Execution infrastructure unavailable; no fallback was used.', 'exitCode': None}
        finally:
            try:
                self.remove(name)
            except (OSError, subprocess.SubprocessError, RuntimeError):
                self.healthy = False
            if process:
                if process.poll() is None: process.kill()
                process.wait(timeout=3)
                for stream in (process.stdout, process.stderr): stream.close()
            if watchdog:
                try: watchdog.stdin.write(b'done\n');watchdog.stdin.close()
                except (BrokenPipeError, OSError): pass
                try: watchdog.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    self.healthy = False


class Manager:
    def __init__(self, runner, metrics=None):
        self.metrics = metrics or Metrics()
        self.started = time.monotonic()
        self.started_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.runner, self.jobs = runner, {}
        self.lock = threading.Condition()
        self.pending = collections.deque()
        self.requests = collections.deque()
        self.stopping = False
        self.worker = threading.Thread(target=self.work, daemon=True)
        self.worker.start()

    def submit(self, owner, data):
        data = validate_submission(data, self.runner.runtimes)
        with self.lock:
            now = time.monotonic()
            self.jobs = {k: v for k, v in self.jobs.items() if v['state'] not in FINAL or now - v['updated'] < 300}
            while self.requests and now - self.requests[0][0] > 60: self.requests.popleft()
            if self.stopping or not self.runner.healthy: raise RuntimeError('Runner unavailable')
            if len(self.pending) >= 10 or len(self.jobs) >= 100: raise OverflowError('Queue full')
            if len(self.requests) >= 30 or sum(o == owner for _, o in self.requests) >= 10: raise OverflowError('Request quota exceeded')
            self.requests.append((now, owner))
            job = dict(data, id=uuid.uuid4().hex, owner=owner, state='queued', updated=now, cancel=threading.Event())
            self.jobs[job['id']] = job; self.pending.append(job); self.lock.notify_all()
            return self.public(job)

    def public(self, job):
        return {k: job[k] for k in ('id', 'language', 'state', 'phase', 'stdout', 'stderr', 'exitCode', 'elapsedMs', 'queueMs', 'compileMs', 'runMs', 'compilerStdout', 'compilerStderr', 'runtimeVersion') if k in job}

    def get(self, ident, owner, cancel=False):
        with self.lock:
            job = self.jobs.get(ident)
            if not job or job['owner'] != owner or job['state'] in FINAL and time.monotonic() - job['updated'] >= 300: return None
            if cancel and job['state'] not in FINAL:
                job['cancel'].set()
                if job['state'] == 'queued':
                    job['queueMs'] = round((time.monotonic() - job['updated']) * 1000)
                    self.pending.remove(job);job['state'] = 'cancelled';self.metrics.record(job);job.pop('code', None);job.pop('stdin', None)
                job['updated'] = time.monotonic()
            return self.public(job)

    def work(self):
        while True:
            with self.lock:
                self.lock.wait_for(lambda: self.pending or self.stopping)
                if self.stopping: return
                job = self.pending.popleft()
                job['queueMs'] = round((time.monotonic() - job['updated']) * 1000)
                if not self.runner.healthy:
                    job.update(state='infrastructure_error', stderr='Runner disabled', updated=time.monotonic())
                    self.metrics.record(job);job.pop('code', None);job.pop('stdin', None);continue
                if time.monotonic() - job['updated'] > 30:
                    job.update(state='cancelled', stderr='Queue wait exceeded 30 seconds')
                    self.metrics.record(job);job.pop('code', None);job.pop('stdin', None);continue
                job['state'] = 'running'
            try: result = self.runner.execute(job)
            except Exception: result = {'state': 'infrastructure_error', 'stderr': 'Runner failed'};self.runner.healthy = False
            with self.lock:
                job.update(result, updated=time.monotonic());self.metrics.record(job);job.pop('code', None);job.pop('stdin', None)

    def status(self):
        with self.lock:
            return {'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'available':self.runner.healthy and not self.stopping,'processStartedAt':self.started_at,'uptimeSeconds':round(time.monotonic()-self.started),'queue':len(self.pending),'active':sum(j['state'] in ('compiling','running') for j in self.jobs.values()),'metrics':self.metrics.snapshot()}

    def stop(self):
        with self.lock:
            self.stopping = True
            for job in self.jobs.values():
                job['cancel'].set()
                if job['state']=='queued':
                    job.update(state='cancelled',queueMs=round((time.monotonic()-job['updated'])*1000))
                    self.metrics.record(job);job.pop('code',None);job.pop('stdin',None)
            self.pending.clear()
            self.lock.notify_all()
        self.worker.join(timeout=60)


def handler(manager, token, origin, museum_provider=None):
    museum_provider = museum_provider or MuseumProvider(None)
    mcp_token = readonly_token(token)
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup();self.connection.settimeout(5)
        def log_message(self, *args): pass
        def respond(self, status, data, headers=None):
            payload = b'' if data is None else json.dumps(data, ensure_ascii=True).encode()
            self.send_response(status);self.send_header('Content-Type', 'application/json');self.send_header('Cache-Control', 'no-store');self.send_header('Content-Length', str(len(payload)))
            for key,value in (headers or {}).items(): self.send_header(key,value)
            self.end_headers()
            try: self.wfile.write(payload)
            except (BrokenPipeError, OSError): pass
        def owner(self):
            if self.headers.get('Origin') not in (None, origin): return None
            auth = self.headers.get('Authorization', '')
            session = self.headers.get('X-Execution-Session', '')
            if not auth.isascii() or not hmac.compare_digest(auth, 'Bearer ' + token) or not re.fullmatch('[a-f0-9]{32}', session): return None
            return hashlib.sha256((token + ':' + session).encode()).hexdigest()
        def do_GET(self):
            if self.path == '/mcp': return handle_mcp(self,museum_provider,mcp_token,origin)
            if self.path == '/api/executor-status':
                if not self.owner(): return self.respond(401, {'error':'Private execution token/session required'})
                return self.respond(200, manager.status())
            if self.path == '/api/runtimes':
                return self.respond(200, {'private': True, 'available': manager.runner.healthy,
                    'runtimes': [{**{k: r[k] for k in ('id', 'version', 'memoryMiB', 'source')}, 'compileSeconds': COMPILED[r['id']][3] if r['id'] in COMPILED else 0, 'runSeconds':3} for r in manager.runner.runtimes.values()],
                    'limits': {'seconds': 3, 'outputBytes': MAX_OUTPUT, 'concurrency': 1, 'network': False}})
            return self.job(False)
        def do_DELETE(self):
            if self.path == '/mcp': return handle_mcp(self,museum_provider,mcp_token,origin)
            return self.job(True)
        def job(self, cancel):
            owner = self.owner()
            if not owner: return self.respond(401, {'error': 'Private execution token/session required'})
            match = re.fullmatch('/api/executions/([a-f0-9]{32})', self.path)
            job = manager.get(match[1], owner, cancel) if match else None
            return self.respond(200 if job else 404, job or {'error': 'Job not found'})
        def do_POST(self):
            if self.path == '/mcp': return handle_mcp(self,museum_provider,mcp_token,origin)
            if self.path != '/api/executions': return self.respond(404, {'error': 'Not found'})
            owner = self.owner()
            if not owner: return self.respond(401, {'error': 'Private execution token/session required'})
            if self.headers.get('Transfer-Encoding') or self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                return self.respond(415, {'error': 'Expected length-delimited JSON'})
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= MAX_BODY: return self.respond(413, {'error': 'Request too large'})
                body = self.rfile.read(size)
                if len(body) != size: raise ValueError('Incomplete body')
                return self.respond(202, manager.submit(owner, json.loads(body)))
            except (ValueError, TypeError, UnicodeError): return self.respond(400, {'error': 'Invalid code/language/input'})
            except OverflowError: return self.respond(429, {'error': 'Execution quota or queue limit reached'})
            except RuntimeError: return self.respond(503, {'error': 'Runner unavailable'})
    return Handler


class BoundedServer(ThreadingHTTPServer):
    daemon_threads = True
    def __init__(self, *args):
        self.slots = threading.BoundedSemaphore(16);super().__init__(*args)
    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            request.close();return
        try: super().process_request(request, client_address)
        except Exception: self.slots.release();raise
    def process_request_thread(self, *args):
        try: super().process_request_thread(*args)
        finally: self.slots.release()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--images', default=str(Path(__file__).with_name('runtime-images.json')))
    parser.add_argument('--metrics-db')
    parser.add_argument('--museum-data')
    parser.add_argument('--port', type=int, default=4181)
    parser.add_argument('--origin', default='http://127.0.0.1:4173')
    parser.add_argument('--runtime', choices=['runc', 'runsc'], default='runc')
    parser.add_argument('--watchdog')
    parser.add_argument('--namespace', default='private-v1')
    parser.add_argument('--lease', type=int, choices=[12,60], default=12)
    args = parser.parse_args()
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,31}',args.namespace): parser.error('Invalid namespace')
    prefix = PREFIX if args.namespace == 'private-v1' else 'cm-' + args.namespace + '-'
    if args.watchdog:
        if not re.fullmatch(prefix + r'[a-f0-9]{32}', args.watchdog): parser.error('Invalid container name')
        with selectors.DefaultSelector() as selector:
            selector.register(sys.stdin, selectors.EVENT_READ)
            event = selector.select(args.lease)
            clean = bool(event) and sys.stdin.buffer.readline() == b'done\n'
        # On parent death, retry through the setup budget so a late Docker create cannot leak.
        end = time.monotonic() + (0 if clean else 8)
        while True:
            subprocess.run(['docker', 'rm', '--force', args.watchdog], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=8)
            if time.monotonic() >= end: break
            time.sleep(.3)
        return
    token = os.environ.get('EXECUTOR_TOKEN', '')
    if len(token) < 32 or not token.isascii(): parser.error('Set a private ASCII EXECUTOR_TOKEN of at least 32 characters')
    import fcntl
    lock_path = '/tmp/code-museum-executor.lock' if args.namespace == 'private-v1' else '/tmp/code-museum-executor-' + args.namespace + '.lock'
    lock = os.fdopen(os.open(os.environ.get('EXECUTOR_LOCK', lock_path), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600), 'a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    runner = DockerRunner(load_runtimes(args.images), args.runtime,args.namespace);runner.verify()
    manager = Manager(runner,Metrics(args.metrics_db))
    server = BoundedServer(('127.0.0.1', args.port), handler(manager, token, args.origin,MuseumProvider(args.museum_data)))
    def shutdown(*_): threading.Thread(target=server.shutdown, daemon=True).start()
    signal.signal(signal.SIGTERM, shutdown);signal.signal(signal.SIGINT, shutdown)
    print('Private executor listening on 127.0.0.1:' + str(args.port), flush=True)
    try: server.serve_forever(poll_interval=.1)
    finally: manager.stop();server.server_close();runner.cleanup_stale();lock.close()


if __name__ == '__main__': main()
