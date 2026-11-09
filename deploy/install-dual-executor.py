#!/usr/bin/env python3
"""Install the approved 2026-11-09 dual-node bundle, without starting services.

Default mode is read-only (including local Docker image inspection). --install
requires root and credentials JSON on stdin. Run separately on each node; this
program never connects to another machine. It preserves the legacy executor.

Rollback removes only unchanged files created by this installer, after the
operator has stopped/disabled the new units. Service accounts, state directories,
databases, images, and the old service are retained. SSH trust and authorized_keys
are intentionally installed by the controller, not by this program.
"""
import argparse
import datetime
import grp
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import pwd
import re
import shlex
import stat
import subprocess
import sys
import tempfile


APPROVED = {
    'xshow': '36380288e363ab5dec28c609066029f4cc048e88437d1f025d9edcdae6eca072',
    'xshow2': 'e81a9176f430913bc1d9d18517225a91663e62ac296a6faf77ece807b2f66a5c',
}
CODE = Path('/opt/code-museum-executor-dual')
ETC = Path('/etc/code-museum-executor')
UNITS = Path('/etc/systemd/system')
BACKUPS = Path('/var/backups/code-museum-executor')
STATE = Path('/var/lib/code-museum-executor')
GATEWAY_STATE = Path('/var/lib/code-museum-executor-gateway')
FORWARD_HOME = Path('/var/lib/code-museum-forward')
ORIGIN = 'https://codemuseum.freexlib.com'
TUNNEL_TARGET = 'code-museum-forward@101.201.121.128'
WORKER = 'code-museum-executor'
GATEWAY = 'code-museum-gateway'
TUNNEL = 'code-museum-tunnel'
FORWARD = 'code-museum-forward'
UNIT_NAMES = ['code-museum-worker@.service', 'code-museum-execution-gateway.service',
              'code-museum-execution-tunnel.service']


def digest(data):
    return hashlib.sha256(data).hexdigest()


def command(argv, *, input_data=None, allowed=(0,)):
    """Never include command output in an exception: it may contain credentials."""
    result = subprocess.run(argv, input=input_data, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=60, check=False)
    if result.returncode not in allowed:
        raise ValueError('Command failed: ' + Path(argv[0]).name)
    return result.stdout.decode('utf-8').strip()


def no_symlinks(path):
    for part in [path, *path.parents]:
        if part.is_symlink():
            raise ValueError('Symbolic link is not allowed: ' + str(part))


def secure_regular(path, mode=None):
    no_symlinks(path)
    info = path.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_gid != 0:
        raise ValueError('Expected a root-owned regular file: ' + str(path))
    if mode is not None and stat.S_IMODE(info.st_mode) != mode:
        raise ValueError('Unexpected file permissions: ' + str(path))
    return info


def verify_bundle(bundle, node, check_images=True):
    no_symlinks(bundle)
    manifest_path = bundle / 'bundle-manifest.json'
    no_symlinks(manifest_path)
    raw = manifest_path.read_bytes()
    if digest(raw) != APPROVED[node]:
        raise ValueError('Bundle manifest differs from the approved final plan')
    manifest = json.loads(raw)
    if manifest.get('schemaVersion') != 1 or manifest.get('node') != node:
        raise ValueError('Wrong bundle node or schema')
    files = {}
    for row in manifest['files']:
        relative = PurePosixPath(row['file'])
        if relative.is_absolute() or '..' in relative.parts or str(relative) in files:
            raise ValueError('Invalid manifest path')
        path = bundle / relative
        no_symlinks(path)
        if not path.is_file():
            raise ValueError('Missing approved bundle file: ' + str(relative))
        data = path.read_bytes()
        if len(data) != row['bytes'] or digest(data) != row['sha256']:
            raise ValueError('Prepared file mismatch: ' + str(relative))
        files[str(relative)] = data
    actual = set()
    for path in bundle.rglob('*'):
        if path.is_symlink() or (not path.is_file() and not path.is_dir()):
            raise ValueError('Unexpected bundle entry')
        if path.is_file():
            actual.add(path.relative_to(bundle).as_posix())
    if actual != set(files) | {'bundle-manifest.json'}:
        raise ValueError('Bundle contains unlisted files')
    runtimes = {row['id']: row for row in json.loads(files['code/runtime-images.json'])['runtimes']}
    nodes = json.loads(files['code/execution-nodes.json'])['nodes']
    partition = [ident for item in nodes for ident in item['languages']]
    if len(set(partition)) != len(partition) or set(partition) != set(runtimes):
        raise ValueError('Runtime partition is incomplete or duplicated')
    selected = next(item for item in nodes if item['id'] == node)['languages']
    if len(selected) != (42 if node == 'xshow' else 14):
        raise ValueError('Unexpected runtime count')
    if check_images:
        info = json.loads(command(['docker', 'info', '--format', '{{json .}}']))
        if str(info.get('CgroupVersion')) != '2' or not any('seccomp' in value for value in info.get('SecurityOptions', [])):
            raise ValueError('Docker cgroup v2 and seccomp are required')
        checked = set()
        for ident in selected:
            row = runtimes[ident]
            if row['image'] in checked:
                continue
            image = json.loads(command(['docker', 'image', 'inspect', row['image']]))[0]
            if (image['Id'], image['Architecture'], image['Os']) != (row['imageId'], row['architecture'], 'linux'):
                raise ValueError('Pinned local image mismatch for ' + ident)
            checked.add(row['image'])
    return files, selected


