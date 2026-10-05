"""Run original, harmless language samples against installed runtimes only.

This is an audit aid, not a site runtime or a conformance test. No installations,
downloads, or third-party source examples. Outputs are tied to this machine.
"""
import datetime
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
# Every arithmetic sample computes 1 + ... + 10. sed checks a substitution.
CASES = [
    ('python', 'python3', ['--version'], 'sample.py', 'print(sum(range(1, 11)))\n', None, ['python3', '{source}'], '55'),
    ('javascript', 'node', ['--version'], 'sample.js', 'let s=0; for(let i=1;i<=10;i++) s+=i; console.log(s);\n', None, ['node', '{source}'], '55'),
    ('c', 'clang', ['--version'], 'sample.c', '#include <stdio.h>\nint main(void){int s=0;for(int i=1;i<=10;i++)s+=i;printf("%d\\n",s);return 0;}\n', ['clang', '-std=c11', '{source}', '-o', '{binary}'], ['{binary}'], '55'),
    ('cpp', 'clang++', ['--version'], 'sample.cpp', '#include <iostream>\nint main(){int s=0;for(int i=1;i<=10;i++)s+=i;std::cout<<s<<"\\n";}\n', ['clang++', '-std=c++17', '{source}', '-o', '{binary}'], ['{binary}'], '55'),
    ('ruby', 'ruby', ['--version'], 'sample.rb', 's=0; (1..10).each { |i| s+=i }; puts s\n', None, ['ruby', '{source}'], '55'),
    ('perl', 'perl', ['-v'], 'sample.pl', 'my $s=0; for my $i (1..10) { $s+=$i; } print "$s\\n";\n', None, ['perl', '{source}'], '55'),
    ('bash', 'bash', ['--version'], 'sample.sh', 's=0; for ((i=1;i<=10;i++)); do s=$((s+i)); done; printf "%s\\n" "$s"\n', None, ['bash', '{source}'], '55'),
    ('awk', 'awk', ['-version'], 'sample.awk', 'BEGIN {s=0;for(i=1;i<=10;i++)s+=i;print s}\n', None, ['awk', '-f', '{source}'], '55'),
    ('sql', 'sqlite3', ['--version'], 'sample.sql', 'WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<10) SELECT sum(x) FROM n;\n', None, ['sqlite3', ':memory:'], '55'),
    ('lua', 'lua', ['-v'], 'sample.lua', 'local s=0; for i=1,10 do s=s+i end; print(s)\n', None, ['lua', '{source}'], '55'),
    ('go', 'go', ['version'], 'sample.go', 'package main\nimport "fmt"\nfunc main(){s:=0;for i:=1;i<=10;i++{s+=i};fmt.Println(s)}\n', ['go', 'build', '-o', '{binary}', '{source}'], ['{binary}'], '55'),
    ('java', 'java', ['-version'], 'Sample.java', 'class Sample {public static void main(String[] a){int s=0;for(int i=1;i<=10;i++)s+=i;System.out.println(s);}}\n', None, ['java', '{source}'], '55'),
    ('rust', 'rustc', ['--version'], 'sample.rs', 'fn main() { let sum: i32 = (1..=10).sum(); println!("{}", sum); }\n', ['rustc', '--edition=2021', '{source}', '-o', '{binary}'], ['{binary}'], '55'),
    ('sed', 'sed', [], 'sample.sed', 's/museum/verified/\n', None, ['sed', '-f', '{source}'], 'verified'),
]

def main():
    results = []
    with tempfile.TemporaryDirectory(prefix='code-museum-runtime-') as tmp:
        env = os.environ.copy()
        env.update(GOCACHE=tmp+'/go-cache', GOPATH=tmp+'/go-path', GOTOOLCHAIN='local', GOPROXY='off', GOSUMDB='off', TMPDIR=tmp)
        for ident, exe, version_args, filename, sample, compile_cmd, run_cmd, expected in CASES:
            result = {'id': ident, 'executable': shutil.which(exe), 'sample': sample, 'expectedStdout': expected, 'scope': 'single-original-sample-only'}
            if not result['executable']:
                result['status'] = 'not-installed'
                results.append(result)
                continue
            work = Path(tmp)/ident
            work.mkdir()
            source = work/filename
            source.write_text(sample)
            substitutions = {'source': str(source), 'binary': str(work/'program')}
            def call(args, stdin=None):
                return subprocess.run(args, input=stdin, text=True, capture_output=True, cwd=work, env=env, timeout=45)
            try:
                # Avoid invoking a rustup shim that could install a missing toolchain.
                # Resolve one of the already installed toolchains to its compiler directly.
                if ident == 'rust' and Path(result['executable']).resolve().name == 'rustup':
                    rustup = str(Path(result['executable']).resolve())
                    installed = call([rustup, 'toolchain', 'list'])
                    candidates = [line for line in installed.stdout.splitlines() if line.strip() and not line.startswith('no installed')]
                    if installed.returncode or not candidates:
                        result['status'] = 'not-installed'
                        results.append(result)
                        print(ident, result['status'], flush=True)
                        continue
                    selected = next((line for line in candidates if '(active' in line), candidates[0]).split()[0]
                    resolved = call([rustup, 'which', '--toolchain', selected, 'rustc'])
                    if resolved.returncode or not Path(resolved.stdout.strip()).is_file():
                        raise RuntimeError('Installed Rust compiler could not be resolved.')
                    result['toolchain'] = selected
                    result['executable'] = resolved.stdout.strip()
                if version_args:
                    version = call([result['executable'], *version_args])
                    result['version'] = (version.stdout+version.stderr).strip()[:1200]
                else:
                    result['version'] = 'System sed; '+platform.platform()
                commands = []
                for cmd in ([compile_cmd] if compile_cmd else []) + [run_cmd]:
                    args = [result['executable'] if part == exe else part.format(**substitutions) for part in cmd]
                    input_text = sample if ident == 'sql' else ('museum\n' if ident == 'sed' else None)
                    proc = call(args, input_text)
                    commands.append({'commandTemplate': cmd, 'exitCode': proc.returncode, 'stdout': proc.stdout, 'stderr': proc.stderr[:3000]})
                    if proc.returncode:
                        break
                result['commands'] = commands
                result['status'] = 'sample-passed' if proc.returncode == 0 and proc.stdout.strip() == expected else 'sample-failed'
            except Exception as exc:
                result.update(status='check-error', error=str(exc))
            results.append(result)
            print(ident, result['status'], flush=True)
    output = {'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'platform': platform.platform(), 'limitations': 'Only the included samples were executed. This does not prove complete standard compliance, every dialect, or an in-browser museum runtime.', 'results': results}
    target = ROOT/'data/audit/runtime-checks.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n')

if __name__ == '__main__':
    main()
