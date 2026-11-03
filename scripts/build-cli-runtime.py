#!/usr/bin/env python3
"""Explicit offline preparation of the five CLI runtimes; never invoked by the site build."""
import argparse
import hashlib
import io
import json
import re
import subprocess
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTEXT = ROOT / 'server/runtimes/cli'


def verify_inputs():
    manifest = json.loads((CONTEXT / 'manifest.json').read_text())
    files = {row['file']: row['sha256'] for row in manifest['files']}
    actual = {p.relative_to(CONTEXT).as_posix() for p in CONTEXT.rglob('*') if p.is_file() and p.name != 'manifest.json'}
    if actual != set(files): raise ValueError('CLI build input inventory differs from the fixed manifest')
    for name, digest in files.items():
        if hashlib.sha256((CONTEXT / name).read_bytes()).hexdigest() != digest:
            raise ValueError('CLI build input hash mismatch: ' + name)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ssh-host', help='Explicit existing Linux Docker preparation host; no production service changes')
    parser.add_argument('--write-manifest', action='store_true', help='Record the actually built image ID and actual tool versions')
    args = parser.parse_args()
    if args.ssh_host and not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', args.ssh_host): parser.error('Invalid SSH host')
    manifest = verify_inputs()
    digest = hashlib.sha256((CONTEXT / 'manifest.json').read_bytes()).hexdigest()
    tag = 'code-museum-cli:' + digest
    def command(argv, **kw):
        if args.ssh_host:
            import shlex
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
    probes = {
        'typescript': ['/usr/local/bin/node', '/opt/typescript/lib/tsc.js', '--version'],
        'node': ['/usr/local/bin/node', '--version'], 'sql': ['/usr/bin/sqlite3', '--version'],
        'bash': ['/bin/bash', '--version'], 'awk': ['/usr/bin/gawk', '--version'], 'sed': ['/bin/sed', '--version'],
        'php': ['/usr/bin/php83', '-n', '--version'], 'perl': ['/usr/bin/perl', '-v'], 'xslt': ['/usr/bin/xsltproc', '--version']
    }
    outputs = {}
    for ident, probe in probes.items():
        outputs[ident] = command(['docker', 'run', '--rm', '--pull=never', '--network=none', '--read-only', '--cap-drop=ALL', '--user=65534:65534', '--entrypoint', probe[0], row['Id'], *probe[1:]], capture_output=True)
        combined = (outputs[ident].stdout + outputs[ident].stderr).decode()
        lines = [line for line in combined.splitlines() if line.strip()]
        versions[ident] = lines[0] if lines else ''
    print(json.dumps({'imageId': row['Id'], 'buildManifestSha256': digest, 'versions': versions}, indent=2))
    if args.write_manifest:
        path = ROOT / 'server/runtime-images.json'; runtimes = json.loads(path.read_text())
        managed = {'typescript', 'sql', 'bash', 'awk', 'sed', 'php', 'perl', 'xslt'}
        runtimes['runtimes'] = [r for r in runtimes['runtimes'] if r['id'] not in managed]
        executables = {'typescript': '/usr/local/bin/node', 'sql': '/usr/bin/sqlite3', 'bash': '/bin/bash', 'awk': '/usr/bin/gawk', 'sed': '/bin/sed',
                       'php': '/usr/bin/php83', 'perl': '/usr/bin/perl', 'xslt': '/usr/bin/xsltproc'}
        projects = {'typescript': 'https://www.typescriptlang.org/', 'sql': 'https://sqlite.org/', 'bash': 'https://www.gnu.org/software/bash/', 'awk': 'https://www.gnu.org/software/gawk/', 'sed': 'https://www.gnu.org/software/sed/',
                    'php': 'https://www.php.net/', 'perl': 'https://www.perl.org/', 'xslt': 'http://xmlsoft.org/XSLT/'}
        for ident in executables:
            if ident == 'typescript':
                version = 'TypeScript ' + versions[ident].removeprefix('Version ') + ' / Node ' + versions['node']
            elif ident == 'sql':
                version = 'SQLite ' + versions[ident].split()[0]
            elif ident == 'php':
                version = 'PHP ' + versions[ident].split()[1]
            elif ident == 'perl':
                match = re.search(r'v5\.[0-9]+\.[0-9]+', outputs[ident].stdout.decode())
                if not match: raise ValueError('Could not parse Perl version')
                version = 'Perl ' + match[0].removeprefix('v')
            elif ident == 'xslt':
                match = re.search(r'Using libxml (\d+), libxslt (\d+)', outputs[ident].stdout.decode() + outputs[ident].stderr.decode())
                if not match: raise ValueError('Could not parse libxslt version')
                def dotted(number): return '.'.join(str((number // divisor) % 100) for divisor in (10000, 100, 1))
                version = 'libxslt ' + dotted(int(match[2])) + ' / libxml2 ' + dotted(int(match[1]))
            else:
                version = versions[ident]
            runtimes['runtimes'].append(dict(id=ident, image=row['Id'], imageId=row['Id'], architecture='amd64', os='linux', version=version, memoryMiB=512 if ident == 'typescript' else 256, executable=executables[ident], source=projects[ident], buildManifestSha256=digest))
        path.write_text(json.dumps(runtimes, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__': main()