def credentials_from_stdin(node):
    raw = sys.stdin.buffer.read(16385)
    if len(raw) > 16384:
        raise ValueError('Credentials JSON is too large')
    try:
        values = json.loads(raw)
    except (ValueError, TypeError):
        raise ValueError('Invalid credentials JSON') from None
    if not isinstance(values, dict):
        raise ValueError('Credentials JSON must be an object')
    required = {'workerToken', 'nodeXshow2Token'}
    if node == 'xshow':
        required.add('nodeXshowToken')
    if set(values) != required:
        raise ValueError('Credentials JSON must contain only this node\'s required token fields')
    for name in required:
        if not isinstance(values.get(name), str) or not re.fullmatch('[0-9a-f]{64}', values[name]):
            raise ValueError('Credentials require 64-character lowercase hex tokens')
    if node == 'xshow' and values['nodeXshowToken'] == values['nodeXshow2Token']:
        raise ValueError('Worker tokens must be distinct')
    expected = values['nodeXshowToken' if node == 'xshow' else 'nodeXshow2Token']
    if values['workerToken'] != expected:
        raise ValueError('Selected worker credential does not match its gateway credential')
    return values


def legacy_token():
    source = ETC / 'private.env'
    secure_regular(source, 0o600)
    found = []
    for line in source.read_text().splitlines():
        match = re.match(r'^\s*(?:export\s+)?EXECUTOR_TOKEN\s*=\s*(.*?)\s*$', line)
        if match:
            try:
                tokens = shlex.split(match.group(1), comments=False, posix=True)
            except ValueError:
                raise ValueError('Cannot parse preserved public credential') from None
            if len(tokens) != 1:
                raise ValueError('Cannot parse preserved public credential')
            found.append(tokens[0])
    if len(found) != 1 or not 32 <= len(found[0]) <= 4096 or not found[0].isascii() or any(ord(c) < 32 or ord(c) == 127 for c in found[0]):
        raise ValueError('Preserved public credential is absent or invalid')
    return found[0]


def env_bytes(values):
    return ''.join(name + '="' + value.replace('\\', '\\\\').replace('"', '\\"') + '"\n'
                   for name, value in values.items()).encode()


def planned_files(files, node, tokens):
    planned = {CODE / name.removeprefix('code/'): (data, 0o644)
               for name, data in files.items() if name.startswith('code/')}
    planned.update({UNITS / Path(name).name: (data, 0o644)
                    for name, data in files.items() if name.startswith('units/')})
    planned[ETC / ('worker-' + node + '.env')] = (env_bytes({
        'EXECUTOR_TOKEN': tokens['workerToken'], 'EXECUTOR_ORIGIN': ORIGIN,
        'EXECUTOR_WORKER_PORT': '4184' if node == 'xshow' else '4181',
        'EXECUTOR_METRICS_DB': str(STATE / ('metrics.sqlite' if node == 'xshow' else 'worker-xshow2-metrics.sqlite'))}), 0o600)
    if node == 'xshow':
        public_token = legacy_token()
        if public_token in (tokens['nodeXshowToken'], tokens['nodeXshow2Token']):
            raise ValueError('Public and worker credentials must be distinct')
        planned[ETC / 'gateway.env'] = (env_bytes({
            'EXECUTOR_TOKEN': public_token, 'EXECUTOR_NODE_XSHOW_TOKEN': tokens['nodeXshowToken'],
            'EXECUTOR_NODE_XSHOW2_TOKEN': tokens['nodeXshow2Token']}), 0o600)
        planned[ETC / 'tunnel.env'] = (env_bytes({'EXECUTOR_TUNNEL_TARGET': TUNNEL_TARGET}), 0o600)
    return planned


