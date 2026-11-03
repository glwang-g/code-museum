#!/usr/bin/env python3
"""Explicit offline Pascal/R image preparation from checked-in Debian packages."""
import argparse
import hashlib
import io
import json
import re
import shlex
import subprocess
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTEXT = ROOT / 'server/runtimes/pascal-r'


def verify_inputs():
    manifest = json.loads((CONTEXT / 'manifest.json').read_text())
    files = {row['file']: row['sha256'] for row in manifest['files']}
    actual = {p.relative_to(CONTEXT).as_posix() for p in CONTEXT.rglob('*') if p.is_file() and p.name != 'manifest.json'}
    if actual != set(files): raise ValueError('Pascal/R inventory differs from fixed manifest')
    for name, digest in files.items():
        if hashlib.sha256((CONTEXT / name).read_bytes()).hexdigest() != digest:
            raise ValueError('Pascal/R input hash mismatch: ' + name)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ssh-host')
    parser.add_argument('--write-manifest', action='store_true')
    args = parser.parse_args()
    if args.ssh_host and not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', args.ssh_host): parser.error('Invalid SSH host')
    manifest = verify_inputs()
    digest = hashlib.sha256((CONTEXT / 'manifest.json').read_bytes()).hexdigest()
    tag = 'code-museum-pascal-r:' + digest
    def command(argv, **kw):
        if args.ssh_host:
            argv = ['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', args.ssh_host, shlex.join(argv)]
        return subprocess.run(argv, check=True, **kw)
    archive = io.BytesIO()
    with tarfile.open(fileobj=archive, mode='w') as tar:
        for row in manifest['files']:
            raw = (CONTEXT / row['file']).read_bytes()
            entry = tarfile.TarInfo(row['file']); entry.size = len(raw); entry.mtime = manifest['sourceDateEpoch']; entry.mode = 0o644
            tar.addfile(entry, io.BytesIO(raw))
    command(['docker', 'build', '--network=none', '--pull=false', '--provenance=false', '--platform=linux/amd64', '--tag', tag, '-'], input=archive.getvalue())
    row = json.loads(command(['docker', 'image', 'inspect', tag], capture_output=True).stdout)[0]
    if row['Architecture'] != 'amd64' or row['Os'] != 'linux': raise ValueError('Unexpected built platform')
    versions = {}
    for ident, exe, flag in [('pascal','/usr/bin/fpc','-iV'),('r','/usr/bin/Rscript','--version')]:
        out = command(['docker','run','--rm','--pull=never','--network=none','--read-only','--cap-drop=ALL','--user=65534:65534','--entrypoint',exe,row['Id'],flag],capture_output=True)
        versions[ident] = (out.stdout + out.stderr).decode().strip()
    print(json.dumps({'imageId':row['Id'],'buildManifestSha256':digest,'versions':versions},indent=2))
    if args.write_manifest:
        path = ROOT / 'server/runtime-images.json'; data = json.loads(path.read_text())
        data['runtimes'] = [r for r in data['runtimes'] if r['id'] not in versions]
        for ident, exe, source in [('pascal','/usr/bin/fpc','https://www.freepascal.org/'),('r','/usr/bin/Rscript','https://www.r-project.org/')]:
            version = 'Free Pascal ' + versions[ident] if ident == 'pascal' else versions[ident]
            data['runtimes'].append(dict(id=ident,image=row['Id'],imageId=row['Id'],architecture='amd64',os='linux',version=version,memoryMiB=512,executable=exe,source=source,buildManifestSha256=digest))
        path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')


if __name__ == '__main__': main()
