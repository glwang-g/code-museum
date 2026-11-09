"""Offline deployment guards with real temporary files and mocked OS boundaries.

No privileged writes, Docker, network, downloaded archive, or installed gVisor
are needed. Only subprocess/HTTP services and root ownership are simulated;
bundle verification, archive parsing, drain logic, backups and restoration run.
"""
from contextlib import ExitStack
import hashlib
import http.client
import importlib.util
import io
import json
import os
from pathlib import Path
import sqlite3
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import unittest
from unittest import mock

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]


def load_module(name, filename):
    specification = importlib.util.spec_from_file_location(name, ROOT / 'deploy' / filename)
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


sandbox = load_module('museum_guest_sandbox', 'install-guest-sandbox.py')
upgrade = load_module('museum_guest_upgrade', 'upgrade-guest-executor.py')


def write(path, data, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    path.chmod(mode)


def root_boundary(stack):
    """Pretend only UID/GID checks and chown are privileged; keep real I/O."""
    original_stat, original_fstat = os.stat, os.fstat

    def owned(function, *args, **kwargs):
        result = list(function(*args, **kwargs))
        result[4] = result[5] = 0
        return os.stat_result(result)

    stack.enter_context(mock.patch.object(os, 'stat', side_effect=lambda *args, **kwargs: owned(original_stat, *args, **kwargs)))
    stack.enter_context(mock.patch.object(os, 'fstat', side_effect=lambda *args, **kwargs: owned(original_fstat, *args, **kwargs)))
    stack.enter_context(mock.patch.object(os, 'fchown', return_value=None))
    stack.enter_context(mock.patch.object(os, 'geteuid', return_value=0))


class FakeOS:
    """External commands only; inspect/configuration bytes stay on the real FS."""
    def __init__(self, daemon=None, runtime=None):
        self.daemon, self.runtime = daemon, runtime
        self.calls, self.reloads = [], 0
        self.fail_reload_once = False
        self.fail_validate = False
        self.changed_unrelated_pid = False
        self.states = {}
        self.images = {}

    def run(self, argv, **kwargs):
        self.calls.append(argv)
        code, output = 0, ''
        if argv[0] == 'systemctl':
            operation = argv[1]
            if operation == 'show':
                output = 'yes' if '--property=CanReload' in argv else '123'
            elif operation == 'reload':
                self.reloads += 1
                code = 1 if self.fail_reload_once and self.reloads == 1 else 0
            elif operation in ('is-active', 'is-enabled'):
                state = self.states[argv[2]]
                output = state['active' if operation == 'is-active' else 'enabled']
                code = 0 if output in ('active', 'enabled') else 3
            elif operation in ('stop', 'start'):
                self.states[argv[2]]['active'] = 'inactive' if operation == 'stop' else 'active'
            elif operation != 'daemon-reload':
                raise AssertionError('Unexpected systemd operation')
        elif argv[0] == 'dockerd':
            self.assert_validate_command(argv)
            code = 1 if self.fail_validate else 0
        elif argv[0] == 'systemd-analyze':
            if argv[1] != 'verify' or not all(Path(name).is_file() for name in argv[2:]):
                raise AssertionError('Expected verification of real staged unit bytes')
        elif argv[0] == 'docker':
            if argv[1:3] != ['--host', 'unix:///var/run/docker.sock']:
                raise AssertionError('Docker must use the local socket')
            operation = argv[3]
            if operation == 'info':
                configuration = json.loads(self.daemon.read_bytes()) if self.daemon and self.daemon.exists() else {}
                runtimes = {'runsc': self.runtime} if self.runtime else configuration.get('runtimes', {})
                output = json.dumps({'default': configuration.get('default-runtime', 'runc'),
                                     'cgroup': '2', 'security': ['name=seccomp,profile=builtin'], 'runtimes': runtimes})
            elif operation == 'ps':
                output = '' if '--filter' in argv else 'f' * 64
            elif operation == 'inspect':
                output = json.dumps({'id': 'f' * 64, 'pid': 999 if self.changed_unrelated_pid and self.reloads else 456,
                                     'status': 'running', 'running': True, 'museum': None})
            elif operation == 'image' and argv[4] == 'inspect':
                output = json.dumps(self.images[argv[-1]])
            else:
                raise AssertionError('Unexpected Docker mutation or inspection')
        elif argv[0].endswith('/runsc') and argv[1:] == ['--version']:
            output = 'runsc version release-20261102.0'
        else:
            raise AssertionError('Unexpected external command')
        return subprocess.CompletedProcess(argv, code, (output + '\n').encode(), b'')

    @staticmethod
    def assert_validate_command(argv):
        if argv[1:3] != ['--validate', '--config-file'] or not Path(argv[3]).is_file():
            raise AssertionError('dockerd may validate a file, never start a daemon')


class SandboxArchiveTests(unittest.TestCase):
    @staticmethod
    def archive(entries):
        output = io.BytesIO()
        with tarfile.open(fileobj=output, mode='w:bz2') as archive:
            for name, kind, body, mode in entries:
                member = tarfile.TarInfo(name)
                member.type, member.mode = kind, mode
                member.size = len(body) if kind == tarfile.REGTYPE else 0
                archive.addfile(member, io.BytesIO(body))
        output.seek(0)
        return output

    def test_archive_paths_types_duplicates_and_sizes_are_rejected(self):
        cases = [('../runsc', tarfile.REGTYPE, b'x', 0o755, {'../runsc': 1}),
                 ('/runsc', tarfile.REGTYPE, b'x', 0o755, {'/runsc': 1}),
                 ('gvisor-bin//runsc', tarfile.REGTYPE, b'x', 0o755, {'gvisor-bin//runsc': 1}),
                 ('runsc', tarfile.SYMTYPE, b'', 0o755, {'runsc': 0}),
                 ('runsc', tarfile.LNKTYPE, b'', 0o755, {'runsc': 0}),
                 ('runsc', tarfile.CHRTYPE, b'', 0o755, {'runsc': 0}),
                 ('runsc', tarfile.FIFOTYPE, b'', 0o755, {'runsc': 0}),
                 ('runsc', tarfile.REGTYPE, b'x', 0o4755, {'runsc': 1}),
                 ('runsc', tarfile.REGTYPE, b'x', 0o755, {'runsc': 2})]
        for name, kind, body, mode, expected in cases:
            with self.subTest(name=name, kind=kind, mode=mode), tarfile.open(fileobj=self.archive([(name, kind, body, mode)]), mode='r:bz2') as archive:
                with self.assertRaises(ValueError):
                    sandbox.checked_members(archive, expected)
        for entries, expected in [([('runsc', tarfile.REGTYPE, b'x', 0o755)] * 2, {'runsc': 1}),
                                  ([('runsc', tarfile.REGTYPE, b'x', 0o755)], {'runsc': 1, 'missing': 1})]:
            with tarfile.open(fileobj=self.archive(entries), mode='r:bz2') as archive:
                with self.assertRaises(ValueError):
                    sandbox.checked_members(archive, expected)

    def test_verified_copy_rejects_corruption_truncation_oversize_and_symlinks(self):
        data = b'offline fixture archive'
        identity = {'expected_bytes': len(data), 'expected_sha256': hashlib.sha256(data).hexdigest(),
                    'expected_sha512': hashlib.sha512(data).hexdigest()}
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            for index, candidate in enumerate((data, data[:-1], b'X' + data[1:], data + b'x')):
                source, destination = root / 'source', root / str(index)
                source.write_bytes(candidate)
                if candidate == data:
                    sandbox.copy_verified_archive(source, destination, **identity)
                    self.assertEqual(destination.read_bytes(), data)
                else:
                    with self.assertRaises(ValueError):
                        sandbox.copy_verified_archive(source, destination, **identity)
            source.write_bytes(data)
            for key, wrong in (('expected_sha256', '0' * 64), ('expected_sha512', '0' * 128)):
                with self.subTest(digest=key), self.assertRaises(ValueError):
                    sandbox.copy_verified_archive(source, root / key, **{**identity, key: wrong})
            linked = root / 'link'; linked.symlink_to(source)
            with self.assertRaises(ValueError):
                sandbox.copy_verified_archive(linked, root / 'linked-copy', **identity)

    def test_sidecars_remain_adjacent_and_executable_under_private_umask(self):
        entries = [('runsc', tarfile.REGTYPE, b'runtime fixture', 0o755),
                   ('gvisor-bin/sidecar', tarfile.REGTYPE, b'sidecar fixture', 0o755),
                   ('gvisor-bin', tarfile.DIRTYPE, b'', 0o755)]
        manifest = {'members': {'runsc': 15, 'gvisor-bin': None, 'gvisor-bin/sidecar': 15}, 'source': 'https://example.invalid/pinned-fixture'}
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve(); archive = root / 'runtime.tar.bz2'
            archive.write_bytes(self.archive(entries).getvalue())
            previous = os.umask(0o077)
            try:
                record = sandbox.extract_runtime(archive, root / 'runtime', manifest)
            finally:
                os.umask(previous)
            for name in ('', 'runsc', 'gvisor-bin', 'gvisor-bin/sidecar'):
                self.assertEqual(stat.S_IMODE((root / 'runtime' / name).stat().st_mode), 0o755)
            for name, expected in record['files'].items():
                self.assertEqual(hashlib.sha256((root / 'runtime' / name).read_bytes()).hexdigest(), expected)

    def test_manifest_identity_and_duplicate_json_fields_are_guarded(self):
        manifest_path = ROOT / 'server/deploy/gvisor-runtime.json'
        manifest = sandbox.manifest_data(manifest_path)
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary).resolve() / 'manifest.json'
            manifest['sha256'] = '0' * 64
            path.write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):
                sandbox.manifest_data(path)
        with self.assertRaises(ValueError):
            sandbox.read_json('{"runtimes":{},"runtimes":{}}')


class SandboxConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.root = Path(self.stack.enter_context(tempfile.TemporaryDirectory())).resolve()
        root_boundary(self.stack)
        self.daemon, self.backups = self.root / 'etc/docker/daemon.json', self.root / 'backups'
        self.daemon.parent.mkdir(parents=True); self.daemon.parent.chmod(0o755)
        self.manifest = sandbox.manifest_data(ROOT / 'server/deploy/gvisor-runtime.json')
        self.os = FakeOS(self.daemon)
        self.stack.enter_context(mock.patch.object(sandbox, 'DAEMON', self.daemon))
        self.stack.enter_context(mock.patch.object(sandbox, 'BACKUPS', self.backups))
        self.stack.enter_context(mock.patch.object(subprocess, 'run', side_effect=self.os.run))
        self.original = b'{\n "default-runtime":"runc", "log-driver":"json-file", "labels":["unrelated-service"]\n}\n'

    def tearDown(self):
        self.stack.close()

    def test_merge_preserves_unrelated_configuration_default_and_running_containers(self):
        write(self.daemon, self.original, 0o640)
        result = sandbox.configure_runtime(self.manifest)
        expected = json.loads(self.original)
        expected['runtimes'] = {'runsc': {key: self.manifest['runtime'][key] for key in ('path', 'runtimeArgs')}}
        self.assertEqual(json.loads(self.daemon.read_bytes()), expected)
        self.assertEqual(stat.S_IMODE(self.daemon.stat().st_mode), 0o640)
        self.assertTrue(result['unrelatedContainersUnchanged'])
        self.assertTrue(result['daemonPidUnchanged'])
        self.assertEqual((Path(result['backup']) / 'daemon.before').read_bytes(), self.original)
        self.assertFalse(any('restart' in argv for argv in self.os.calls))

    def test_reload_failure_restores_exact_original_bytes_or_original_absence(self):
        for present in (True, False):
            with self.subTest(original_present=present):
                if present:
                    write(self.daemon, self.original, 0o640)
                elif self.daemon.exists():
                    self.daemon.unlink()
                self.os.reloads = 0; self.os.fail_reload_once = True
                with self.assertRaises(ValueError):
                    sandbox.configure_runtime(self.manifest)
                self.assertEqual(self.daemon.exists(), present)
                if present:
                    self.assertEqual(self.daemon.read_bytes(), self.original)
                    self.assertEqual(stat.S_IMODE(self.daemon.stat().st_mode), 0o640)
                self.assertEqual(self.os.reloads, 2)

    def test_invalid_candidate_and_unrelated_container_change_refuse_installation(self):
        write(self.daemon, self.original, 0o640)
        self.os.fail_validate = True
        with self.assertRaises(ValueError):
            sandbox.configure_runtime(self.manifest)
        self.assertEqual(self.daemon.read_bytes(), self.original)
        self.assertEqual(self.os.reloads, 0)
        self.os.fail_validate = False; self.os.changed_unrelated_pid = True
        with self.assertRaises(ValueError):
            sandbox.configure_runtime(self.manifest)
        self.assertEqual(self.daemon.read_bytes(), self.original)
        self.assertEqual(self.os.reloads, 2)


