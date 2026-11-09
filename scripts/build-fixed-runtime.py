#!/usr/bin/env python3
"""Explicit offline image preparation from fixed source or Debian packages."""
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
CONTEXT = None
INPUT_PATHS = {}
BCPL_MANIFEST_SHA256 = 'dae20967456a7a8753be8c99290776986581d63343d88b7628c1b67b29da9776'
BCPL_PRIVATE_FILES = {
    'assets/bcpl-20261109.tar.gz.part00',
    'assets/bcpl-20261109.tar.gz.part01',
    'assets/bcpl-20261109.tar.gz.part02',
    'assets/cintcode-noninteractive.patch',
    'licenses/upstream-README.txt',
    'metadata/upstream-sysboot.b',
}


def verify_inputs(private_directory=None):
    raw_manifest = (CONTEXT / 'manifest.json').read_bytes()
    manifest = json.loads(raw_manifest)
    if manifest.get('schemaVersion') != 1 or manifest.get('platform') != 'linux/amd64' or not re.fullmatch(r'(?:gcc|eclipse-temurin)@sha256:[a-f0-9]{64}', manifest.get('baseImage', '')):
        raise ValueError('Invalid fixed runtime manifest')
    files = {}
    for row in manifest['files']:
        name = row['file']
        if not re.fullmatch(r'(Dockerfile|NOTICE\.md|acquisition\.json|(?:assets|licenses|metadata)/[A-Za-z0-9_.+~-]+)', name) or name in files or not re.fullmatch('[a-f0-9]{64}', row['sha256']):
            raise ValueError('Invalid or duplicate runtime input path')
        files[name] = row
    actual = {p.relative_to(CONTEXT).as_posix() for p in CONTEXT.rglob('*') if p.is_file() and p.name != 'manifest.json'}
    private_files = set()
    if CONTEXT.name == 'bcpl':
        policy_file = ROOT / 'data/runtime-input-policy.json'
        if policy_file.is_symlink():
            raise ValueError('BCPL private-input policy must not be a symlink')
        policy = json.loads(policy_file.read_text())
        restricted = policy.get('runtimes', {}).get('bcpl', {})
        names = restricted.get('privateFiles')
        if (policy.get('schemaVersion') != 1 or set(policy.get('runtimes', {})) != {'bcpl'}
                or restricted.get('manifestSha256') != BCPL_MANIFEST_SHA256
                or hashlib.sha256(raw_manifest).hexdigest() != BCPL_MANIFEST_SHA256
                or not isinstance(names, list) or len(names) != len(BCPL_PRIVATE_FILES)
                or any(not isinstance(name, str) for name in names) or set(names) != BCPL_PRIVATE_FILES
                or restricted.get('publicRepoToolchainComplete') is not False
                or restricted.get('source') != 'https://www.cl.cam.ac.uk/~mr10/BCPL.html'
                or not isinstance(restricted.get('note'), str) or not restricted['note'].strip()):
            raise ValueError('BCPL private-input policy differs from the pinned build')
        private_files = BCPL_PRIVATE_FILES
    elif private_directory is not None:
        raise ValueError('--private-input-directory is only supported for the restricted BCPL inputs')
    if actual - set(files) or (set(files) - actual) - private_files:
        raise ValueError('Runtime inventory differs from fixed manifest')
    if private_directory is not None:
        private_directory = Path(private_directory)
        if not private_directory.is_absolute() or not private_directory.is_dir():
            raise ValueError('Expected an existing absolute private-input directory')
        if any(p.is_symlink() for p in [private_directory, *private_directory.parents]):
            raise ValueError('Private-input directory must not be a symlink')
    INPUT_PATHS.clear()
    for name, row in files.items():
        file = (private_directory if private_directory is not None and name in private_files else CONTEXT) / name
        if not file.exists() and name in private_files:
            raise ValueError('BCPL fixed private inputs are required; provide --private-input-directory /absolute/path/to/authorized-inputs')
        if any(p.is_symlink() for p in [file, *file.parents]):
            raise ValueError('Runtime inputs must not contain symlinks: ' + name)
        if file.is_symlink() or file.stat().st_size != row['bytes'] or hashlib.sha256(file.read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('Runtime input hash mismatch: ' + name)
        INPUT_PATHS[name] = file
    dockerfile = (CONTEXT / 'Dockerfile').read_text()
    bases = re.findall(r'^\s*FROM\s+([^\r\n]+)$', dockerfile, re.M | re.I)
    if [base.strip() for base in bases] != [manifest['baseImage']] or re.search(r'^\s*ADD\s+(?:--\S+\s+)*https?://', dockerfile, re.M | re.I):
        raise ValueError('Runtime requires the declared pinned base and local inputs')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', required=True)
    parser.add_argument('--ssh-host')
    parser.add_argument('--base-oci-layout', help='Absolute local/remote OCI layout path for the same pinned base digest; prevents registry metadata access')
    parser.add_argument('--private-input-directory', type=Path, help='Absolute directory of already acquired, authorized fixed BCPL inputs; never downloads them')
    parser.add_argument('--write-manifest', action='store_true')
    args = parser.parse_args()
    if args.ssh_host and not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', args.ssh_host): parser.error('Invalid SSH host')
    if args.base_oci_layout and (not re.fullmatch(r'/[A-Za-z0-9_./-]+', args.base_oci_layout) or '..' in Path(args.base_oci_layout).parts): parser.error('Expected an absolute OCI layout path')
    if not re.fullmatch(r'[a-z][a-z0-9-]*', args.directory): parser.error('Invalid runtime directory')
    global CONTEXT
    CONTEXT = ROOT / 'server/runtimes' / args.directory
    manifest = verify_inputs(args.private_input_directory)
    runtime = manifest['runtime']
    digest = hashlib.sha256((CONTEXT / 'manifest.json').read_bytes()).hexdigest()
    tag = 'code-museum-' + args.directory + ':' + digest
    def command(argv, **kw):
        if args.ssh_host:
            argv = ['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', args.ssh_host, shlex.join(argv)]
        return subprocess.run(argv, check=True, **kw)
    archive = io.BytesIO()
    with tarfile.open(fileobj=archive, mode='w') as tar:
        for row in manifest['files']:
            raw = INPUT_PATHS[row['file']].read_bytes()
            entry = tarfile.TarInfo(row['file']); entry.size = len(raw); entry.mtime = manifest['sourceDateEpoch']; entry.mode = 0o644
            tar.addfile(entry, io.BytesIO(raw))
    base_context = ['--build-context', manifest['baseImage'] + '=oci-layout://' + args.base_oci_layout + '@' + manifest['baseImage'].split('@')[1]] if args.base_oci_layout else []
    command(['docker', 'build', '--network=none', '--pull=false', '--provenance=false', '--platform=linux/amd64', *base_context, '--tag', tag, '-'], input=archive.getvalue())
    row = json.loads(command(['docker', 'image', 'inspect', tag], capture_output=True).stdout)[0]
    if row['Architecture'] != 'amd64' or row['Os'] != 'linux': raise ValueError('Unexpected built platform')
    out = command(['docker','run','--rm','--pull=never','--network=none','--read-only','--cap-drop=ALL','--user=65534:65534','--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16m,mode=1777','--tmpfs=/work:rw,noexec,nosuid,nodev,size=16m,mode=1777','--env=HOME=/work','--entrypoint',runtime['executable'],row['Id'],*runtime['versionArgs']],capture_output=True)
    if runtime['versionPattern'] not in (out.stdout + out.stderr).decode(): raise ValueError('Unexpected runtime version')
    print(json.dumps({'imageId':row['Id'],'buildManifestSha256':digest,'version':manifest['version']},indent=2))
    if args.write_manifest:
        path = ROOT / 'server/runtime-images.json'; data = json.loads(path.read_text())
        data['runtimes'] = [r for r in data['runtimes'] if r['id'] != runtime['id']]
        data['runtimes'].append(dict(id=runtime['id'],image=row['Id'],imageId=row['Id'],architecture='amd64',os='linux',version=manifest['version'],memoryMiB=runtime['memoryMiB'],executable=runtime['executable'],source=manifest['source'],buildManifestSha256=digest))
        path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')


if __name__ == '__main__': main()
