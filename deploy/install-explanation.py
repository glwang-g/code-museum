#!/usr/bin/env python3
"""Initial, guarded installation of the separate explanation service. Key arrives on stdin."""
import argparse
import datetime
import grp
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import shlex
import socket
import subprocess
import sys
import time
import urllib.request

FILES = {
    'server/explanations.py': '/opt/code-museum-explanation/explanations.py',
    'deploy/code-museum-explanation.service': '/etc/systemd/system/code-museum-explanation.service',
    'deploy/nginx-explanation.conf': '/etc/nginx/snippets/code-museum-explanation.conf',
    'deploy/nginx-explanation-rate.conf': '/etc/nginx/conf.d/code-museum-explanation-rate.conf',
}
SITE = Path('/etc/nginx/sites-enabled/code-museum')
UNIT = 'code-museum-explanation.service'
ANCHOR = 'include /etc/nginx/snippets/code-museum-messages.conf;'
INCLUDE = 'include /etc/nginx/snippets/code-museum-explanation.conf;'


def checked_bundle(directory, expected):
    manifest_path = directory / 'manifest.json'
    if manifest_path.is_symlink():
        raise ValueError('Manifest must be a regular file')
    raw = manifest_path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('Prepared bundle manifest mismatch')
    manifest = json.loads(raw)
    if set(manifest) != set(FILES):
        raise ValueError('Unexpected bundle input list')
    prepared = {}
    for name, digest in manifest.items():
        path = directory / name
        if path.is_symlink() or not path.is_file():
            raise ValueError('Bundle inputs must be regular files')
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != digest:
            raise ValueError('Bundle input mismatch: ' + name)
        prepared[name] = data
    return prepared


def private_config(raw):
    if len(raw) > 8192:
        raise ValueError('Private configuration too large')
    values = {}
    allowed = {'DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL', 'DEEPSEEK_MODEL', 'DEEPSEEK_DAILY_LIMIT', 'DEEPSEEK_ACTOR_DAILY_LIMIT'}
    for line in raw.decode().splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        match = re.fullmatch(r'([A-Z_]+)=(.*)', line)
        if not match or match[1] not in allowed or match[1] in values:
            raise ValueError('Unexpected private configuration assignment')
        parts = shlex.split(match[2], comments=True)
        if len(parts) != 1:
            raise ValueError('Invalid private configuration value')
        values[match[1]] = parts[0]
    key = values.get('DEEPSEEK_API_KEY', '')
    if not key or not key.isascii() or any(not 33 <= ord(c) <= 126 for c in key):
        raise ValueError('API key is missing or invalid')
    if values.get('DEEPSEEK_BASE_URL') != 'https://api.deepseek.com' or values.get('DEEPSEEK_MODEL') != 'deepseek-flash':
        raise ValueError('This initial installation expects the reviewed official DeepSeek configuration')
    if not 1 <= int(values.get('DEEPSEEK_ACTOR_DAILY_LIMIT', '20')) <= int(values.get('DEEPSEEK_DAILY_LIMIT', '100')) <= 10000:
        raise ValueError('Invalid spending limits')
    return raw


def command(*args):
    result = subprocess.run(args, capture_output=True)
    if result.returncode:
        raise RuntimeError('Command failed: ' + args[0])


def write(path, data, mode):
    path = Path(path)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--manifest-sha256', required=True)
    parser.add_argument('--site-sha256', required=True)
    args = parser.parse_args()
    if os.geteuid() != 0:
        parser.error('Administrator installation required')
    prepared = checked_bundle(args.bundle, args.manifest_sha256)
    private = private_config(sys.stdin.buffer.read(8193))
    if SITE.is_symlink() or hashlib.sha256(SITE.read_bytes()).hexdigest() != args.site_sha256:
        parser.error('Review the current regular Nginx site before installation')
    original = SITE.read_bytes()
    if original.decode().count(ANCHOR) != 1 or INCLUDE in original.decode():
        parser.error('Unexpected Nginx include layout')
    directories = ['/opt/code-museum-explanation', '/etc/code-museum-explanation']
    if any(Path(path).exists() for path in [*directories, *FILES.values()]):
        parser.error('Initial installer refuses to replace an existing installation')
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 4185))
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = Path('/var/backups/code-museum-explanation') / stamp
    backup.parent.mkdir(mode=0o700, exist_ok=True)
    if backup.parent.is_symlink() or backup.parent.stat().st_uid != 0 or backup.parent.stat().st_mode & 0o077:
        parser.error('Backup directory must be root-owned and private')
    backup.mkdir(mode=0o700)
    write(backup/'nginx-site', original, 0o600)
    try:
        account = pwd.getpwnam('code-museum-explanation')
        if account.pw_uid == 0 or account.pw_shell not in ('/usr/sbin/nologin', '/sbin/nologin'):
            parser.error('Unexpected service account')
    except KeyError:
        command('useradd', '--system', '--user-group', '--no-create-home', '--shell', '/usr/sbin/nologin', 'code-museum-explanation')
    created = []
    site_changed = False
    try:
        for directory in directories:
            Path(directory).mkdir(mode=0o700 if directory.startswith('/etc/') else 0o755)
        for name, target in FILES.items():
            write(target, prepared[name], 0o644); created.append(Path(target))
        env = Path('/etc/code-museum-explanation/private.env')
        write(env, private, 0o600); created.append(env)
        SITE.write_bytes(original.replace(ANCHOR.encode(), (ANCHOR+'\n    '+INCLUDE).encode()))
        site_changed = True
        command('nginx', '-t')
        command('systemctl', 'daemon-reload')
        command('systemctl', 'enable', '--now', UNIT)
        for attempt in range(30):
            try:
                with urllib.request.urlopen('http://127.0.0.1:4185/healthz', timeout=1) as response:
                    if json.load(response).get('available'):
                        break
            except OSError:
                time.sleep(.2)
        else:
            raise RuntimeError('Explanation service did not become healthy')
        command('systemctl', 'reload', 'nginx')
        receipt = {'backup': str(backup), 'manifestSha256': args.manifest_sha256,
                   'previousSiteSha256': args.site_sha256, 'siteSha256': hashlib.sha256(SITE.read_bytes()).hexdigest(),
                   'service': UNIT, 'files': {name: hashlib.sha256(data).hexdigest() for name, data in prepared.items()},
                   'scope': 'Independent no-Docker explanation service only; no executor, tunnel or worker change. No model request made by installer.'}
        write(backup/'receipt.json', (json.dumps(receipt, indent=2)+'\n').encode(), 0o600)
        print(json.dumps(receipt))
    except BaseException:
        subprocess.run(['systemctl', 'disable', '--now', UNIT], capture_output=True)
        if site_changed:
            SITE.write_bytes(original)
        for path in reversed(created):
            path.unlink(missing_ok=True)
        for directory in reversed(directories):
            if Path(directory).exists():
                Path(directory).rmdir()
        subprocess.run(['systemctl', 'daemon-reload'], capture_output=True)
        subprocess.run(['nginx', '-t'], capture_output=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], capture_output=True)
        raise


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Deliberately omit exception contents: private parsing must never echo credentials.
        print('Explanation installation failed ('+type(error).__name__+'); inspect reviewed preconditions and service health.', file=sys.stderr)
        sys.exit(1)
