#!/usr/bin/env python3
"""Upgrade an existing dual executor from an explicitly reviewed local bundle.

Default: read-only validation. --install and --rollback require root. The
operator must block new public submissions throughout maintenance on both
nodes; upgrade xshow2 before xshow. Never changes credentials, accounts, SSH,
tunnel, Nginx, database contents, images, Docker configuration, or enable state.
Keep install-dual-executor.py beside this script for its unchanged bundle checks.
"""
import argparse
import ast
import datetime
import fcntl
import hashlib
import http.client
import importlib.util
import json
import os
from pathlib import Path
import re
import shlex
import sqlite3
import stat
import subprocess
import sys
import tempfile
import time
import uuid
from contextlib import closing, contextmanager

sys.dont_write_bytecode = True
CODE = Path('/opt/code-museum-executor-dual')
UNITS = Path('/etc/systemd/system')
ETC = Path('/etc/code-museum-executor')
BACKUPS = Path('/var/backups/code-museum-executor')
ROUTES = Path('/var/lib/code-museum-executor-gateway/routes.sqlite')
ORIGIN = 'https://codemuseum.freexlib.com'
CODE_NAMES = {'executor.py', 'execution_gateway.py', 'execution_nodes.py', 'observability.py',
              'mcp.py', 'mcp_http.py', 'runtime-images.json', 'execution-nodes.json'}
MUSEUM_NAMES = {'catalogue.json', 'audit-reviews.json', 'relationship-status.json',
                'execution-capabilities.json', 'mcp-manifest.json'}
WORKER_UNIT = 'code-museum-worker@.service'
GATEWAY_UNIT = 'code-museum-execution-gateway.service'
RUNSC = '/opt/code-museum-gvisor/20261102.0/runsc'
RUNSC_SHA = '6f6b1a8f0f4665a403238135167d0d990bfaeaff5544abf68f5e0d822b35484a'
ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LC_ALL': 'C'}
DOCKER = ['docker', '--host', 'unix:///var/run/docker.sock']
FINAL = {'completed', 'failed', 'compile_error', 'compile_timed_out', 'timed_out',
         'cancelled', 'output_limit', 'memory_limit', 'infrastructure_error'}
HEALTH_SECONDS, HEALTH_INTERVAL = 60, 0.5


def digest(data):
    return hashlib.sha256(data).hexdigest()


def command(argv, allowed=(0,), timeout=60):
    try:
        result = subprocess.run(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                timeout=timeout, check=False, env=ENV)
    except (OSError, subprocess.TimeoutExpired):
        raise ValueError('Command unavailable or timed out: ' + Path(argv[0]).name) from None
    if result.returncode not in allowed:
        raise ValueError('Command failed: ' + Path(argv[0]).name)
    return result.stdout.decode('utf-8').strip()


def no_symlinks(path):
    for item in (path, *path.parents):
        if item.is_symlink():
            raise ValueError('Installer paths must not contain symbolic links')


def regular(path, mode):
    no_symlinks(path)
    info = path.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_gid != 0 or stat.S_IMODE(info.st_mode) != mode:
        raise ValueError('Expected a protected root-owned regular file: ' + str(path))
    return info


def directory(path, mode):
    no_symlinks(path)
    info = path.stat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_gid != 0 or stat.S_IMODE(info.st_mode) != mode:
        raise ValueError('Unexpected directory ownership or permissions: ' + str(path))


@contextmanager
def upgrade_lock():
    if os.geteuid() != 0:
        raise ValueError('Installation and rollback require root')
    no_symlinks(BACKUPS)
    if not BACKUPS.exists():
        BACKUPS.mkdir(mode=0o700)
    directory(BACKUPS, 0o700)
    path = BACKUPS / '.guest-upgrade.lock'; no_symlinks(path)
    with os.fdopen(os.open(path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600), 'r+b') as lock:
        info = os.fstat(lock.fileno())
        if info.st_uid != 0 or info.st_gid != 0 or stat.S_IMODE(info.st_mode) != 0o600:
            raise ValueError('Upgrade lock ownership or mode differs')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def destinations(node):
    result = {CODE / name for name in CODE_NAMES}
    result |= {CODE / 'museum-data' / name for name in MUSEUM_NAMES}
    result.add(UNITS / WORKER_UNIT)
    if node == 'xshow':
        result.add(UNITS / GATEWAY_UNIT)
    return result


