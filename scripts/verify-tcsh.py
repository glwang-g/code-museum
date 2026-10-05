"""Run original samples with installed tcsh, without downloading or installing.

This is not a test of the original 2BSD C shell or a browser runtime.
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
    ('arithmetic-loop', '@ total = 0\nforeach number (1 2 3 4 5 6 7 8 9 10)\n  @ total = $total + $number\nend\necho "$total"\n', '55\n'),
    ('list-condition', 'set languages = (C Lisp tcsh)\nif ($#languages == 3) then\n  echo "$languages[2]"\nendif\n', 'Lisp\n'),
]
INVALID = 'echo "unterminated\n'


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def main():
    executable = shutil.which('tcsh')
    if not executable:
        raise SystemExit('tcsh is not installed; no evidence replaced.')
    env = os.environ.copy()
    env.pop('TCSHRC', None)
    version_command = ['tcsh', '--version']
    version = subprocess.run([executable, *version_command[1:]], capture_output=True, text=True, env=env, timeout=10)
    if version.returncode or not version.stdout.startswith('tcsh '):
        raise SystemExit('A working tcsh version could not be identified; no evidence replaced.')
    samples = []
    with tempfile.TemporaryDirectory(prefix='code-museum-tcsh-') as tmp:
        work = Path(tmp)
        def run(name, source, syntax=False):
            (work/(name+'.tcsh')).write_text(source)
            args = ['tcsh', '-f', *(['-n'] if syntax else []), name+'.tcsh']
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
    csh = shutil.which('csh')
    alias = bool(csh and os.path.samefile(executable, csh))
    report = {'id': 'tcsh', 'status': 'sample-passed', 'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'platform': platform.platform(), 'executable': executable, 'version': version.stdout.strip(),
              'versionCommand': version_command, 'versionExitCode': version.returncode,
              'cshExecutable': csh, 'cshIsSameFile': alias,
              'scope': 'Two original tcsh samples and syntax rejection with the installed version; -f skips startup files. Not original 2BSD C shell, exhaustive historical compatibility, full compliance or browser execution.',
              'samples': samples, 'invalidSyntax': {'sample': INVALID, 'sampleSha256': digest(INVALID), **invalid}}
    (ROOT/'data/audit/tcsh-runtime-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print('tcsh: arithmetic loop=55; list/condition=Lisp; invalid syntax rejected.')


if __name__ == '__main__':
    main()