def account_specs(node):
    accounts = [(WORKER, STATE)]
    if node == 'xshow':
        accounts += [(GATEWAY, GATEWAY_STATE), (TUNNEL, Path('/nonexistent'))]
    else:
        accounts += [(FORWARD, FORWARD_HOME)]
    return accounts


def check_account(name):
    try:
        account = pwd.getpwnam(name)
    except KeyError:
        return None
    if account.pw_uid == 0 or Path(account.pw_shell).name not in ('nologin', 'false'):
        raise ValueError('Existing service account is not a non-login identity: ' + name)
    if grp.getgrgid(account.pw_gid).gr_name != name:
        raise ValueError('Existing service account has an unexpected primary group: ' + name)
    try:
        docker_gid = grp.getgrnam('docker').gr_gid
    except KeyError:
        docker_gid = -1
    if docker_gid in os.getgrouplist(name, account.pw_gid):
        raise ValueError('Service identity must not have persistent docker membership: ' + name)
    return account


def verify_destinations(planned):
    expected_code = {path for path in planned if path.is_relative_to(CODE)}
    if CODE.exists():
        no_symlinks(CODE)
        for path in CODE.rglob('*'):
            no_symlinks(path)
            if not path.is_file() and not path.is_dir():
                raise ValueError('Unexpected entry in existing dual code directory')
        actual_code = {path for path in CODE.rglob('*') if path.is_file()}
        if actual_code != expected_code:
            raise ValueError('Existing dual code directory is incomplete or contains extra files')
        directories = {CODE, *[path for path in CODE.rglob('*') if path.is_dir()]}
        if directories != {CODE, CODE / 'museum-data'}:
            raise ValueError('Existing dual code directory contains unexpected directories')
        for directory in directories:
            info = directory.stat()
            if info.st_uid != 0 or info.st_gid != 0 or stat.S_IMODE(info.st_mode) != 0o755:
                raise ValueError('Existing code directory is not immutable to service users')
    for path, (data, mode) in planned.items():
        no_symlinks(path)
        if path.exists():
            secure_regular(path, mode)
            if path.read_bytes() != data:
                raise ValueError('Refusing to overwrite a different existing installation file: ' + str(path))


def service_names(node):
    names = ['code-museum-worker@' + node + '.service']
    if node == 'xshow':
        names += UNIT_NAMES[1:] + ['code-museum-executor.service']
    return names


def service_states(node):
    states = {}
    for name in service_names(node):
        states[name] = {operation: command(['systemctl', operation, name], allowed=(0, 1, 3, 4))
                        for operation in ('is-active', 'is-enabled')}
    return states


class Transaction:
    def __init__(self, node):
        no_symlinks(BACKUPS)
        BACKUPS.mkdir(parents=True, exist_ok=True, mode=0o700)
        if BACKUPS.stat().st_uid != 0 or BACKUPS.stat().st_mode & 0o022:
            raise ValueError('Backup parent must be root-owned and not writable by others')
        timestamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        self.root = BACKUPS / (timestamp + '-dual-' + node)
        self.root.mkdir(mode=0o700)
        self.record = {'schemaVersion': 1, 'node': node, 'createdFiles': [], 'createdCodeDirectories': [],
                       'createdAccounts': [], 'retainedStateDirectories': [], 'serviceStates': service_states(node)}
        self.save()

    def save(self):
        path = self.root / 'installation.json'
        raw = (json.dumps(self.record, indent=2) + '\n').encode()
        fd, temporary = tempfile.mkstemp(prefix='.record-', dir=self.root)
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, 'wb') as handle:
                handle.write(raw)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def directory(self, path, uid=0, gid=0, mode=0o755, code=False):
        no_symlinks(path)
        if path.exists():
            info = path.stat()
            if not path.is_dir() or info.st_uid != uid or info.st_gid != gid or info.st_mode & 0o022:
                raise ValueError('Existing directory owner or permissions differ: ' + str(path))
            return
        path.mkdir(mode=mode)
        os.chown(path, uid, gid)
        self.record['createdCodeDirectories' if code else 'retainedStateDirectories'].append(str(path))
        self.save()

    def file(self, path, data, mode):
        if path.exists():
            return
        # Write-ahead record permits recovery if installation is interrupted.
        self.record['createdFiles'].append({'path': str(path), 'sha256': digest(data), 'mode': mode})
        self.save()
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
        with os.fdopen(fd, 'wb') as handle:
            os.fchmod(handle.fileno(), mode)
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())