def services(node):
    result = ['code-museum-worker@' + node + '.service']
    if node == 'xshow':
        result.append(GATEWAY_UNIT)
    return result


def service_states(node):
    states = {}
    for name in services(node):
        active = command(['systemctl', 'is-active', name], allowed=(0, 1, 3, 4))
        if active not in ('active', 'inactive', 'failed'):
            raise ValueError('Wait for stable worker and gateway service states')
        states[name] = {'active': active, 'enabled': command(['systemctl', 'is-enabled', name], allowed=(0, 1, 3, 4))}
    return states


def sandbox_ready():
    regular(Path(RUNSC), 0o755)
    directory(Path(RUNSC).parent, 0o755)
    directory(Path(RUNSC).parent / 'gvisor-bin', 0o755)
    record_path = Path(RUNSC).parent / 'installation.json'
    regular(record_path, 0o644)
    record = json.loads(record_path.read_bytes())
    expected = {'runsc', 'containerd-shim-runsc-v1', 'gvisor-bin/checkpointgofer',
                'gvisor-bin/gvisor-proc-umounter', 'gvisor-bin/gvisor-sentry-prewarmer',
                'gvisor-bin/gvisor_sentry', 'gvisor-bin/runsc-fd-parking', 'gvisor-bin/runsc-metric-server'}
    if record.get('release') != '20261102.0' or record.get('archiveSha256') != RUNSC_SHA or set(record.get('files', {})) != expected:
        raise ValueError('Pinned gVisor installation record differs')
    for name, sha in record['files'].items():
        path = Path(RUNSC).parent / name
        regular(path, 0o755)
        if digest(path.read_bytes()) != sha:
            raise ValueError('Installed gVisor binary differs from its pinned installation')
    info = json.loads(command(DOCKER + ['info', '--format', '{"cgroup":{{json .CgroupVersion}},"security":{{json .SecurityOptions}},"runtimes":{{json .Runtimes}}}']))
    if str(info.get('cgroup')) != '2' or not any('seccomp' in item for item in info.get('security', [])):
        raise ValueError('Docker cgroup v2 and seccomp are required')
    configured = info.get('runtimes', {}).get('runsc', {})
    if configured.get('path') != RUNSC or configured.get('runtimeArgs') != ['--platform=systrap']:
        raise ValueError('Docker runsc registration differs from the pinned runtime')
    if '20261102' not in command([RUNSC, '--version']):
        raise ValueError('Pinned runsc executable is unavailable')


def bundle_files(bundle, node, approved_sha):
    if not re.fullmatch('[a-f0-9]{64}', approved_sha):
        raise ValueError('Expected an explicitly reviewed 64-character manifest SHA-256')
    legacy_path = Path(__file__).with_name('install-dual-executor.py')
    no_symlinks(legacy_path)
    specification = importlib.util.spec_from_file_location('reviewed_dual_installer', legacy_path)
    legacy = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(legacy)
    legacy.APPROVED = {**legacy.APPROVED, node: approved_sha}
    files, selected = legacy.verify_bundle(bundle, node, check_images=False)
    expected_code = {'code/' + name for name in CODE_NAMES} | {'code/museum-data/' + name for name in MUSEUM_NAMES}
    if {name for name in files if name.startswith('code/')} != expected_code:
        raise ValueError('Bundle code set differs from the reviewed thirteen files')
    allowed = expected_code | {'preflight.py', 'worker-' + node + '.env.example', 'units/' + WORKER_UNIT}
    allowed |= ({'gateway.env.example', 'tunnel.env.example', 'units/' + GATEWAY_UNIT,
                 'units/code-museum-execution-tunnel.service'} if node == 'xshow' else {'ssh/code-museum-forward.sshd.conf'})
    if set(files) != allowed:
        raise ValueError('Bundle contains missing or unexpected files')
    for name in CODE_NAMES:
        if name.endswith('.py'):
            ast.parse(files['code/' + name], filename=name)
    images = {item['id']: item for item in json.loads(files['code/runtime-images.json'])['runtimes']}
    checked = set()
    for name in selected:
        row = images[name]
        if row['image'] not in checked:
            image = json.loads(command(DOCKER + ['image', 'inspect', '--format', '{"id":{{json .Id}},"architecture":{{json .Architecture}},"os":{{json .Os}}}', row['image']]))
            if image != {'id': row['imageId'], 'architecture': row['architecture'], 'os': 'linux'}:
                raise ValueError('Provisioned image identity differs for ' + name)
            checked.add(row['image'])
    sandbox_ready()
    planned = {CODE / name.removeprefix('code/'): data for name, data in files.items() if name.startswith('code/')}
    for name in (WORKER_UNIT, GATEWAY_UNIT) if node == 'xshow' else (WORKER_UNIT,):
        planned[UNITS / name] = files['units/' + name]
    with tempfile.TemporaryDirectory(prefix='museum-unit-check-') as temporary:
        verified_units = []
        for name in (WORKER_UNIT, GATEWAY_UNIT):
            if 'units/' + name in files:
                path = Path(temporary) / name
                path.write_bytes(files['units/' + name])
                verified_units.append(str(path))
        command(['systemd-analyze', 'verify', *verified_units])
    directory(CODE, 0o755); directory(CODE / 'museum-data', 0o755)
    actual = set(CODE.rglob('*'))
    if actual != {CODE / 'museum-data'} | {path for path in destinations(node) if path.is_relative_to(CODE)}:
        raise ValueError('Existing production code set differs from the thirteen expected files')
    for path in planned:
        regular(path, 0o644)
    return planned, selected, set(images)