class FakeConnection:
    def __init__(self, fixture, host, port, timeout):
        if host != '127.0.0.1':
            raise AssertionError('Only loopback HTTP is permitted')
        self.fixture, self.port = fixture, port

    def request(self, method, path, headers):
        if method != 'GET' or path not in ('/api/runtimes', '/api/executor-status'):
            raise AssertionError('Deployment must never submit or cancel user programs')
        if path.endswith('status'):
            gateway = self.fixture.node == 'xshow' and self.port == 4181
            token = self.fixture.gateway_token if gateway else self.fixture.worker_token
            if headers.get('Authorization') != 'Bearer ' + token or not headers.get('X-Execution-Session'):
                raise AssertionError('Private drain checks require the existing in-memory credential')
        self.path = path

    def getresponse(self):
        fixture = self.fixture
        gateway = fixture.node == 'xshow' and self.port == 4181
        if self.path.endswith('status'):
            gateway_stopped = fixture.os.states.get(upgrade.GATEWAY_UNIT, {}).get('active') == 'inactive'
            busy = fixture.busy_initial or fixture.busy_after_gateway and gateway_stopped
            data = {'available': True, 'complete': True, 'active': int(busy), 'queue': 0}
        else:
            upgraded = (fixture.code / 'executor.py').read_bytes() == fixture.planned['code/executor.py']
            identifiers = fixture.all_languages if gateway else fixture.selected
            data = {'available': not (fixture.fail_new_health and upgraded), 'private': not (gateway and upgraded),
                    'complete': True, 'runtimes': [{'id': ident} for ident in identifiers]}
            if gateway and upgraded:
                data['access'] = {'mode': 'guest', 'maxSessions': 5, 'idleSeconds': 300}
            if not gateway:
                data['sandbox'] = {'runtime': 'runsc' if upgraded else 'runc'}
        return mock.Mock(status=200, read=lambda maximum: json.dumps(data).encode())

    def close(self):
        pass


class ExecutorUpgradeTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.node = 'xshow'
        self.root = Path(self.stack.enter_context(tempfile.TemporaryDirectory())).resolve()
        root_boundary(self.stack)
        self.code, self.units, self.etc = self.root / 'code', self.root / 'units', self.root / 'etc'
        self.backups, self.routes, self.bundle = self.root / 'backups', self.root / 'routes.sqlite', self.root / 'bundle'
        for path in (self.code, self.code / 'museum-data', self.units, self.etc):
            path.mkdir(exist_ok=True); path.chmod(0o755 if path != self.etc else 0o700)
        for name, value in [('CODE', self.code), ('UNITS', self.units), ('ETC', self.etc), ('BACKUPS', self.backups), ('ROUTES', self.routes)]:
            self.stack.enter_context(mock.patch.object(upgrade, name, value))
        self.stack.enter_context(mock.patch.object(upgrade, 'HEALTH_SECONDS', 0.02))
        self.stack.enter_context(mock.patch.object(upgrade, 'HEALTH_INTERVAL', 0.001))
        self.worker_token, self.gateway_token = 'w' * 64, 'g' * 64
        write(self.etc / 'worker-xshow.env', ('EXECUTOR_TOKEN="' + self.worker_token + '"\n').encode(), 0o600)
        write(self.etc / 'gateway.env', ('EXECUTOR_TOKEN="' + self.gateway_token + '"\n').encode(), 0o600)
        with sqlite3.connect(self.routes) as db:
            db.execute('CREATE TABLE routes(state TEXT, expires REAL)')
        db.close()
        self.routes_before = self.routes.read_bytes()
        self.credentials_before = {path: path.read_bytes() for path in self.etc.iterdir()}
        partition = json.loads((ROOT / 'server/execution-nodes.json').read_bytes())
        self.selected = next(row['languages'] for row in partition['nodes'] if row['id'] == 'xshow')
        self.all_languages = sorted({ident for row in partition['nodes'] for ident in row['languages']})
        image = {'id': 'sha256:' + 'b' * 64, 'architecture': 'amd64', 'os': 'linux'}
        runtimes = {'runtimes': [{'id': ident, 'image': 'museum/fixture:1', 'imageId': image['id'], 'architecture': image['architecture']} for ident in self.all_languages]}
        self.planned = {'code/' + name: ('# upgraded fixture ' + name + '\n').encode() for name in upgrade.CODE_NAMES}
        self.planned['code/runtime-images.json'] = json.dumps(runtimes).encode()
        self.planned['code/execution-nodes.json'] = json.dumps(partition).encode()
        self.planned.update({'code/museum-data/' + name: b'{"fixture":"new"}\n' for name in upgrade.MUSEUM_NAMES})
        for name in (upgrade.WORKER_UNIT, upgrade.GATEWAY_UNIT, 'code-museum-execution-tunnel.service'):
            self.planned['units/' + name] = (ROOT / 'server/deploy' / name).read_bytes()
        self.planned.update({'preflight.py': b'# unused fixture\n', 'worker-xshow.env.example': b'EXECUTOR_TOKEN=REPLACE_ME\n',
                             'gateway.env.example': b'EXECUTOR_TOKEN=REPLACE_ME\n', 'tunnel.env.example': b'EXECUTOR_TUNNEL_TARGET=REPLACE_ME\n'})
        for name, data in self.planned.items():
            write(self.bundle / name, data)
        self.approved_sha = self.update_manifest()
        self.before = {}
        for path in upgrade.destinations('xshow'):
            name = ('code/' + path.relative_to(self.code).as_posix()) if path.is_relative_to(self.code) else 'units/' + path.name
            data = self.planned[name] if path.name in ('runtime-images.json', 'execution-nodes.json') else ('# original fixture ' + path.name + '\n').encode()
            write(path, data); self.before[path] = data
        runsc = self.root / 'gvisor/20261102.0/runsc'
        directory = runsc.parent; directory.mkdir(parents=True); directory.chmod(0o755)
        (directory / 'gvisor-bin').mkdir(mode=0o755)
        names = ['runsc', 'containerd-shim-runsc-v1', 'gvisor-bin/checkpointgofer', 'gvisor-bin/gvisor-proc-umounter',
                 'gvisor-bin/gvisor-sentry-prewarmer', 'gvisor-bin/gvisor_sentry', 'gvisor-bin/runsc-fd-parking', 'gvisor-bin/runsc-metric-server']
        hashes = {}
        for name in names:
            body = ('binary boundary fixture: ' + name).encode(); write(directory / name, body, 0o755)
            hashes[name] = upgrade.digest(body)
        write(directory / 'installation.json', json.dumps({'release': '20261102.0', 'archiveSha256': upgrade.RUNSC_SHA, 'files': hashes}).encode())
        self.stack.enter_context(mock.patch.object(upgrade, 'RUNSC', str(runsc)))
        self.os = FakeOS(runtime={'path': str(runsc), 'runtimeArgs': ['--platform=systrap']})
        self.os.images['museum/fixture:1'] = image
        self.os.states = {name: {'active': 'active', 'enabled': 'enabled'} for name in upgrade.services('xshow')}
        self.stack.enter_context(mock.patch.object(subprocess, 'run', side_effect=self.os.run))
        self.stack.enter_context(mock.patch.object(http.client, 'HTTPConnection', side_effect=lambda host, port, timeout: FakeConnection(self, host, port, timeout)))
        self.busy_initial = self.busy_after_gateway = self.fail_new_health = False

    def tearDown(self):
        self.stack.close()

    def update_manifest(self):
        rows = [{'file': path.relative_to(self.bundle).as_posix(), 'bytes': path.stat().st_size, 'sha256': upgrade.digest(path.read_bytes())}
                for path in sorted(self.bundle.rglob('*')) if path.is_file() and path.name != 'bundle-manifest.json']
        raw = (json.dumps({'schemaVersion': 1, 'node': 'xshow', 'files': rows}) + '\n').encode()
        write(self.bundle / 'bundle-manifest.json', raw)
        return upgrade.digest(raw)

    def assert_original_files(self):
        for path, before in self.before.items():
            self.assertEqual(path.read_bytes(), before)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o644)

    def assert_state_untouched(self):
        self.assertEqual(self.routes.read_bytes(), self.routes_before)
        self.assertEqual({path: path.read_bytes() for path in self.etc.iterdir()}, self.credentials_before)
        self.assertFalse(any('enable' == value or 'disable' == value or 'restart' == value for argv in self.os.calls for value in argv))

    def install(self):
        return upgrade.install(self.bundle, 'xshow', self.approved_sha)

    def test_readonly_validation_checks_reviewed_manifest_all_files_and_allowed_destinations(self):
        upgrade.bundle_files(self.bundle, 'xshow', self.approved_sha)
        self.assertFalse(self.backups.exists())
        self.assert_original_files(); self.assert_state_untouched()
        with self.assertRaises(ValueError):
            upgrade.bundle_files(self.bundle, 'xshow', '0' * 64)
        write(self.bundle / 'code/executor.py', b'# tampered\n')
        with self.assertRaises(ValueError):
            upgrade.bundle_files(self.bundle, 'xshow', self.approved_sha)
        write(self.bundle / 'code/private.env', b'UNEXPECTED=fixture\n')
        with self.assertRaises(ValueError):
            upgrade.bundle_files(self.bundle, 'xshow', self.update_manifest())
        self.assert_original_files()

    def test_busy_initial_check_never_stops_services_or_changes_production(self):
        self.busy_initial = True
        with self.assertRaises(ValueError):
            self.install()
        self.assertFalse(any(argv[:2] == ['systemctl', 'stop'] for argv in self.os.calls))
        self.assertFalse(self.backups.exists())
        self.assert_original_files(); self.assert_state_untouched()

    def test_unprivileged_install_rollback_and_lock_refuse_before_mutations(self):
        with mock.patch.object(os, 'geteuid', return_value=501):
            with self.assertRaises(ValueError):
                self.install()
            with self.assertRaises(ValueError):
                upgrade.rollback(self.backups / 'untrusted')
            with self.assertRaises(ValueError), upgrade.upgrade_lock():
                self.fail('Unprivileged lock must not be acquired')
        self.assertFalse(self.os.calls)
        self.assertFalse(self.backups.exists())
        self.assert_original_files(); self.assert_state_untouched()

    def test_job_arriving_before_gateway_stop_never_stops_worker(self):
        self.busy_after_gateway = True
        with self.assertRaises(ValueError):
            self.install()
        stops = [argv[2] for argv in self.os.calls if argv[:2] == ['systemctl', 'stop']]
        self.assertEqual(stops, [upgrade.GATEWAY_UNIT])
        self.assertEqual(self.os.states[upgrade.GATEWAY_UNIT]['active'], 'active')
        record = json.loads(next(self.backups.glob('*/upgrade.json')).read_bytes())
        self.assertEqual(record['phase'], 'refused-busy')
        self.assert_original_files(); self.assert_state_untouched()

    def test_failed_new_health_restores_exact_bytes_modes_and_original_services(self):
        self.fail_new_health = True
        with self.assertRaises(ValueError):
            self.install()
        self.assert_original_files(); self.assert_state_untouched()
        record = json.loads(next(self.backups.glob('*/upgrade.json')).read_bytes())
        self.assertEqual(record['phase'], 'rolled-back')
        self.assertTrue(all(state['active'] == 'active' for state in self.os.states.values()))
        starts = [argv[2] for argv in self.os.calls if argv[:2] == ['systemctl', 'start']]
        self.assertEqual(starts[-2:], upgrade.services('xshow'))

    def test_successful_upgrade_and_explicit_rollback_keep_credentials_and_databases(self):
        result = self.install()
        self.assertTrue(result['installed'])
        self.assertEqual(result['languageCount'], 42)
        self.assertNotEqual((self.code / 'executor.py').read_bytes(), self.before[self.code / 'executor.py'])
        self.assert_state_untouched()
        upgrade.rollback(Path(result['backupPath']))
        self.assert_original_files(); self.assert_state_untouched()

    def test_rollback_rejects_later_production_edit_before_stopping_services(self):
        result = self.install()
        write(self.code / 'executor.py', b'# later deployment\n')
        self.os.calls.clear()
        with self.assertRaises(ValueError):
            upgrade.rollback(Path(result['backupPath']))
        self.assertEqual((self.code / 'executor.py').read_bytes(), b'# later deployment\n')
        self.assertFalse(any(argv[:2] == ['systemctl', 'stop'] for argv in self.os.calls))
        self.assert_state_untouched()

    def test_route_drain_ignores_all_final_states_and_expiry_but_keeps_unknown(self):
        with sqlite3.connect(self.routes) as db:
            db.executemany('INSERT INTO routes VALUES (?,?)', [(state, time.time() + 300) for state in upgrade.FINAL] +
                           [('queued', time.time() - 10), ('unknown', time.time() + 120)])
        db.close(); before = self.routes.read_bytes()
        self.assertEqual(upgrade.route_count(), 1)
        self.assertEqual(self.routes.read_bytes(), before)
        with self.assertRaises(ValueError):
            upgrade.drained('xshow', self.os.states)
        self.assertFalse(any(argv[:2] == ['systemctl', 'stop'] for argv in self.os.calls))

    def test_xshow2_upgrade_and_rollback_leave_gateway_and_tunnel_units_alone(self):
        self.node = 'xshow2'
        partition = json.loads(self.planned['code/execution-nodes.json'])
        self.selected = next(row['languages'] for row in partition['nodes'] if row['id'] == self.node)
        second = self.root / 'bundle-xshow2'
        files = {name: data for name, data in self.planned.items() if name.startswith('code/') or name == 'units/' + upgrade.WORKER_UNIT or name == 'preflight.py'}
        files['worker-xshow2.env.example'] = b'EXECUTOR_TOKEN=REPLACE_ME\n'
        files['ssh/code-museum-forward.sshd.conf'] = b'# fixture: never installed by upgrade\n'
        for name, data in files.items():
            write(second / name, data)
        rows = [{'file': name, 'bytes': len(data), 'sha256': upgrade.digest(data)} for name, data in sorted(files.items())]
        raw = json.dumps({'schemaVersion': 1, 'node': self.node, 'files': rows}).encode()
        write(second / 'bundle-manifest.json', raw)
        write(self.etc / 'worker-xshow2.env', ('EXECUTOR_TOKEN="' + self.worker_token + '"\n').encode(), 0o600)
        self.credentials_before = {path: path.read_bytes() for path in self.etc.iterdir()}
        self.os.states = {name: {'active': 'active', 'enabled': 'enabled'} for name in upgrade.services(self.node)}
        gateway_before = (self.units / upgrade.GATEWAY_UNIT).read_bytes()
        result = upgrade.install(second, self.node, upgrade.digest(raw))
        self.assertEqual(result['languageCount'], 14)
        self.assertEqual((self.units / upgrade.GATEWAY_UNIT).read_bytes(), gateway_before)
        self.assertFalse(any(upgrade.GATEWAY_UNIT in argv for argv in self.os.calls if argv[0] == 'systemctl'))
        upgrade.rollback(Path(result['backupPath']))
        self.assert_original_files(); self.assert_state_untouched()


if __name__ == '__main__':
    unittest.main()
