#!/usr/bin/env python3
"""Explicit admin install of token-only executor on the existing Code Museum host.
Run from a reviewed source checkout/staging directory using sudo. No token output.
Does not change CI privileges, anonymous access, other sites, or statistics data.
"""
import fcntl
import grp
import hashlib
import json
import os
from pathlib import Path
import pwd
import secrets
import shutil
import stat
import sqlite3
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ACCOUNT = 'code-museum-executor'
SITE = Path('/etc/nginx/sites-available/code-museum')
UNIT = Path('/etc/systemd/system/code-museum-executor.service')
CODE = Path('/opt/code-museum-executor')
CONFIG = Path('/etc/code-museum-executor')
BACKUP = Path('/var/backups/code-museum-executor') / time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())

def command(*args):
    subprocess.run(args, check=True)

def write(path, payload, mode=0o644):
    temporary = path.with_name(path.name + '.install-tmp')
    temporary.write_bytes(payload)
    temporary.chmod(mode)
    os.chown(temporary, 0, 0)
    os.replace(temporary, path)

def main():
    if os.geteuid() != 0:
        raise SystemExit('Administrator installation requires sudo')
    for file in ['server/executor.py','server/observability.py','server/mcp.py','server/mcp_http.py','server/runtime-images.json','server/deploy/code-museum-executor.service','server/deploy/executor-private.nginx.conf']:
        if not (ROOT / file).is_file(): raise SystemExit('Missing reviewed input: ' + file)
    # Verify platform/images before making persistent changes; never pull at install time.
    sys.path.insert(0, str(ROOT / 'server'))
    from executor import DockerRunner, load_runtimes
    info = json.loads(subprocess.check_output(['docker','info','--format','{{json .}}']))
    if info.get('CgroupVersion') != '2': raise SystemExit('Requires Docker cgroup v2')
    runtimes = load_runtimes(ROOT / 'server/runtime-images.json')
    for row in runtimes.values():
        image = json.loads(subprocess.check_output(['docker','image','inspect',row['image']]))[0]
        if image['Id'] != row['imageId'] or image['Architecture'] != row['architecture']:
            raise SystemExit('Pinned image/platform mismatch')
    # Refuse installation while an SSH prototype owns the common lock.
    try: lock_fd = os.open('/tmp/code-museum-executor.lock',os.O_RDWR|os.O_NOFOLLOW)
    except FileNotFoundError: lock_fd = os.open('/tmp/code-museum-executor.lock',os.O_CREAT|os.O_EXCL|os.O_RDWR|os.O_NOFOLLOW,0o600)
    lock = os.fdopen(lock_fd,'a')
    lock_stat = os.fstat(lock.fileno())
    if not stat.S_ISREG(os.fstat(lock.fileno()).st_mode): raise SystemExit('Invalid singleton lock')
    was_active = subprocess.run(['systemctl','is-active','--quiet','code-museum-executor']).returncode == 0
    was_enabled = subprocess.run(['systemctl','is-enabled','--quiet','code-museum-executor'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode == 0
    nginx = SITE.read_bytes()
    marker = b'    # Code Museum private Docker executor (administrator managed)\n    include /etc/nginx/snippets/code-museum-executor.conf;\n'
    if marker not in nginx:
        anchor = b'    location = /api/visits {'
        if nginx.count(anchor) != 1: raise SystemExit('Unexpected site configuration; manual review required')
        nginx = nginx.replace(anchor,marker + anchor)
    snippet = Path('/etc/nginx/snippets/code-museum-executor.conf')
    BACKUP.mkdir(parents=True,exist_ok=False);BACKUP.chmod(0o700)
    files = [SITE,UNIT,snippet,*[CODE/name for name in ['executor.py','runtime-images.json','observability.py','mcp.py','mcp_http.py']]]
    old = {str(p): p.read_bytes() if p.exists() else None for p in files}
    for i,(name,payload) in enumerate(old.items()):
        if payload is not None: (BACKUP/str(i)).write_bytes(payload)
    (BACKUP/'manifest.json').write_text(json.dumps({'files':list(old),'wasActive':was_active,'wasEnabled':was_enabled},indent=2))
    if was_active: command('systemctl','stop','code-museum-executor')
    try: fcntl.flock(lock, fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:
        if was_active: subprocess.run(['systemctl','start','code-museum-executor'],check=True)
        raise SystemExit('Another private executor owns the production lock; existing service restored')
    try:
        try: account = pwd.getpwnam(ACCOUNT)
        except KeyError:
            command('useradd','--system','--user-group','--no-create-home','--home-dir','/nonexistent','--shell','/usr/sbin/nologin',ACCOUNT)
            account = pwd.getpwnam(ACCOUNT)
        if account.pw_shell != '/usr/sbin/nologin': raise RuntimeError('Unexpected execution account')
        grp.getgrnam('docker')
        CODE.mkdir(exist_ok=True);CODE.chmod(0o755);os.chown(CODE,0,0)
        CONFIG.mkdir(exist_ok=True);CONFIG.chmod(0o700);os.chown(CONFIG,0,0)
        secret = CONFIG/'private.env'
        if not secret.exists(): write(secret,('EXECUTOR_TOKEN='+secrets.token_hex(32)+'\n').encode(),0o600)
        if secret.is_symlink() or secret.stat().st_uid != 0 or secret.stat().st_mode & 0o077:
            raise RuntimeError('Private environment must be root-owned and mode 0600')
        for name in ['executor.py','runtime-images.json','observability.py','mcp.py','mcp_http.py']: write(CODE/name,(ROOT/'server'/name).read_bytes())
        metrics = Path('/var/lib/code-museum-executor')
        if metrics.is_symlink(): raise RuntimeError('Invalid metrics directory')
        if not metrics.exists(): metrics.mkdir(mode=0o700);os.chown(metrics,account.pw_uid,account.pw_gid)
        if metrics.stat().st_uid != account.pw_uid or metrics.stat().st_mode & 0o077: raise RuntimeError('Metrics directory must belong only to executor account')
        database=metrics/'metrics.sqlite'
        if database.exists():
            if database.is_symlink() or database.stat().st_uid!=account.pw_uid: raise RuntimeError('Invalid metrics database owner')
            with sqlite3.connect('file:'+str(database)+'?mode=ro',uri=True) as original, sqlite3.connect(BACKUP/'metrics.sqlite') as copy: original.backup(copy)
        write(UNIT,(ROOT/'server/deploy/code-museum-executor.service').read_bytes())
        snippet.parent.mkdir(exist_ok=True)
        write(snippet,(ROOT/'server/deploy/executor-private.nginx.conf').read_bytes())
        write(SITE,nginx)
        os.fchown(lock.fileno(),account.pw_uid,account.pw_gid);os.fchmod(lock.fileno(),0o600)
        command('nginx','-t')
        command('systemd-analyze','verify',str(UNIT))
        command('systemctl','daemon-reload')
        lock.close()
        command('systemctl','enable','--now','code-museum-executor')
        for _ in range(100):
            try:
                with urllib.request.urlopen('http://127.0.0.1:4181/api/runtimes',timeout=1) as response:
                    if json.load(response)['available']: break
            except OSError: time.sleep(.1)
        else: raise RuntimeError('Executor did not become ready')
        # Check new authenticated surfaces before exposing the Nginx configuration.
        from mcp_http import readonly_token
        token=secret.read_text().strip().removeprefix('EXECUTOR_TOKEN=')
        request=urllib.request.Request('http://127.0.0.1:4181/api/executor-status',headers={'Authorization':'Bearer '+token,'X-Execution-Session':'0'*32})
        with urllib.request.urlopen(request,timeout=5) as response:
            status=json.load(response)
            if not status['available'] or not status['metrics']['persistent']: raise RuntimeError('Persistent metrics unavailable')
        request=urllib.request.Request('http://127.0.0.1:4181/mcp',data=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/list'}).encode(),headers={'Authorization':'Bearer '+readonly_token(token),'Content-Type':'application/json','Accept':'application/json','MCP-Protocol-Version':'2025-06-18'})
        with urllib.request.urlopen(request,timeout=5) as response:
            tools=json.load(response)['result']['tools']
            if len(tools)!=5 or not all(t['annotations']['readOnlyHint'] for t in tools): raise RuntimeError('Read-only MCP unavailable')
        command('systemctl','reload','nginx')
        evidence = {'installedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'codeHashes':{name:hashlib.sha256((CODE/name).read_bytes()).hexdigest() for name in ['executor.py','runtime-images.json','observability.py','mcp.py','mcp_http.py']},'backup':str(BACKUP),'anonymousExecution':False,'ciDockerPrivileges':False}
        write(CONFIG/'deployment.json',(json.dumps(evidence,indent=2)+'\n').encode(),0o600)
        print('Installed private executor; credentials remain in root-only server configuration. Backup: '+str(BACKUP))
    except Exception:
        subprocess.run(['systemctl','stop','code-museum-executor'])
        os.fchown(lock_fd,lock_stat.st_uid,lock_stat.st_gid) if not lock.closed else os.chown('/tmp/code-museum-executor.lock',lock_stat.st_uid,lock_stat.st_gid)
        for name,payload in old.items():
            p = Path(name)
            if payload is None: p.unlink(missing_ok=True)
            else: write(p,payload)
        if not was_enabled: subprocess.run(['systemctl','disable','code-museum-executor'],stderr=subprocess.DEVNULL)
        subprocess.run(['systemctl','daemon-reload'])
        if was_active: subprocess.run(['systemctl','start','code-museum-executor'])
        subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True)
        raise
    finally:
        if not lock.closed: lock.close()

if __name__ == '__main__': main()