def credential(filename):
    path = ETC / filename
    regular(path, 0o600)
    found = []
    for line in path.read_text().splitlines():
        match = re.match(r'^\s*(?:export\s+)?EXECUTOR_TOKEN\s*=\s*(.*?)\s*$', line)
        if match:
            values = shlex.split(match[1], comments=False, posix=True)
            if len(values) != 1:
                raise ValueError('Cannot parse existing service credential')
            found.extend(values)
    if len(found) != 1 or len(found[0]) < 32 or not found[0].isascii() or any(ord(character) < 33 or ord(character) > 126 for character in found[0]):
        raise ValueError('Existing service credential is invalid')
    return found[0]


def request(port, path, token=None):
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=3)
    headers = {'Origin': ORIGIN, 'Accept': 'application/json', 'Connection': 'close'}
    if token:
        headers.update(Authorization='Bearer ' + token)
        headers['X-Execution-Session'] = uuid.uuid4().hex
    try:
        connection.request('GET', path, headers=headers)
        response = connection.getresponse()
        raw = response.read(262145)
        if response.status != 200 or len(raw) > 262144:
            raise ValueError('Loopback service health or authenticated drain check failed')
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError('Invalid loopback service response')
        return data
    except (OSError, http.client.HTTPException):
        raise ValueError('Loopback service unavailable') from None
    finally:
        connection.close()


def route_count():
    no_symlinks(ROUTES)
    if not ROUTES.is_file():
        raise ValueError('Existing gateway route database is required')
    with closing(sqlite3.connect(ROUTES.as_uri() + '?mode=ro', uri=True, timeout=2)) as db:
        db.execute('PRAGMA query_only=ON')
        return db.execute('SELECT count(*) FROM routes WHERE expires>? AND state NOT IN (' + ','.join('?' for _ in FINAL) + ')', (time.time(), *FINAL)).fetchone()[0]


def drained(node, states):
    for name in services(node):
        if states[name]['active'] != 'active':
            if name != GATEWAY_UNIT and command(DOCKER + ['ps', '--quiet', '--filter', 'label=code-museum.executor=dual-' + node]):
                raise ValueError('Inactive worker still has running project containers; wait for cleanup')
            continue
        gateway = name == GATEWAY_UNIT
        token = credential('gateway.env' if gateway else 'worker-' + node + '.env')
        data = request(4181 if gateway or node == 'xshow2' else 4184, '/api/executor-status', token)
        if (data.get('available') is not True or gateway and data.get('complete') is not True or
                any(type(data.get(field)) is not int or data[field] != 0 for field in ('active', 'queue'))):
            raise ValueError('Worker or gateway is unavailable or has active/queued jobs; wait without cancelling jobs')
    if node == 'xshow' and route_count():
        raise ValueError('Gateway has live routing reservations; wait for completion or expiry')


