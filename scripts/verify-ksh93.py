"""Check original samples with an already installed ksh93; never install it.

This does not execute historical ksh88, prove conformance, or add a web runtime.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = [
    ('arithmetic-loop', 'typeset -i total=0\nfor ((i=1; i<=10; i++)); do total=$((total+i)); done\nprint -r -- "$total"\n', '55\n'),
    ('array-function', 'function double { print -r -- "$(( $1 * 2 ))"; }\ntypeset -a values\nvalues[0]=6\ndouble "${values[0]}"\n', '12\n'),
]
INVALID = 'if then\n  print -r -- broken\nfi\n'


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def main():
    executable = shutil.which('ksh')
    if not executable:
        raise SystemExit('ksh is not installed; no evidence replaced.')
    env = os.environ.copy()
    for name in ['ENV', 'FPATH', 'KSH_ENV']:
        env.pop(name, None)
    version_command = ['ksh', '-c', 'print -r -- "${.sh.version}"']
    version = subprocess.run([executable, *version_command[1:]], capture_output=True, text=True, env=env, timeout=10)
    if version.returncode or '93' not in version.stdout:
        raise SystemExit('A working ksh93 version could not be identified; no evidence replaced.')
    samples = []
    with tempfile.TemporaryDirectory(prefix='code-museum-ksh93-') as tmp:
        work = Path(tmp)
        def run(name, source, syntax=False):
            (work/(name+'.ksh')).write_text(source)
            args = ['ksh', *(['-n'] if syntax else []), name+'.ksh']
            result = subprocess.run([executable, *args[1:]], cwd=work, env=env, capture_output=True, text=True, timeout=10)
            return {'commandTemplate': args, 'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}
        for name, source, expected in SAMPLES:
            syntax = run(name, source, True)
            command = run(name, source)
            if syntax['exitCode'] or command['exitCode'] or command['stdout'] != expected:
                raise SystemExit(f'{name} failed; no evidence replaced.')
            samples.append({'name': name, 'sample': source, 'sampleSha256': digest(source), 'expectedStdout': expected, 'status': 'sample-passed', 'syntaxCheck': syntax, 'command': command})
        invalid = run('invalid-syntax', INVALID, True)
        if invalid['exitCode'] == 0:
            raise SystemExit('Invalid syntax was accepted; no evidence replaced.')
    report = {'id': 'korn-shell', 'status': 'sample-passed', 'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'platform': platform.platform(), 'executable': executable, 'version': version.stdout.strip(),
              'versionCommand': version_command, 'versionExitCode': version.returncode,
              'scope': 'Two original ksh93 samples and syntax rejection using the reported installed version; not historical ksh88, full compliance or browser execution.',
              'samples': samples, 'invalidSyntax': {'sample': INVALID, 'sampleSha256': digest(INVALID), **invalid}}
    (ROOT/'data/audit/ksh93-runtime-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print('ksh93: arithmetic loop=55; array/function=12; invalid syntax rejected.')


if __name__ == '__main__':
    main()
