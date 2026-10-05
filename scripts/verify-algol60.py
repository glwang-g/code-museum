"""Check original ALGOL 60 samples with an already built GNU MARST directory.

No downloads, installation or third-party sample programs. This is a native
audit, not a browser runtime or a full language conformance check.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import platform
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = [
    ('sum', '55', 'begin\n integer i, total;\n total := 0;\n for i := 1 step 1 until 10 do total := total + i;\n outinteger(1, total); outstring(1, "\\n")\nend\n'),
    ('recursion', '720', 'begin\n integer procedure factorial(n);\n value n; integer n;\n begin factorial := if n = 0 then 1 else n * factorial(n - 1) end;\n outinteger(1, factorial(6)); outstring(1, "\\n")\nend\n'),
    ('by-name', '6', 'begin\n integer i; integer array a[1:3];\n integer procedure sum(k, x); integer k, x;\n begin integer total; total := 0;\n for k := 1 step 1 until 3 do total := total + x;\n sum := total end;\n a[1] := 1; a[2] := 2; a[3] := 3;\n outinteger(1, sum(i, a[i])); outstring(1, "\\n")\nend\n'),
]


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def verify(runtime_dir, cc):
    translator = runtime_dir / 'marst'
    library = runtime_dir / '.libs/libalgol.a'
    header = runtime_dir / 'algol.h'
    for file in [translator, library, header]:
        if not file.is_file():
            raise ValueError('Missing already built runtime input: ' + str(file))
    if not cc:
        raise ValueError('An installed C compiler is required')
    results = []
    with tempfile.TemporaryDirectory(prefix='museum-algol60-') as tmp:
        work = Path(tmp)
        def run(args):
            proc = subprocess.run(args, cwd=work, capture_output=True, text=True, timeout=30)
            return {'command': args, 'exitCode': proc.returncode, 'stdout': proc.stdout, 'stderr': proc.stderr}
        version = run([str(translator), '--version'])
        compiler = run([cc, '--version'])
        if version['exitCode'] or compiler['exitCode']:
            raise ValueError('Cannot identify supplied runtime/compiler')
        for name, expected, sample in SAMPLES:
            source, generated, binary = work/(name+'.alg'), work/(name+'.c'), work/name
            source.write_text(sample)
            commands = []
            for args in [
                [str(translator), str(source), '-o', str(generated)],
                [cc, '-std=c89', '-I'+str(runtime_dir), str(generated), str(library), '-lm', '-o', str(binary)],
                [str(binary)],
            ]:
                commands.append(run(args))
                if commands[-1]['exitCode']:
                    break
            passed = len(commands) == 3 and commands[-1]['exitCode'] == 0 and commands[-1]['stdout'].strip() == expected
            results.append({'name': name, 'sample': sample, 'sampleSha256': digest(source), 'expectedStdout': expected,
                            'commands': commands, 'status': 'sample-passed' if passed else 'sample-failed'})
        # A deliberately invalid original input must fail translation.
        invalid = work/'invalid.alg'
        invalid.write_text('begin integer ; end\n')
        rejection = run([str(translator), str(invalid), '-o', str(work/'invalid.c')])
    return {
        'id': 'algol-60', 'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'platform': platform.platform(), 'version': version['stdout'].strip(), 'compilerVersion': compiler['stdout'].strip(),
        'status': 'sample-passed' if all(r['status'] == 'sample-passed' for r in results) and rejection['exitCode'] != 0 else 'sample-failed',
        'scope': 'three-original-native-samples-and-invalid-syntax-only',
        'limitations': 'Native MARST translation and C89 compilation on this machine only. Captured compiler warnings remain part of the evidence. Not full conformance, portability or a museum browser runtime.',
        'runtimeFiles': {str(file): digest(file) for file in [translator, library, header]},
        'samples': results, 'invalidSyntax': {'sample': 'begin integer ; end\n', **rejection},
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime-dir', required=True, type=Path)
    parser.add_argument('--cc', default=shutil.which('clang'))
    parser.add_argument('--output', type=Path, default=ROOT/'data/audit/algol60-runtime-checks.json')
    parser.add_argument('--archive-sha256', help='Digest verified during separate source acquisition; not reconstructed by this check')
    args = parser.parse_args()
    if args.archive_sha256 and not re.fullmatch('[a-f0-9]{64}', args.archive_sha256):
        parser.error('archive SHA-256 must contain 64 lowercase hexadecimal digits')
    result = verify(args.runtime_dir.resolve(), args.cc)
    if args.archive_sha256:
        result['sourceAcquisition'] = {'url': 'https://ftp.gnu.org/gnu/marst/marst-2.8.tar.gz', 'sha256': args.archive_sha256, 'scope': 'Digest supplied from separately verified download; runtime files are hashed by this checker.'}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'status': result['status'], 'samples': [(r['name'], r['status']) for r in result['samples']],
                      'invalidSyntaxExit': result['invalidSyntax']['exitCode'], 'output': str(args.output)}, ensure_ascii=False))
    raise SystemExit(0 if result['status'] == 'sample-passed' else 1)