def tunnel_key_preflight():
    key = ETC / 'tunnel_ed25519'
    public = ETC / 'tunnel_ed25519.pub'
    for path in (key, public):
        no_symlinks(path)
    if key.exists() != public.exists():
        raise ValueError('Incomplete existing dedicated tunnel key pair')
    if key.exists():
        secure_regular(key, 0o600)
        secure_regular(public, 0o644)
        derived = command(['ssh-keygen', '-y', '-f', str(key)]).split()
        if public.read_text().split()[:2] != derived[:2] or derived[0] != 'ssh-ed25519':
            raise ValueError('Dedicated tunnel public key does not match its private key')


def install(bundle, node):
    if os.geteuid() != 0:
        raise ValueError('--install requires root')
    files, selected = verify_bundle(bundle, node)
    tokens = credentials_from_stdin(node)
    planned = planned_files(files, node, tokens)
    verify_destinations(planned)
    accounts = account_specs(node)
    for name, home in accounts:
        account = check_account(name)
        if account and name == FORWARD and account.pw_dir != str(home):
            raise ValueError('Forwarding account has an unexpected home directory')
    if node == 'xshow':
        tunnel_key_preflight()
    command(['systemd-analyze', 'verify', *[str(bundle / 'units' / name) for name in UNIT_NAMES if 'units/' + name in files]])
    # All bundle, image, credentials and existing file checks precede any write.
    transaction = Transaction(node)
    try:
        for name, home in accounts:
            if check_account(name) is None:
                args = ['useradd', '--system', '--no-create-home', '--home-dir', str(home), '--shell', '/usr/sbin/nologin']
                try:
                    grp.getgrnam(name)
                    args += ['--gid', name]
                except KeyError:
                    args += ['--user-group']
                command(args + [name])
                transaction.record['createdAccounts'].append(name)
                transaction.save()
        worker = pwd.getpwnam(WORKER)
        transaction.directory(STATE, worker.pw_uid, worker.pw_gid, 0o700)
        if node == 'xshow':
            gateway = pwd.getpwnam(GATEWAY)
            transaction.directory(GATEWAY_STATE, gateway.pw_uid, gateway.pw_gid, 0o700)
        else:
            forward = pwd.getpwnam(FORWARD)
            transaction.directory(FORWARD_HOME, forward.pw_uid, forward.pw_gid, 0o700)
        transaction.directory(ETC, mode=0o700)
        transaction.directory(CODE, code=True)
        transaction.directory(CODE / 'museum-data', code=True)
        for path, (data, mode) in planned.items():
            transaction.file(path, data, mode)
        if node == 'xshow' and not (ETC / 'tunnel_ed25519').exists():
            # Key generation occurs only on this host; neither key is returned.
            with tempfile.TemporaryDirectory(prefix='.tunnel-key-', dir=transaction.root) as temporary:
                key = Path(temporary) / 'id_ed25519'
                command(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-C', 'code-museum-xshow-to-xshow2', '-f', str(key)])
                transaction.file(ETC / 'tunnel_ed25519', key.read_bytes(), 0o600)
                transaction.file(ETC / 'tunnel_ed25519.pub', key.with_suffix('.pub').read_bytes(), 0o644)
        command(['systemd-analyze', 'verify', *[str(UNITS / name) for name in UNIT_NAMES if 'units/' + name in files]])
        command(['systemctl', 'daemon-reload'])
        transaction.record['complete'] = True
        transaction.save()
    except Exception:
        print(json.dumps({'installed': False, 'backupPath': str(transaction.root),
                          'servicesStartedOrEnabled': False}), file=sys.stderr)
        raise
    return {'installed': True, 'node': node, 'languageCount': len(selected),
            'backupPath': str(transaction.root), 'accountsCreated': transaction.record['createdAccounts'],
            'productionPublicTokenPreserved': node == 'xshow', 'servicesStartedOrEnabled': False,
            'codeSha256': {str(path.relative_to(CODE)): digest(data) for path, (data, _) in planned.items() if path.is_relative_to(CODE)},
            'unitSha256': {path.name: digest(data) for path, (data, _) in planned.items() if path.parent == UNITS}}


def rollback(backup):
    if os.geteuid() != 0:
        raise ValueError('--rollback requires root')
    no_symlinks(backup)
    if backup.parent != BACKUPS:
        raise ValueError('Rollback directory must be directly under the installer backup directory')
    secure_regular(backup / 'installation.json', 0o600)
    record = json.loads((backup / 'installation.json').read_bytes())
    node = record['node']
    if node not in APPROVED or record.get('schemaVersion') != 1:
        raise ValueError('Unknown installation record')
    for name in service_names(node):
        if name == 'code-museum-executor.service':
            continue
        active = command(['systemctl', 'is-active', name], allowed=(0, 1, 3, 4))
        enabled = command(['systemctl', 'is-enabled', name], allowed=(0, 1, 3, 4))
        if active not in ('inactive', 'failed', 'unknown') or enabled in ('enabled', 'enabled-runtime', 'linked', 'linked-runtime'):
            raise ValueError('Stop and disable the new units before file rollback')
    allowed_env = {ETC / ('worker-' + node + '.env')}
    if node == 'xshow':
        allowed_env |= {ETC / 'gateway.env', ETC / 'tunnel.env', ETC / 'tunnel_ed25519', ETC / 'tunnel_ed25519.pub'}
    # Validate the complete removal set before removing any file.
    paths = []
    for row in record['createdFiles']:
        path = Path(row['path'])
        if '..' in path.parts or not (path.is_relative_to(CODE) or path in allowed_env or (path.parent == UNITS and path.name in UNIT_NAMES)):
            raise ValueError('Unexpected rollback file path')
        no_symlinks(path)
        if path.exists():
            secure_regular(path, row['mode'])
            if digest(path.read_bytes()) != row['sha256']:
                raise ValueError('Rollback refuses a file changed since installation: ' + str(path))
            paths.append(path)
    directories = []
    for name in reversed(record['createdCodeDirectories']):
        path = Path(name)
        if path not in (CODE, CODE / 'museum-data'):
            raise ValueError('Unexpected rollback code directory')
        no_symlinks(path)
        directories.append(path)
    for path in reversed(paths):
        path.unlink()
    for path in directories:
        if path.exists() and not any(path.iterdir()):
            path.rmdir()
    command(['systemctl', 'daemon-reload'])
    return {'rolledBack': True, 'node': node, 'removedCreatedFiles': len(paths),
            'legacyServiceAndAllStateRetained': True, 'accountsRetained': record['createdAccounts']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, help='The approved node bundle directory')
    parser.add_argument('--node', choices=sorted(APPROVED))
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--install', action='store_true', help='Install only; never start, stop, enable or disable services')
    mode.add_argument('--rollback', type=Path, metavar='BACKUP', help='Remove unchanged installer-created files after stopping/disabling new units')
    args = parser.parse_args()
    try:
        if args.rollback:
            if args.bundle or args.node:
                raise ValueError('--rollback cannot be combined with --bundle or --node')
            result = rollback(args.rollback.absolute())
        else:
            if args.bundle is None or args.node is None:
                raise ValueError('--bundle and --node are required')
            if args.install:
                result = install(args.bundle.absolute(), args.node)
            else:
                _, selected = verify_bundle(args.bundle.absolute(), args.node)
                result = {'verified': True, 'node': args.node, 'languageCount': len(selected),
                          'localImagesChecked': True, 'productionChanged': False}
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        # JSON decoding errors can embed their input; only controlled ValueErrors
        # are printed. No stdin, environment content or subprocess output is logged.
        message = str(error) if type(error) is ValueError else type(error).__name__
        parser.exit(1, 'Installation refused: ' + message + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
