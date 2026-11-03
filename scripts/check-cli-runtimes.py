#!/usr/bin/env python3
"""Real fixed-image CLI checks in an isolated namespace; never touches the production API."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
FILES = ['scripts/check-cli-runtimes.py', 'server/executor.py', 'server/runtime-images.json', 'server/observability.py', 'server/mcp.py', 'server/mcp_http.py']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ssh-host')
    parser.add_argument('--output', default='/tmp/code-museum-cli-checks.json')
    args = parser.parse_args()
    if args.ssh_host:
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', args.ssh_host): parser.error('Invalid SSH host')
        bootstrap = """
import json,sys,tempfile,subprocess
from pathlib import Path
files=json.load(sys.stdin)
with tempfile.TemporaryDirectory(prefix='code-museum-cli-check-') as directory:
 root=Path(directory)
 for name,text in files.items():
  p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
 report=root/'report.json'
 subprocess.run(['python3',str(root/'scripts/check-cli-runtimes.py'),'--output',str(report)],check=True,stdout=sys.stderr)
 print(report.read_text())
"""
        import shlex
        run = subprocess.run(['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', args.ssh_host, 'python3 -c ' + shlex.quote(bootstrap)], input=json.dumps({f: (ROOT / f).read_text() for f in FILES}).encode(), stdout=subprocess.PIPE, check=True)
        report = json.loads(run.stdout); Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
        print('PASS', len(report['checks']), 'real Docker CLI checks; report', args.output)
        return
    sys.path.insert(0, str(ROOT / 'server'))
    from executor import DockerRunner, load_runtimes
    runtimes = load_runtimes(ROOT / 'server/runtime-images.json')
    runner = DockerRunner(runtimes, namespace='cli-check-' + secrets.token_hex(5)); runner.verify()
    checks = []
    def run(name, language, code, expected=None, state='completed', stdin='', cancel_after=None):
        job = dict(id=secrets.token_hex(16), language=language, code=code, stdin=stdin, cancel=threading.Event())
        timer = threading.Timer(cancel_after, job['cancel'].set) if cancel_after else None
        if timer: timer.start()
        try: result = runner.execute(job)
        finally:
            if timer: timer.cancel()
        assert result['state'] == state, (name, result)
        if expected is not None: assert result.get('stdout') == expected, (name, result)
        assert sum(len(result.get(k, '').encode()) for k in ('stdout', 'stderr', 'compilerStdout', 'compilerStderr')) <= 32768, name
        checks.append(dict(name=name, language=language, code=code, stdin=stdin, result=result))
        print('PASS ' + name, flush=True)
        return result
    try:
        run('Pascal ObjFPC compile and actual execution', 'pascal', 'program Museum; var total,i: integer; begin total:=0; for i:=1 to 10 do total:=total+i; writeln(total); end.', '55\n')
        run('Pascal edited function changes actual output', 'pascal', 'program Museum; function Twice(value: integer): integer; begin Twice:=value*2; end; begin writeln(Twice(6)); end.', '12\n')
        run('Pascal multi-line UTF-8 stdin', 'pascal', 'program Museum; var line: ansistring; begin while not eof(input) do begin readln(line); writeln(\'[\',line,\']\'); end; end.', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
        error = run('Pascal compile error prevents execution', 'pascal', 'program Museum; var n: integer; begin writeln(\'MUST_NOT_RUN\'); n:=\'wrong\'; end.', '', 'compile_error')
        assert 'runMs' not in error and error.get('compilerStdout', '') + error.get('compilerStderr', '')
        run('Pascal timeout terminates actual program', 'pascal', 'program Museum; begin while true do begin end; end.', state='timed_out')
        run('Pascal bounded output', 'pascal', 'program Museum; begin while true do writeln(\'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\'); end.', state='output_limit')
        run('Pascal cancellation removes active container', 'pascal', 'program Museum; begin while true do begin end; end.', state='cancelled', cancel_after=1)
        run('R base vector sum', 'r', 'cat(sum(1:10), "\\n", sep="")', '55\n')
        run('R edited statistical computation changes output', 'r', 'cat(mean(c(2,5,8)), "\\n", sep="")', '5\n')
        run('R multi-line UTF-8 stdin', 'r', 'lines <- readLines(file("stdin"), warn=FALSE); cat(paste0("[", lines, "]"), sep="\\n")', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
        run('R syntax error is rejected', 'r', 'x <- function( {', '', 'failed')
        run('R real runtime error', 'r', 'stop("intentional error")', '', 'failed')
        run('R unavailable CRAN package fails without restore', 'r', 'library(code_museum_missing_package)', '', 'failed')
        run('R task workspace can hold disposable files', 'r', 'writeLines("stop(1)", "/work/.Rprofile"); cat(sum(1:3), "\\n", sep="")', '6\n')
        run('R next task does not inherit files', 'r', 'cat(file.exists("/work/.Rprofile"), "\\n", sep="")', 'FALSE\n')
        run('R timeout terminates actual program', 'r', 'repeat {}', state='timed_out')
        run('R bounded output', 'r', 'repeat {cat("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\\n")}', state='output_limit')
        run('R cancellation removes active container', 'r', 'repeat {}', state='cancelled', cancel_after=1)
        run('R recovery after cancellation', 'r', 'cat(42, "\\n", sep="")', '42\n')
        run('TypeScript strict compile and actual execution', 'typescript', 'function sum(n:number):number {let total=0;for(let i=1;i<=n;i++)total+=i;return total;}console.log(sum(10));', '55\n')
        run('TypeScript edited source changes actual output', 'typescript', 'const values:number[]=[3,4,5];console.log(values.reduce((a,b)=>a+b,0));', '12\n')
        error = run('Type errors prevent JavaScript execution', 'typescript', 'console.log("MUST_NOT_RUN");const count:number="wrong";', '', 'compile_error')
        assert 'TS2322' in error.get('compilerStdout', '') + error.get('compilerStderr', '') and 'runMs' not in error
        run('SQLite create, insert and query', 'sql', 'CREATE TABLE n(value INTEGER);INSERT INTO n VALUES(2),(5),(8);SELECT SUM(value) FROM n;', '15\n')
        run('SQLite real recursive query', 'sql', 'WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<10) SELECT SUM(x) FROM n;', '55\n')
        run('SQLite database does not persist between tasks', 'sql', 'SELECT * FROM n;', '', 'failed')
        run('SQLite syntax error', 'sql', 'SELEC 1;', '', 'failed')
        for name, code in [('system command', '.shell echo MUST_NOT_RUN\n'), ('file attachment', "ATTACH DATABASE '/work/external.db' AS external;"), ('file read', "SELECT readfile('/etc/passwd');"), ('extension loading', "SELECT load_extension('/tmp/missing');")]:
            run('SQLite safe mode blocks ' + name, 'sql', code, '', 'failed')
        run('Bash actual arithmetic', 'bash', 'total=0;for ((i=1;i<=10;i++));do total=$((total+i));done;printf "%s\\n" "$total"', '55\n')
        run('Bash real multi-line stdin', 'bash', 'while IFS= read -r line;do printf "[%s]\\n" "$line";done', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
        run('Bash syntax error', 'bash', 'if then', '', 'failed')
        run('AWK actual arithmetic', 'awk', 'BEGIN{total=0;for(i=1;i<=10;i++)total+=i;print total}', '55\n')
        run('AWK real fields and multi-line stdin', 'awk', '{sum+=$2} END{print NR,sum}', '3 15\n', stdin='C 2\nLisp 5\nPython 8\n')
        run('AWK syntax error', 'awk', 'BEGIN { if ( }', '', 'failed')
        run('sed real substitution and multi-line stdin', 'sed', 's/world/Museum/g', 'Hello Museum\nMuseum river\n', stdin='Hello world\nworld river\n')
        run('sed address range', 'sed', '2,3s/[0-9]/X/g', 'one 1\ntwo X\nthree X\n', stdin='one 1\ntwo 2\nthree 3\n')
        run('sed invalid expression', 'sed', 's/[unterminated/x/', '', 'failed', stdin='hello\n')
        run('PHP actual arithmetic and output', 'php', '<?php $total=0; for($i=1;$i<=10;$i++){$total+=$i;} echo $total, PHP_EOL;', '55\n')
        run('PHP real multi-line stdin', 'php', '<?php while(($line=fgets(STDIN))!==false){echo "[".trim($line)."]\\n";}', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
        run('PHP syntax error', 'php', '<?php function (', '', 'failed')
        run('PHP disabled system command does not run', 'php', '<?php system("echo MUST_NOT_RUN"); echo "after";', '', 'failed')
        blocked = run('PHP open_basedir blocks host file read', 'php', '<?php $value=file_get_contents("/etc/passwd"); if($value===false){fwrite(STDERR,"blocked\\n"); exit(1);} echo $value;', '', 'failed')
        assert 'blocked' in blocked.get('stderr', ''), blocked
        run('Perl actual arithmetic and output', 'perl', 'my $total=0; $total+=$_ for 1..10; print "$total\\n";', '55\n')
        run('Perl UTF-8 source literals', 'perl', 'use utf8; print "博物馆\\n";', '博物馆\n')
        run('Perl real multi-line stdin', 'perl', 'while(my $line=<STDIN>){chomp $line; print "[$line]\\n";}', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
        run('Perl syntax error', 'perl', 'my $value = ;', '', 'failed')
        run('XSLT 1.0 transform with XML input', 'xslt', '<?xml version="1.0"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:output method="text"/><xsl:template match="/"><xsl:value-of select="sum(/museum/year)"/><xsl:text>&#10;</xsl:text></xsl:template></xsl:stylesheet>', '5921\n', stdin='<?xml version="1.0"?><museum><year>1972</year><year>1958</year><year>1991</year></museum>')
        run('XSLT edited template changes output', 'xslt', '<?xml version="1.0"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:output method="text"/><xsl:template match="/"><xsl:for-each select="museum/y"><xsl:value-of select="."/><xsl:text>,</xsl:text></xsl:for-each></xsl:template></xsl:stylesheet>', '8,9,10,', stdin='<?xml version="1.0"?><museum><y>8</y><y>9</y><y>10</y></museum>')
        run('XSLT invalid XPath is rejected', 'xslt', '<?xml version="1.0"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:template match="/"><xsl:value-of select="//*["/></xsl:template></xsl:stylesheet>', '', 'failed', stdin='<museum/>')
        run('Fortran 2008 compile and actual execution', 'fortran', 'program museum\n  implicit none\n  integer :: total, i\n  total = 0\n  do i = 1, 10\n    total = total + i\n  end do\n  print \'(I0)\', total\nend program museum\n', '55\n')
        run('Fortran edited source changes actual output', 'fortran', 'program museum\n  implicit none\n  integer :: values(3), i\n  values = (/3, 4, 5/)\n  print \'(I0)\', sum(values)\nend program museum\n', '12\n')
        error = run('Fortran compile error prevents execution', 'fortran', 'program museum\n  integer :: x\n  x = \nend program museum\n', '', 'compile_error')
        assert 'runMs' not in error
        run('Fortran timeout terminates the real program', 'fortran', 'program museum\n  do\n  end do\nend program museum\n', state='timed_out')
        run('C# compile and actual execution', 'csharp', 'using System; class Museum { static void Main() { Console.WriteLine(1972 + 1958 + 1991); } }', '5921\n')
        run('C# edited source changes actual output', 'csharp', 'using System; using System.Linq; class Museum { static void Main() { int[] values = { 3, 4, 5 }; Console.WriteLine(values.Sum()); } }', '12\n')
        run('C# real multi-line stdin', 'csharp', 'using System; class Museum { static void Main() { string line; while ((line = Console.ReadLine()) != null) Console.WriteLine("[" + line + "]"); } }', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
        error = run('C# compile error prevents execution', 'csharp', 'using System; class Museum { static void Main() { Console.WriteLine("MUST_NOT_RUN"); int value = "wrong"; } }', '', 'compile_error')
        assert 'CS0029' in error.get('compilerStdout', '') + error.get('compilerStderr', '') and 'runMs' not in error
        run('C# cannot restore missing NuGet packages', 'csharp', 'using Newtonsoft.Json; class Museum { static void Main() { } }', '', 'compile_error')
        run('C# timeout terminates the real program', 'csharp', 'class Museum { static void Main() { while (true) { } } }', state='timed_out')
        run('Bash no host socket, non-root and read-only root', 'bash', 'id -u;test ! -e /var/run/docker.sock && echo no-socket;if echo bad >/etc/cm-write-test 2>/dev/null;then echo bad;else echo root-blocked;fi', '65534\nno-socket\nroot-blocked\n')
        run('Bash task file is disposable', 'bash', 'echo 42 >/work/marker;cat /work/marker', '42\n')
        run('Bash next task has no old file', 'bash', 'test ! -e /work/marker && echo isolated', 'isolated\n')
        for language, code, stdin in [('typescript', 'while(true){}', ''), ('sql', 'WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n) SELECT sum(x) FROM n;', ''), ('bash', 'while :; do :; done', ''), ('awk', 'BEGIN {while(1){}}', ''), ('sed', ':again\nb again', 'hello\n')]:
            run(language + ' timeout terminates the real program', language, code, state='timed_out', stdin=stdin)
        run('Bash output cap', 'bash', 'while :;do printf "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\\n";done', state='output_limit')
        run('AWK cancellation removes active container', 'awk', 'BEGIN {while(1){}}', state='cancelled', cancel_after=1)
        run('Recovery after timeout and cancellation', 'sed', 's/a/ready/', 'ready\n', stdin='a\n')
    finally: runner.cleanup_stale()
    remaining = subprocess.check_output(['docker', 'ps', '-a', '--filter', 'label=' + runner.label, '--format', '{{.Names}}']).decode().strip()
    assert not remaining, remaining
    report = dict(checkedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), scope='Actual isolated Docker runc on the existing Linux preparation host; no production API changes, no downloads during tasks, not a container escape proof.', inputs={f: hashlib.sha256((ROOT / f).read_bytes()).hexdigest() for f in FILES}, runtimes=[runtimes[k] for k in ['typescript','sql','bash','awk','sed','php','perl','xslt','fortran','csharp','pascal','r']], checks=checks, leftoverContainers=0)
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')


if __name__ == '__main__': main()
