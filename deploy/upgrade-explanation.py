#!/usr/bin/env python3
"""Upgrade only the protected model service source, preserving its key, unit and usage database."""
import argparse
import ast
import datetime
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import time
import urllib.request
import uuid

CODE = Path('/opt/code-museum-explanation/explanations.py')
SNIPPET = Path('/etc/nginx/snippets/code-museum-explanation.conf')
UNIT = 'code-museum-explanation.service'
BACKUPS = Path('/var/backups/code-museum-explanation')
GATE = '''location = /api/explanations {
    client_max_body_size 32k;
    client_body_buffer_size 32k;
    default_type application/json;
    add_header Cache-Control "no-store" always;
    add_header Retry-After "30" always;
    access_log off;
    return 503 '{"error":"代码检查服务正在更新，请稍后重试。"}';
}
'''.encode()


def checked_source(path, digest):
    if path.is_symlink() or not path.is_file():
        raise ValueError('Source must be a regular file')
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != digest:
        raise ValueError('Source digest mismatch')
    ast.parse(raw)
    return raw


def protected(path):
    s = path.lstat()
    if not stat.S_ISREG(s.st_mode) or s.st_uid != 0 or s.st_mode & 0o022:
        raise ValueError('Expected a protected root-owned regular file')
    return path.read_bytes()


def replace(path, data, mode=0o644):
    temporary = path.with_name('.review-' + uuid.uuid4().hex)
    try:
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def command(*args):
    r = subprocess.run(args, capture_output=True)
    if r.returncode:
        raise RuntimeError('Command failed: ' + args[0])
    return r.stdout.decode().strip()


def health(version):
    for _ in range(30):
        try:
            with urllib.request.urlopen('http://127.0.0.1:4185/healthz', timeout=1) as r:
                value = json.load(r)
                if value.get('available') and (version is None or value.get('schemaVersion') == version):
                    return
        except (OSError, ValueError):
            pass
        time.sleep(.2)
    raise RuntimeError('Model service health check failed')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--previous-sha256', required=True)
    parser.add_argument('--snippet-sha256', required=True)
    args = parser.parse_args()
    if os.geteuid() != 0:
        parser.error('Administrator upgrade required')
    new = checked_source(args.source, args.sha256)
    old, snippet = protected(CODE), protected(SNIPPET)
    if hashlib.sha256(old).hexdigest() != args.previous_sha256 or hashlib.sha256(snippet).hexdigest() != args.snippet_sha256:
        parser.error('Live source or Nginx snippet changed; review before upgrading')
    if old == new:
        parser.error('Source already matches; no upgrade needed')
    if BACKUPS.is_symlink() or BACKUPS.stat().st_uid != 0 or BACKUPS.stat().st_mode & 0o077:
        parser.error('Backup parent must be root-owned and private')
    if command('systemctl', 'show', UNIT, '--property=User', '--value') != 'code-museum-explanation':
        parser.error('Unexpected model service account')
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = BACKUPS / (stamp + '-review-upgrade'); backup.mkdir(mode=0o700)
    replace(backup/'explanations.py', old, 0o600); replace(backup/'nginx-snippet', snippet, 0o600)
    code_changed = False
    try:
        replace(SNIPPET, GATE); command('nginx', '-t'); command('systemctl', 'reload', 'nginx')
        # This service has no background threads: wait for existing HTTP/model handlers to finish.
        pid = int(command('systemctl', 'show', UNIT, '--property=MainPID', '--value'))
        if pid <= 0:
            raise RuntimeError('Expected a running model service')
        deadline = time.monotonic() + 45
        while len(list(Path('/proc', str(pid), 'task').iterdir())) > 1:
            if time.monotonic() >= deadline:
                raise RuntimeError('Existing model requests did not drain; upgrade cancelled')
            time.sleep(.2)
        replace(CODE, new); code_changed = True
        command('systemctl', 'restart', UNIT); health(2)
        replace(SNIPPET, snippet); command('nginx', '-t'); command('systemctl', 'reload', 'nginx')
        receipt = {'backup': str(backup), 'oldSourceSha256': args.previous_sha256, 'sourceSha256': args.sha256,
                   'snippetSha256': args.snippet_sha256, 'schemaVersion': 2,
                   'scope': 'Only the independent model service source restarted after draining HTTP handlers. Private environment, unit, usage database and all execution services preserved.'}
        replace(backup/'receipt.json', (json.dumps(receipt, indent=2)+'\n').encode(), 0o600)
        print(json.dumps(receipt))
    except BaseException:
        if code_changed:
            replace(CODE, old)
            command('systemctl', 'restart', UNIT); health(None)
        replace(SNIPPET, snippet); command('nginx', '-t'); command('systemctl', 'reload', 'nginx')
        raise


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Model service upgrade failed (' + type(error).__name__ + '); inspect the backup and service health.', file=__import__('sys').stderr)
        raise SystemExit(1)
