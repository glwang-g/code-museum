#!/usr/bin/env python3
"""Verify an offline pinned gVisor archive; --install adds the Docker runtime.

No downloads, image pulls, Docker restart, default-runtime change, or worker
cutover occur here. Run separately on each host. Installation requires root;
the default only verifies the explicit archive and prints a safe summary.
The repository manifest is the default; pass --manifest for a separate upload.
"""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import time

RELEASE = '20261102.0'
ARCHIVE_BYTES = 75332313
SHA256 = '6f6b1a8f0f4665a403238135167d0d990bfaeaff5544abf68f5e0d822b35484a'
SHA512 = '2e6671bb2d033b871c5811ab57e16ac570988b0e0054c525f911cfaf191bab3ca4efb08e0a98daa4b9e7d248f9e5776ef2ef2f8a6b82d829646a42924c98bb05'
BASE = Path('/opt/code-museum-gvisor')
TARGET = BASE / RELEASE
DAEMON = Path('/etc/docker/daemon.json')
BACKUPS = Path('/var/backups/code-museum-executor')
ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LC_ALL': 'C'}
DOCKER = ['docker', '--host', 'unix:///var/run/docker.sock']


def command(argv, timeout=30):
    # Never include daemon output, configuration, or subprocess errors in logs.
    try:
        result = subprocess.run(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                env=ENV, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise ValueError('Command unavailable or timed out: ' + Path(argv[0]).name) from None
    if result.returncode:
        raise ValueError('Command failed: ' + Path(argv[0]).name)
    return result.stdout.decode('utf-8').strip()


def no_symlinks(path):
    for item in (path, *path.parents):
        if item.is_symlink():
            raise ValueError('Symbolic links are not allowed for installer paths')


def secure_directory(path, create=False, mode=0o755):
    no_symlinks(path)
    if create and not path.exists():
        path.mkdir(mode=mode)
        path.chmod(mode)
    info = path.stat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
        raise ValueError('Expected a root-owned directory without untrusted writers')


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate configuration field')
        result[key] = value
    return result


def read_json(raw):
    return json.loads(raw, object_pairs_hook=unique_object)


def manifest_data(path):
    no_symlinks(path)
    manifest = read_json(path.read_bytes())
    if (manifest.get('schemaVersion') != 1 or manifest.get('release') != RELEASE or
            manifest.get('architecture') != 'x86_64' or manifest.get('bytes') != ARCHIVE_BYTES or
            manifest.get('sha256') != SHA256 or manifest.get('sha512') != SHA512 or
            manifest.get('installDirectory') != str(TARGET) or
            manifest.get('runtime') != {'name': 'runsc', 'path': str(TARGET / 'runsc'), 'runtimeArgs': ['--platform=systrap']}):
        raise ValueError('Manifest differs from the pinned runtime identity')
    return manifest


def copy_verified_archive(source, destination, *, expected_bytes=ARCHIVE_BYTES,
                          expected_sha256=SHA256, expected_sha512=SHA512):
    no_symlinks(source)
    descriptor = os.open(source, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream, destination.open('xb') as target:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
            raise ValueError('Archive must be a regular file')
        sha256, sha512, size = hashlib.sha256(), hashlib.sha512(), 0
        while True:
            block = stream.read(1024 * 1024)
            if not block:
                break
            size += len(block)
            if size > expected_bytes:
                raise ValueError('Archive exceeds pinned size')
            sha256.update(block); sha512.update(block); target.write(block)
        target.flush(); os.fsync(target.fileno())
    if size != expected_bytes or sha256.hexdigest() != expected_sha256 or sha512.hexdigest() != expected_sha512:
        raise ValueError('Archive does not match pinned size and checksums')


def checked_members(archive, expected):
    members, found = [], set()
    for item in archive:
        name = item.name.rstrip('/')
        relative = PurePosixPath(name)
        if (not name or relative.is_absolute() or '..' in relative.parts or str(relative) != name or
                name in found or name not in expected):
            raise ValueError('Unexpected or unsafe archive path')
        size = expected[name]
        if (size is None and not item.isdir() or size is not None and
                (not item.isfile() or item.size != size) or item.mode & 0o6000):
            raise ValueError('Unexpected archive type, mode, or file size')
        found.add(name); members.append(item)
    if found != set(expected):
        raise ValueError('Archive is missing pinned members')
    return members


def file_hash(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def extract_runtime(archive_path, target, manifest):
    target.mkdir(mode=0o755)
    target.chmod(0o755)
    with tarfile.open(archive_path, 'r:bz2') as archive:
        members = checked_members(archive, manifest['members'])
        for item in [member for member in members if member.isdir()] + [member for member in members if not member.isdir()]:
            destination = target / item.name.rstrip('/')
            if item.isdir():
                destination.mkdir(mode=0o755)
                destination.chmod(0o755)
                continue
            # No extractall: only white-listed regular files are written, without
            # retaining tar ownership, links, extended attributes, or setuid bits.
            with archive.extractfile(item) as source, destination.open('xb') as output:
                shutil.copyfileobj(source, output)
                output.flush(); os.fsync(output.fileno())
            destination.chmod(0o755)
    hashes = {name: file_hash(target / name) for name, size in manifest['members'].items() if size is not None}
    record = {'release': RELEASE, 'source': manifest['source'], 'archiveSha256': SHA256,
              'archiveSha512': SHA512, 'files': hashes}
    (target / 'installation.json').write_text(json.dumps(record, indent=2) + '\n')
    (target / 'installation.json').chmod(0o644)
    return record


def existing_runtime_matches(staged, record):
    secure_directory(TARGET)
    expected = set(record['files']) | {'gvisor-bin', 'installation.json'}
    actual = {path.relative_to(TARGET).as_posix() for path in TARGET.rglob('*')}
    if actual != expected:
        raise ValueError('Existing version directory contains different files')
    for name in expected:
        path = TARGET / name
        no_symlinks(path)
        info = path.stat()
        if info.st_uid != 0 or info.st_mode & 0o022:
            raise ValueError('Existing runtime has untrusted ownership or permissions')
        if name == 'gvisor-bin' and (not stat.S_ISDIR(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o755):
            raise ValueError('Existing sidecar directory must be readable and executable to all users')
        if name in record['files'] and (not stat.S_ISREG(info.st_mode) or
                stat.S_IMODE(info.st_mode) != 0o755 or file_hash(path) != record['files'][name]):
            raise ValueError('Existing runtime differs from the pinned archive')
    if (TARGET / 'installation.json').read_bytes() != (staged / 'installation.json').read_bytes():
        raise ValueError('Existing installation record differs from the pinned archive')


def private_write(path, data, mode=0o600):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(descriptor, 'wb') as stream:
        stream.write(data); stream.flush(); os.fsync(stream.fileno())
    os.chmod(path, mode)


def atomic_daemon(data, mode):
    descriptor, name = tempfile.mkstemp(prefix='.code-museum-runtime-', dir=DAEMON.parent)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(data); stream.flush(); os.fsync(stream.fileno())
        os.chmod(name, mode)
        os.replace(name, DAEMON)
        directory = os.open(DAEMON.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def unrelated_containers():
    identifiers = command(DOCKER + ['ps', '--quiet', '--no-trunc']).split()
    if not identifiers:
        return {}
    template = ('{"id":{{json .Id}},"pid":{{json .State.Pid}},"status":{{json .State.Status}},'
                '"running":{{json .State.Running}},"museum":{{json (index .Config.Labels "code-museum.executor")}}}')
    rows = command(DOCKER + ['inspect', '--format', template, *identifiers]).splitlines()
    states = {}
    for line in rows:
        row = read_json(line)
        if not row['museum']:
            states[row['id']] = {key: row[key] for key in ('pid', 'status', 'running')}
    return states


def docker_summary():
    return read_json(command(DOCKER + ['info', '--format', '{"default":{{json .DefaultRuntime}},"runtimes":{{json .Runtimes}}}']))


def daemon_pid():
    value = command(['systemctl', 'show', 'docker', '--property=MainPID', '--value'])
    if not value.isdecimal() or int(value) <= 1:
        raise ValueError('Docker daemon must already be running')
    return value


def configure_runtime(manifest):
    secure_directory(DAEMON.parent, create=True)
    no_symlinks(DAEMON)
    present = DAEMON.exists()
    original, mode = b'', 0o600
    if present:
        info = DAEMON.stat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022 or info.st_size > 1024 * 1024:
            raise ValueError('Docker configuration is not a protected root-owned regular file')
        original, mode = DAEMON.read_bytes(), stat.S_IMODE(info.st_mode)
    config = read_json(original) if present else {}
    if not isinstance(config, dict) or not isinstance(config.get('runtimes', {}), dict):
        raise ValueError('Docker configuration and runtimes must be objects')
    runtime = {key: manifest['runtime'][key] for key in ('path', 'runtimeArgs')}
    existing = config.get('runtimes', {}).get('runsc')
    if existing is not None and existing != runtime:
        raise ValueError('Refusing to overwrite an existing different runsc runtime')
    config.setdefault('runtimes', {})['runsc'] = runtime
    candidate = (json.dumps(config, indent=2) + '\n').encode()
    if command(['systemctl', 'show', 'docker', '--property=CanReload', '--value']) != 'yes':
        raise ValueError('Docker service cannot reload; a restart is not permitted')
    before_pid, before_info, before_containers = daemon_pid(), docker_summary(), unrelated_containers()
    secure_directory(BACKUPS.parent)
    secure_directory(BACKUPS, create=True, mode=0o700)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup = BACKUPS / (stamp + '-gvisor')
    backup.mkdir(mode=0o700)
    private_write(backup / 'daemon.before', original)
    private_write(backup / 'daemon.candidate.json', candidate)
    metadata = {'originalPresent': present, 'originalMode': mode, 'originalSha256': hashlib.sha256(original).hexdigest(),
                'candidateSha256': hashlib.sha256(candidate).hexdigest(), 'defaultRuntime': before_info['default'],
                'daemonPid': before_pid, 'unrelatedContainers': before_containers}
    private_write(backup / 'rollback.json', (json.dumps(metadata, indent=2) + '\n').encode())
    command(['dockerd', '--validate', '--config-file', str(backup / 'daemon.candidate.json')])
    if DAEMON.exists() != present or present and DAEMON.read_bytes() != original:
        raise ValueError('Docker configuration changed concurrently; nothing was applied')
    applied = False
    try:
        atomic_daemon(candidate, mode); applied = True
        command(['systemctl', 'reload', 'docker'])
        for attempt in range(20):
            after_info = docker_summary()
            registered = after_info.get('runtimes', {}).get('runsc', {})
            if registered.get('path') == runtime['path'] and registered.get('runtimeArgs') == runtime['runtimeArgs']:
                break
            time.sleep(0.25)
        else:
            raise ValueError('Docker did not register the pinned runtime after reload')
        if after_info['default'] != before_info['default'] or daemon_pid() != before_pid:
            raise ValueError('Docker default runtime or daemon process changed unexpectedly')
        if unrelated_containers() != before_containers:
            raise ValueError('Unrelated container identity, PID, or state changed during installation')
    except BaseException:
        if applied:
            if DAEMON.read_bytes() != candidate:
                raise ValueError('Concurrent Docker configuration edit; restore manually from the private backup') from None
            if present:
                atomic_daemon(original, mode)
            else:
                DAEMON.unlink()
            try:
                command(['systemctl', 'reload', 'docker'])
            except ValueError:
                raise ValueError('Original daemon bytes restored; reload failed, check the private backup') from None
        raise
    return {'backup': str(backup), 'defaultRuntimeUnchanged': True, 'daemonPidUnchanged': True,
            'unrelatedContainersUnchanged': True, 'unrelatedContainersChecked': len(before_containers)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True, help='Explicit pre-fetched pinned archive; never downloaded')
    parser.add_argument('--manifest', type=Path, default=Path(__file__).resolve().parents[1] / 'server/deploy/gvisor-runtime.json')
    parser.add_argument('--install', action='store_true', help='Root-only installation and Docker reload (never restart)')
    args = parser.parse_args()
    manifest = manifest_data(args.manifest.absolute())
    if args.install:
        if os.geteuid() != 0 or platform.system() != 'Linux' or platform.machine() != 'x86_64':
            parser.error('--install requires root on Linux x86_64')
        version = platform.release().split('.')
        if tuple(int(value) for value in version[:2]) < (5, 6):
            parser.error('gVisor requires Linux 5.6 or later')
        secure_directory(BASE.parent)
        secure_directory(BASE, create=True)
        if any(path.stat().st_mode & 0o055 != 0o055 for path in (BASE.parent, BASE)):
            raise ValueError('Runtime parent directories must be readable and executable to all users')
        if shutil.disk_usage(BASE).free < ARCHIVE_BYTES + sum(value or 0 for value in manifest['members'].values()) + 64 * 1024 * 1024:
            raise ValueError('Insufficient space for verified offline installation')
    # The private copy closes the hash/extraction race even when --archive is
    # supplied from an ordinary user's upload directory.
    with tempfile.TemporaryDirectory(prefix='.guest-sandbox-', dir=BASE if args.install else None) as temporary:
        temporary = Path(temporary)
        snapshot = temporary / 'archive.tar.bz2'
        copy_verified_archive(args.archive.absolute(), snapshot)
        with tarfile.open(snapshot, 'r:bz2') as archive:
            checked_members(archive, manifest['members'])
        result = {'status': 'verified', 'release': RELEASE, 'sha256': SHA256, 'sha512': SHA512, 'offline': True}
        if args.install:
            lock_path = BASE / '.install.lock'
            no_symlinks(lock_path)
            descriptor = os.open(lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
            with os.fdopen(descriptor, 'r+b') as lock:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                staged = temporary / RELEASE
                record = extract_runtime(snapshot, staged, manifest)
                if TARGET.exists():
                    existing_runtime_matches(staged, record)
                else:
                    os.replace(staged, TARGET)
                # runsc --version performs no installation or network access.
                if '20261102' not in command([str(TARGET / 'runsc'), '--version']):
                    raise ValueError('Installed runsc version differs from the pinned release')
                result.update(configure_runtime(manifest), status='installed', runtime='runsc', platform='systrap')
        print(json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, tarfile.TarError, KeyError, TypeError) as error:
        print(json.dumps({'status': 'failed', 'error': str(error) if isinstance(error, ValueError) else type(error).__name__}), file=sys.stderr)
        sys.exit(1)