def atomic_write(path, data, mode):
    no_symlinks(path)
    descriptor, temporary = tempfile.mkstemp(prefix='.guest-upgrade-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            os.fchmod(stream.fileno(), mode); os.fchown(stream.fileno(), 0, 0)
            stream.write(data); stream.flush(); os.fsync(stream.fileno())
        os.replace(temporary, path)
        parent = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(parent)
        finally:
            os.close(parent)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def save_record(backup, record):
    atomic_write(backup / 'upgrade.json', (json.dumps(record, indent=2) + '\n').encode(), 0o600)


def snapshot(node, planned, approved_sha, states):
    no_symlinks(BACKUPS)
    if not BACKUPS.exists():
        BACKUPS.mkdir(mode=0o700)
    directory(BACKUPS, 0o700)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup = BACKUPS / (stamp + '-guest-' + node)
    backup.mkdir(mode=0o700); (backup / 'files').mkdir(mode=0o700)
    record = {'schemaVersion': 1, 'node': node, 'manifestSha256': approved_sha, 'services': states, 'files': [], 'phase': 'prepared'}
    for index, (path, data) in enumerate(sorted(planned.items())):
        regular(path, 0o644)
        before = path.read_bytes()
        name = str(index).zfill(2) + '.bin'
        atomic_write(backup / 'files' / name, before, 0o600)
        record['files'].append({'path': str(path), 'backup': name, 'mode': 0o644, 'beforeSha256': digest(before), 'afterSha256': digest(data)})
    save_record(backup, record)
    return backup, record


def health(node, selected, all_languages, states, old=False):
    deadline = time.monotonic() + HEALTH_SECONDS
    while time.monotonic() < deadline:
        try:
            for name in services(node):
                if states[name]['active'] != 'active':
                    continue
                gateway = name == GATEWAY_UNIT
                data = request(4181 if gateway or node == 'xshow2' else 4184, '/api/runtimes')
                rows = data.get('runtimes', [])
                expected = all_languages if gateway else set(selected)
                if (data.get('available') is not True or not isinstance(rows, list) or len(rows) != len(expected) or
                        {row['id'] for row in rows} != expected):
                    raise ValueError('Runtime inventory is incomplete')
                if not gateway and data.get('private') is not True:
                    raise ValueError('Workers must remain private')
                if not old and (gateway and (data.get('private') is not False or data.get('complete') is not True or
                        data.get('access') != {'mode': 'guest', 'maxSessions': 5, 'idleSeconds': 300}) or
                        not gateway and (data.get('private') is not True or data.get('sandbox') != {'runtime': 'runsc'})):
                    raise ValueError('Runtime guest/sandbox health contract differs')
            for name, state in states.items():
                if command(['systemctl', 'is-enabled', name], allowed=(0, 1, 3, 4)) != state['enabled']:
                    raise ValueError('Service enable state changed unexpectedly')
            return
        except (ValueError, KeyError, TypeError):
            time.sleep(HEALTH_INTERVAL)
    raise ValueError('Upgraded or restored services failed their bounded health checks')


def restore(backup, record, selected, all_languages):
    for name in reversed(services(record['node'])):
        command(['systemctl', 'stop', name])
    for row in record['files']:
        atomic_write(Path(row['path']), (backup / 'files' / row['backup']).read_bytes(), row['mode'])
    command(['systemctl', 'daemon-reload'])
    for name in services(record['node']):
        state = record['services'][name]
        if state['active'] == 'active':
            command(['systemctl', 'start', name])
    health(record['node'], selected, all_languages, record['services'], old=True)
    record['phase'] = 'rolled-back'; save_record(backup, record)


def install(bundle, node, approved_sha):
    if os.geteuid() != 0:
        raise ValueError('--install requires root')
    planned, selected, all_languages = bundle_files(bundle, node, approved_sha)
    states = service_states(node); drained(node, states)
    backup, record = snapshot(node, planned, approved_sha, states)
    try:
        # Detect concurrent edits before stopping any service or replacing bytes.
        for row in record['files']:
            if digest(Path(row['path']).read_bytes()) != row['beforeSha256']:
                raise ValueError('Production file changed during preparation')
        record['phase'] = 'stopping'; save_record(backup, record)
        if node == 'xshow' and states[GATEWAY_UNIT]['active'] == 'active':
            command(['systemctl', 'stop', GATEWAY_UNIT])
            # The gateway can no longer dispatch. Do not stop a worker if a job
            # arrived between the initial drain check and gateway shutdown.
            try:
                drained(node, {**states, GATEWAY_UNIT: {**states[GATEWAY_UNIT], 'active': 'inactive'}})
            except Exception:
                record['phase'] = 'refused-busy'; save_record(backup, record)
                command(['systemctl', 'start', GATEWAY_UNIT])
                raise
        command(['systemctl', 'stop', services(node)[0]])
        record['phase'] = 'replacing'; save_record(backup, record)
        for path, data in planned.items():
            atomic_write(path, data, 0o644)
        command(['systemctl', 'daemon-reload'])
        for name, state in states.items():
            if state['active'] == 'active':
                command(['systemctl', 'start', name])
        health(node, selected, all_languages, states)
        record['phase'] = 'complete'; save_record(backup, record)
    except BaseException:
        if record['phase'] not in ('prepared', 'refused-busy'):
            try:
                restore(backup, record, selected, all_languages)
            except Exception:
                raise ValueError('Upgrade failed and automatic restoration needs attention; private backup: ' + str(backup)) from None
        raise ValueError('Upgrade refused or failed; original files retained/restored; private backup: ' + str(backup)) from None
    return {'installed': True, 'node': node, 'backupPath': str(backup), 'manifestSha256': approved_sha,
            'languageCount': len(selected), 'fileSha256': {str(path): digest(data) for path, data in planned.items()},
            'services': service_states(node), 'credentialsAndStatePreserved': True}


def rollback(backup):
    if os.geteuid() != 0:
        raise ValueError('--rollback requires root')
    if backup.parent != BACKUPS:
        raise ValueError('Rollback directory must be directly under the executor backup directory')
    directory(backup, 0o700); directory(backup / 'files', 0o700); regular(backup / 'upgrade.json', 0o600)
    record = json.loads((backup / 'upgrade.json').read_bytes())
    node = record.get('node')
    if node not in ('xshow', 'xshow2') or record.get('schemaVersion') != 1:
        raise ValueError('Unknown upgrade record')
    if (set(record.get('services', {})) != set(services(node)) or len(record['files']) != len(destinations(node)) or
            {Path(row['path']) for row in record['files']} != destinations(node)):
        raise ValueError('Rollback record contains unexpected service or file destinations')
    for row in record['files']:
        if not re.fullmatch(r'[0-9]{2}\.bin', row['backup']) or row['mode'] != 0o644:
            raise ValueError('Unexpected backup file or mode')
        path, source = Path(row['path']), backup / 'files' / row['backup']
        regular(path, 0o644); regular(source, 0o600)
        if digest(source.read_bytes()) != row['beforeSha256'] or digest(path.read_bytes()) not in (row['beforeSha256'], row['afterSha256']):
            raise ValueError('Rollback refuses changed backup or production bytes')
    states = service_states(node); drained(node, states)
    partition = json.loads((CODE / 'execution-nodes.json').read_bytes())['nodes']
    selected = next(item['languages'] for item in partition if item['id'] == node)
    all_languages = {name for item in partition for name in item['languages']}
    restore(backup, record, selected, all_languages)
    return {'rolledBack': True, 'node': node, 'backupPath': str(backup), 'services': service_states(node), 'credentialsAndStatePreserved': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path)
    parser.add_argument('--node', choices=('xshow', 'xshow2'))
    parser.add_argument('--manifest-sha256')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--install', action='store_true')
    mode.add_argument('--rollback', type=Path)
    args = parser.parse_args()
    if args.rollback:
        if args.bundle or args.node or args.manifest_sha256:
            parser.error('--rollback cannot be combined with bundle arguments')
        with upgrade_lock():
            result = rollback(args.rollback.absolute())
    else:
        if not args.bundle or not args.node or not args.manifest_sha256:
            parser.error('--bundle, --node and --manifest-sha256 are required')
        if args.install:
            # Serializes install and rollback; no credential directory changes.
            with upgrade_lock():
                result = install(args.bundle.absolute(), args.node, args.manifest_sha256)
        else:
            _, selected, _ = bundle_files(args.bundle.absolute(), args.node, args.manifest_sha256)
            result = {'verified': True, 'node': args.node, 'manifestSha256': args.manifest_sha256,
                      'languageCount': len(selected), 'productionChanged': False}
    print(json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, sqlite3.Error, subprocess.SubprocessError) as error:
        message = str(error) if type(error) is ValueError else type(error).__name__
        print(json.dumps({'installed': False, 'error': message}), file=sys.stderr)
        sys.exit(1)
