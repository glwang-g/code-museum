#!/usr/bin/env python3
"""Real fixed-image planned-language checks in an isolated namespace; never touches the production API."""
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
FILES = ['scripts/check-planned-runtimes.py', 'server/executor.py', 'server/runtime-images.json', 'server/observability.py', 'server/mcp.py', 'server/mcp_http.py', 'data/audit/algol60-runtime-checks.json']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--language', choices=['algol-60','common-lisp','prolog','forth','racket','smalltalk','cobol','ada','clojure','ocaml','haskell','kotlin','groovy','erlang','elixir','tcl','standard-ml','scala','visual-basic.net','f-sharp','d','nim','zig','swift','dart','julia','octave','powershell','korn-shell','tcsh','wasm','x86-assembly','verilog','vhdl','postscript','bcpl','oberon'])
    parser.add_argument('--ssh-host')
    parser.add_argument('--output', default='/tmp/code-museum-cli-checks.json')
    args = parser.parse_args()
    if args.ssh_host:
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', args.ssh_host): parser.error('Invalid SSH host')
        bootstrap = """
import json,sys,tempfile,subprocess
from pathlib import Path
files=json.load(sys.stdin)
language=files.pop("__language__",None)
with tempfile.TemporaryDirectory(prefix='code-museum-cli-check-') as directory:
 root=Path(directory)
 for name,text in files.items():
  p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
 report=root/'report.json'
 subprocess.run(['python3',str(root/'scripts/check-planned-runtimes.py'),'--output',str(report),*(['--language',language] if language else [])],check=True,stdout=sys.stderr)
 print(report.read_text())
"""
        import shlex
        run = subprocess.run(['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', args.ssh_host, 'python3 -c ' + shlex.quote(bootstrap)], input=json.dumps({'__language__':args.language,**{f: (ROOT / f).read_text() for f in FILES}}).encode(), stdout=subprocess.PIPE, check=True)
        report = json.loads(run.stdout); report['preparationHost'] = args.ssh_host
        Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
        print('PASS', len(report['checks']), 'real Docker CLI checks; report', args.output)
        return
    sys.path.insert(0, str(ROOT / 'server'))
    from executor import DockerRunner, load_runtimes, select_runtimes
    runtimes = select_runtimes(load_runtimes(ROOT / 'server/runtime-images.json'), [args.language] if args.language else None)
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
        if args.language in (None, 'algol-60'):
            samples = json.loads((ROOT / 'data/audit/algol60-runtime-checks.json').read_text())['samples']
            for sample in samples:
                result = run('ALGOL 60 '+sample['name'], 'algol-60', sample['sample'])
                assert result['stdout'].strip() == sample['expectedStdout'], result
            run('ALGOL 60 source edit', 'algol-60', 'begin outinteger(1, 42) end')
            error = run('ALGOL 60 syntax error prevents execution', 'algol-60', 'begin integer ; end', '', 'compile_error')
            assert 'runMs' not in error and error.get('compilerStderr'), error
            run('ALGOL 60 timeout', 'algol-60', 'begin again: goto again end', state='timed_out')
            run('ALGOL 60 output bound', 'algol-60', 'begin again: outstring(1,"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"); goto again end', state='output_limit')
            run('ALGOL 60 cancellation', 'algol-60', 'begin again: goto again end', state='cancelled', cancel_after=1)
            run('ALGOL 60 recovery', 'algol-60', 'begin outstring(1,"ready") end', 'ready')
        if args.language in (None, 'common-lisp'):
            run('Common Lisp function and loop', 'common-lisp', '(defun sum-to (n) (loop for i from 1 to n sum i)) (format t "~d~%" (sum-to 10))', '55\n')
            run('Common Lisp macro and edited output', 'common-lisp', '(defmacro twice (x) `(+ ,x ,x)) (format t "~d~%" (twice 6))', '12\n')
            run('Common Lisp multiline UTF-8 stdin', 'common-lisp', '(loop for line = (read-line *standard-input* nil nil) while line do (format t "[~a]~%" line))', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            run('Common Lisp invalid syntax', 'common-lisp', '(defun broken (', '', 'failed')
            run('Common Lisp real runtime error', 'common-lisp', '(error "intentional error")', '', 'failed')
            run('Common Lisp missing external package fails', 'common-lisp', '(ql:quickload :missing-museum-package)', '', 'failed')
            run('Common Lisp timeout', 'common-lisp', '(loop)', state='timed_out')
            run('Common Lisp bounded output', 'common-lisp', '(loop do (write-line "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"))', state='output_limit')
            run('Common Lisp cancellation', 'common-lisp', '(loop)', state='cancelled', cancel_after=1)
            run('Common Lisp recovery', 'common-lisp', '(format t "ready~%")', 'ready\n')
        if args.language in (None, 'prolog'):
            run('Prolog arithmetic and list', 'prolog', 'main :- numlist(1,10,N), sum_list(N,S), writeln(S).', '55\n')
            run('Prolog backtracking and edited output', 'prolog', 'color(red). color(blue). main :- findall(X,color(X),Xs), writeln(Xs).', '[red,blue]\n')
            run('Prolog multiline UTF-8 stdin', 'prolog', ':- use_module(library(readutil)). main :- read_line_to_string(user_input,A), read_line_to_string(user_input,B), format("[~s]~n[~s]~n",[A,B]).', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            run('Prolog syntax error halts before main', 'prolog', 'broken( .\nmain :- writeln(must_not_run).', '', 'failed')
            run('Prolog failed goal is a real failure', 'prolog', 'main :- fail.', '', 'failed')
            run('Prolog runtime error', 'prolog', 'main :- throw(error(intentional_error, museum)).', '', 'failed')
            run('Prolog timeout', 'prolog', 'main :- repeat, fail.', state='timed_out')
            run('Prolog bounded output', 'prolog', 'main :- repeat, writeln(xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx), fail.', state='output_limit')
            run('Prolog cancellation', 'prolog', 'main :- repeat, fail.', state='cancelled', cancel_after=1)
            run('Prolog recovery', 'prolog', 'main :- writeln(ready).', 'ready\n')
        if args.language in (None, 'forth'):
            run('Forth word definition and stack loop', 'forth', ': sum-to 0 swap 1+ 1 ?do i + loop ; 10 sum-to . cr', '55 \n')
            run('Forth edited stack computation', 'forth', ': square dup * ; 7 square . cr', '49 \n')
            run('Forth multiline UTF-8 stdin', 'forth', 'create linebuf 1024 allot : read-one linebuf 1024 stdin read-line throw if linebuf swap type cr else drop then ; read-one read-one', 'hello\n博物馆\n', stdin='hello\n博物馆\n')
            run('Forth undefined word is a real error', 'forth', 'museum_missing_word', '\n', 'failed')
            run('Forth stack underflow', 'forth', 'drop', '\n', 'failed')
            run('Forth timeout', 'forth', ': spin begin again ; spin', state='timed_out')
            run('Forth bounded output', 'forth', ': flood begin ." xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" cr again ; flood', state='output_limit')
            run('Forth cancellation', 'forth', ': spin begin again ; spin', state='cancelled', cancel_after=1)
            run('Forth recovery', 'forth', '." ready" cr', 'ready\n')

        if args.language in (None, 'racket') and 'racket' in runtimes:
            run('Racket base language and for sum', 'racket', '#lang racket/base\n(displayln (for/sum ([n (in-range 1 11)]) n))', '55\n')
            run('Racket hygienic macro and edited output', 'racket', '#lang racket/base\n(define-syntax-rule (twice x) (+ x x))\n(displayln (twice 6))', '12\n')
            run('Racket multiline UTF-8 stdin', 'racket', '#lang racket/base\n(let loop () (define line (read-line)) (unless (eof-object? line) (displayln (string-append "[" line "]")) (loop)))', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            run('Racket syntax error', 'racket', '#lang racket/base\n(define value )', '', 'failed')
            run('Racket runtime error', 'racket', '#lang racket/base\n(error "intentional error")', '', 'failed')
            run('Racket missing package fails without download', 'racket', '#lang racket/base\n(require museum_missing_package)', '', 'failed')
            run('Racket timeout', 'racket', '#lang racket/base\n(let loop () (loop))', state='timed_out')
            run('Racket bounded output', 'racket', '#lang racket/base\n(let loop () (displayln "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") (loop))', state='output_limit')
            run('Racket cancellation', 'racket', '#lang racket/base\n(let loop () (loop))', state='cancelled', cancel_after=1)
            run('Racket recovery', 'racket', '#lang racket/base\n(displayln 42)', '42\n')

        if args.language in (None, 'smalltalk') and 'smalltalk' in runtimes:
            run('Smalltalk block iteration and sum', 'smalltalk', '| total | total := 0. 1 to: 10 do: [:i | total := total + i]. total printNl.', '55\n')
            run('Smalltalk collections and edited source', 'smalltalk', '(#(3 4 5) inject: 0 into: [:sum :n | sum + n]) printNl.', '12\n')
            run('Smalltalk class definition and message dispatch', 'smalltalk', 'Object subclass: MuseumBox [ | item | initialize [ item := 6 ] doubled [ ^item * 2 ] ]\n(MuseumBox new initialize) doubled printNl.', '12\n')
            run('Smalltalk multiline UTF-8 stdin', 'smalltalk', "2 timesRepeat: [ | line | line := stdin nextLine. stdout nextPutAll: '['; nextPutAll: line; nextPutAll: ']'; nl ].", '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            run('Smalltalk invalid syntax is not success', 'smalltalk', '| broken', state='failed')
            run('Smalltalk runtime exception is not success', 'smalltalk', '1 / 0.', state='failed')
            run('Smalltalk handled runtime error stays successful', 'smalltalk', "[1 / 0] on: Error do: [:e | stdout nextPutAll: 'handled'; nl].", 'handled\n')
            run('Smalltalk handled compiler error stays successful', 'smalltalk', "Object evaluate: '| broken' ifError: [:file :line :message | stdout nextPutAll: 'handled'; nl].", 'handled\n')
            run('Smalltalk stderr is not parsed as a failure heuristic', 'smalltalk', "stderr nextPutAll: 'intentional diagnostic'; nl. 42 printNl.", '42\n')
            run('Smalltalk timeout', 'smalltalk', '[true] whileTrue: [].', state='timed_out')
            run('Smalltalk bounded output', 'smalltalk', "[true] whileTrue: [stdout nextPutAll: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; nl].", state='output_limit')
            run('Smalltalk cancellation', 'smalltalk', '[true] whileTrue: [].', state='cancelled', cancel_after=1)
            run('Smalltalk recovery', 'smalltalk', '42 printNl.', '42\n')

        if args.language in (None, 'cobol') and 'cobol' in runtimes:
            run('COBOL free-format loop and numeric editing', 'cobol', 'identification division.\nprogram-id. museum.\ndata division.\nworking-storage section.\n01 n pic 9(4) binary.\n01 total pic 9(6) binary value 0.\n01 shown pic Z(5)9.\nprocedure division.\nperform varying n from 1 by 1 until n > 10\n add n to total\nend-perform\nmove total to shown\ndisplay function trim(shown)\ngoback.\n', '55\n')
            run('COBOL intrinsic function and edited output', 'cobol', 'identification division.\nprogram-id. museum.\nprocedure division.\ndisplay function upper-case("museum")\ngoback.\n', 'MUSEUM\n')
            run('COBOL multiline UTF-8 stdin', 'cobol', 'identification division.\nprogram-id. museum.\ndata division.\nworking-storage section.\n01 line-in pic X(128).\nprocedure division.\nperform 2 times\n accept line-in\n display "[" function trim(line-in trailing) "]"\nend-perform\ngoback.\n', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            error=run('COBOL compile error prevents execution', 'cobol', 'identification division.\nprogram-id. museum.\nprocedure division.\ndisplay "MUST_NOT_RUN"\nadd 1 to .\n', '', 'compile_error')
            assert 'runMs' not in error and error.get('compilerStderr'), error
            run('COBOL missing runtime module is an error', 'cobol', 'identification division.\nprogram-id. museum.\nprocedure division.\ncall "museum_missing_subprogram"\ngoback.\n', '', 'failed')
            run('COBOL timeout', 'cobol', 'identification division.\nprogram-id. museum.\nprocedure division.\nperform until 1 = 2 continue end-perform\ngoback.\n', state='timed_out')
            run('COBOL bounded output', 'cobol', 'identification division.\nprogram-id. museum.\nprocedure division.\nperform until 1 = 2 display "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" end-perform\ngoback.\n', state='output_limit')
            run('COBOL cancellation', 'cobol', 'identification division.\nprogram-id. museum.\nprocedure division.\nperform until 1 = 2 continue end-perform\ngoback.\n', state='cancelled', cancel_after=1)
            run('COBOL recovery', 'cobol', 'identification division.\nprogram-id. museum.\nprocedure division.\ndisplay 42\ngoback.\n', '42\n')

        if args.language in (None, 'ada') and 'ada' in runtimes:
            run('Ada typed loop and sum', 'ada', 'with Ada.Text_IO; with Ada.Integer_Text_IO;\nprocedure Main is\n Total : Integer := 0;\nbegin\n for I in 1 .. 10 loop Total := Total + I; end loop;\n Ada.Integer_Text_IO.Put(Total, Width => 0); Ada.Text_IO.New_Line;\nend Main;\n', '55\n')
            run('Ada nested function and edited source', 'ada', 'with Ada.Text_IO; with Ada.Integer_Text_IO;\nprocedure Main is\n function Square(N : Integer) return Integer is\n begin return N * N; end Square;\nbegin Ada.Integer_Text_IO.Put(Square(7), Width => 0); Ada.Text_IO.New_Line; end Main;\n', '49\n')
            run('Ada multiline UTF-8 stdin', 'ada', 'with Ada.Text_IO; use Ada.Text_IO;\nprocedure Main is\nbegin for I in 1 .. 2 loop Put_Line("[" & Get_Line & "]"); end loop; end Main;\n', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            error=run('Ada type error prevents execution', 'ada', 'with Ada.Text_IO;\nprocedure Main is N : Integer;\nbegin Ada.Text_IO.Put_Line("MUST_NOT_RUN"); N := "wrong"; end Main;\n', '', 'compile_error')
            assert 'runMs' not in error and error.get('compilerStderr'), error
            run('Ada unhandled Constraint_Error fails', 'ada', 'with Ada.Integer_Text_IO;\nprocedure Main is Denominator : Integer := 0;\nbegin Ada.Integer_Text_IO.Put(1 / Denominator); end Main;\n', '', 'failed')
            run('Ada handled exception stays successful', 'ada', 'with Ada.Text_IO;\nprocedure Main is\nbegin raise Constraint_Error;\nexception when Constraint_Error => Ada.Text_IO.Put_Line("handled"); end Main;\n', 'handled\n')
            run('Ada timeout', 'ada', 'procedure Main is begin loop null; end loop; end Main;\n', state='timed_out')
            run('Ada bounded output', 'ada', 'with Ada.Text_IO;\nprocedure Main is begin loop Ada.Text_IO.Put_Line("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"); end loop; end Main;\n', state='output_limit')
            run('Ada cancellation', 'ada', 'procedure Main is begin loop null; end loop; end Main;\n', state='cancelled', cancel_after=1)
            run('Ada recovery', 'ada', 'with Ada.Text_IO;\nprocedure Main is begin Ada.Text_IO.Put_Line("ready"); end Main;\n', 'ready\n')

        if args.language in (None, 'clojure') and 'clojure' in runtimes:
            run('Clojure sequence reduction', 'clojure', '(println (reduce + (range 1 11)))', '55\n')
            run('Clojure macro and edited output', 'clojure', '(defmacro twice [x] (list (quote +) x x))\n(println (twice 6))', '12\n')
            run('Clojure multiline UTF-8 stdin', 'clojure', '(doseq [_ (range 2)] (println (str "[" (read-line) "]")))', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            run('Clojure reader syntax error', 'clojure', '(defn broken [', '', 'failed')
            run('Clojure real runtime exception', 'clojure', '(throw (ex-info "intentional error" {}))', '', 'failed')
            run('Clojure handled exception succeeds', 'clojure', '(try (throw (Exception. "expected")) (catch Exception e (println "handled")))', 'handled\n')
            run('Clojure missing dependency fails without restore', 'clojure', '(require (quote museum.missing.package))', '', 'failed')
            run('Clojure timeout', 'clojure', '(loop [] (recur))', state='timed_out')
            run('Clojure bounded output', 'clojure', '(loop [] (println "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") (recur))', state='output_limit')
            run('Clojure cancellation', 'clojure', '(loop [] (recur))', state='cancelled', cancel_after=1)
            run('Clojure recovery', 'clojure', '(println 42)', '42\n')

        if args.language in (None, 'ocaml') and 'ocaml' in runtimes:
            run('OCaml list fold and sum', 'ocaml', 'let values = List.init 10 (fun i -> i + 1)\nlet () = Printf.printf "%d\\n" (List.fold_left (+) 0 values)\n', '55\n')
            run('OCaml algebraic type and pattern matching', 'ocaml', 'type shape = Circle of int | Rectangle of int * int\nlet area = function Circle r -> 3 * r * r | Rectangle (w,h) -> w * h\nlet () = Printf.printf "%d\\n" (area (Rectangle (3,4)))\n', '12\n')
            run('OCaml multiline UTF-8 stdin', 'ocaml', 'let () = for _i = 1 to 2 do Printf.printf "[%s]\\n" (read_line ()) done\n', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            error=run('OCaml type error prevents execution', 'ocaml', 'let () = print_endline "MUST_NOT_RUN"; print_int ("wrong" + 1)\n', '', 'compile_error')
            assert 'runMs' not in error and error.get('compilerStderr'), error
            run('OCaml unhandled exception fails', 'ocaml', 'let () = failwith "intentional error"\n', '', 'failed')
            run('OCaml handled exception succeeds', 'ocaml', 'let () = try failwith "expected" with Failure _ -> print_endline "handled"\n', 'handled\n')
            run('OCaml timeout', 'ocaml', 'let () = while true do () done\n', state='timed_out')
            run('OCaml bounded output', 'ocaml', 'let () = while true do print_endline "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" done\n', state='output_limit')
            run('OCaml cancellation', 'ocaml', 'let () = while true do () done\n', state='cancelled', cancel_after=1)
            run('OCaml recovery', 'ocaml', 'let () = print_endline "ready"\n', 'ready\n')

        if args.language in (None, 'haskell') and 'haskell' in runtimes:
            run('Haskell typed lazy list sum', 'haskell', 'main :: IO ()\nmain = print (sum [1..10] :: Int)\n', '55\n')
            run('Haskell algebraic type and pattern matching', 'haskell', 'data Shape = Circle Int | Rectangle Int Int\narea :: Shape -> Int\narea (Circle r) = 3 * r * r\narea (Rectangle w h) = w * h\nmain :: IO ()\nmain = print (area (Rectangle 3 4))\n', '12\n')
            run('Haskell multiline UTF-8 stdin', 'haskell', 'import Control.Monad (replicateM_)\nmain :: IO ()\nmain = replicateM_ 2 (do line <- getLine; putStrLn ("[" ++ line ++ "]"))\n', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            error=run('Haskell type error prevents execution', 'haskell', 'main :: IO ()\nmain = do putStrLn "MUST_NOT_RUN"; print ((1 :: Int) + "wrong")\n', '', 'compile_error')
            assert 'runMs' not in error and error.get('compilerStderr'), error
            run('Haskell unhandled exception fails', 'haskell', 'main :: IO ()\nmain = error "intentional error"\n', '', 'failed')
            run('Haskell handled IO exception succeeds', 'haskell', 'import Control.Exception (catch)\nhandler :: IOError -> IO ()\nhandler _ = putStrLn "handled"\nmain :: IO ()\nmain = catch (ioError (userError "expected")) handler\n', 'handled\n')
            run('Haskell timeout', 'haskell', 'import Control.Monad (forever)\nmain :: IO ()\nmain = forever (return ())\n', state='timed_out')
            run('Haskell bounded output', 'haskell', 'import Control.Monad (forever)\nmain :: IO ()\nmain = forever (putStrLn "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")\n', state='output_limit')
            run('Haskell cancellation', 'haskell', 'import Control.Monad (forever)\nmain :: IO ()\nmain = forever (return ())\n', state='cancelled', cancel_after=1)
            run('Haskell recovery', 'haskell', 'main :: IO ()\nmain = print (42 :: Int)\n', '42\n')

        if args.language in (None, 'kotlin') and 'kotlin' in runtimes:
            clean=run('Kotlin typed collection sum', 'kotlin', 'fun main() { println((1..10).sum()) }', '55\n')
            assert not clean.get('compilerStderr'), clean
            run('Kotlin data class and nullable expression', 'kotlin', 'data class Box(val value: Int)\nfun main() { val box: Box? = Box(6); println((box?.value ?: 0) * 2) }', '12\n')
            run('Kotlin multiline UTF-8 stdin', 'kotlin', 'fun main() { repeat(2) { println("[" + readln() + "]") } }', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            error=run('Kotlin type error prevents execution', 'kotlin', 'fun main() { println("MUST_NOT_RUN"); val n: Int = "wrong"; println(n) }', '', 'compile_error')
            assert 'runMs' not in error and error.get('compilerStderr'), error
            run('Kotlin unhandled exception fails', 'kotlin', 'fun main() { error("intentional error") }', '', 'failed')
            run('Kotlin handled exception succeeds', 'kotlin', 'fun main() { try { error("expected") } catch (e: IllegalStateException) { println("handled") } }', 'handled\n')
            run('Kotlin timeout', 'kotlin', 'fun main() { while (true) {} }', state='timed_out')
            run('Kotlin bounded output', 'kotlin', 'fun main() { while (true) println("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") }', state='output_limit')
            run('Kotlin cancellation', 'kotlin', 'fun main() { while (true) {} }', state='cancelled', cancel_after=1)
            run('Kotlin recovery', 'kotlin', 'fun main() { println(42) }', '42\n')

        if args.language in (None, 'groovy') and 'groovy' in runtimes:
            run('Groovy range and closure sum', 'groovy', 'println((1..10).inject(0) { sum, n -> sum + n })', '55\n')
            run('Groovy class and dynamic property', 'groovy', 'class Box { int value; int doubled() { value * 2 } }\nprintln(new Box(value: 6).doubled())', '12\n')
            run('Groovy multiline UTF-8 stdin', 'groovy', 'def reader = new BufferedReader(new InputStreamReader(System.in, "UTF-8"))\n2.times { println("[" + reader.readLine() + "]") }', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            run('Groovy parser error', 'groovy', 'def broken = [', '', 'failed')
            run('Groovy unhandled exception fails', 'groovy', 'throw new IllegalStateException("intentional error")', '', 'failed')
            run('Groovy handled exception succeeds', 'groovy', 'try { throw new IllegalStateException("expected") } catch (IllegalStateException e) { println("handled") }', 'handled\n')
            run('Groovy missing package fails without restore', 'groovy', 'import museum.missing.Library\nprintln(new Library())', '', 'failed')
            run('Groovy timeout', 'groovy', 'while (true) {}', state='timed_out')
            run('Groovy bounded output', 'groovy', 'while (true) println("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")', state='output_limit')
            run('Groovy cancellation', 'groovy', 'while (true) {}', state='cancelled', cancel_after=1)
            run('Groovy recovery', 'groovy', 'println(42)', '42\n')

        if args.language in (None, 'erlang') and 'erlang' in runtimes:
            run('Erlang list sum', 'erlang', '-module(main).\n-export([main/0]).\nmain() -> io:format("~p~n",[lists:sum(lists:seq(1,10))]).\n', '55\n')
            run('Erlang process message passing', 'erlang', '-module(main).\n-export([main/0]).\nmain() -> Parent=self(), spawn(fun() -> Parent ! {result, 7*7} end), receive {result,N} -> io:format("~p~n",[N]) end.\n', '49\n')
            run('Erlang multiline UTF-8 stdin', 'erlang', '-module(main).\n-export([main/0]).\nmain() -> io:setopts(standard_io,[{encoding,unicode}]), lists:foreach(fun(_) -> Line=io:get_line(""), io:put_chars(["[",string:trim(Line),"]\\n"]) end,[1,2]).\n', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            error=run('Erlang syntax error prevents execution', 'erlang', '-module(main).\n-export([main/0]).\nmain() -> io:format("MUST_NOT_RUN"), broken(.\n', '', 'compile_error')
            assert 'runMs' not in error and (error.get('compilerStdout') or error.get('compilerStderr')), error
            run('Erlang unhandled exception fails', 'erlang', '-module(main).\n-export([main/0]).\nmain() -> erlang:error(intentional_error).\n', state='failed')
            run('Erlang handled exception succeeds', 'erlang', '-module(main).\n-export([main/0]).\nmain() -> try erlang:error(expected) catch error:expected -> io:format("handled~n") end.\n', 'handled\n')
            run('Erlang timeout', 'erlang', '-module(main).\n-export([main/0]).\nmain() -> main().\n', state='timed_out')
            run('Erlang bounded output', 'erlang', '-module(main).\n-export([main/0]).\nmain() -> io:format("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx~n"), main().\n', state='output_limit')
            run('Erlang cancellation', 'erlang', '-module(main).\n-export([main/0]).\nmain() -> main().\n', state='cancelled', cancel_after=1)
            run('Erlang recovery', 'erlang', '-module(main).\n-export([main/0]).\nmain() -> io:format("42~n").\n', '42\n')

        if args.language in (None, 'elixir') and 'elixir' in runtimes:
            run('Elixir enum pipeline sum', 'elixir', '1..10 |> Enum.sum() |> IO.puts()', '55\n')
            run('Elixir module and pattern matching', 'elixir', 'defmodule Museum do\n def area({:rectangle, w, h}), do: w * h\nend\nIO.puts(Museum.area({:rectangle,3,4}))', '12\n')
            run('Elixir process message passing', 'elixir', 'parent = self()\nspawn(fn -> send(parent, {:result,7*7}) end)\nreceive do {:result,n} -> IO.puts(n) end', '49\n')
            run('Elixir multiline UTF-8 stdin', 'elixir', 'Enum.each(1..2, fn _ -> line = IO.read(:stdio, :line); IO.puts("[" <> String.trim_trailing(line, "\\n") <> "]") end)', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            run('Elixir syntax error', 'elixir', 'if true do\n', '', 'failed')
            run('Elixir unhandled exception fails', 'elixir', 'raise "intentional error"', '', 'failed')
            run('Elixir handled exception succeeds', 'elixir', 'try do raise "expected" rescue RuntimeError -> IO.puts("handled") end', 'handled\n')
            run('Elixir missing package fails without restore', 'elixir', 'Code.ensure_compiled!(Museum.Missing)', '', 'failed')
            run('Elixir timeout', 'elixir', 'defmodule Spin do\n def go, do: go()\nend\nSpin.go()', state='timed_out')
            run('Elixir bounded output', 'elixir', 'defmodule Flood do\n def go do IO.puts("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"); go() end\nend\nFlood.go()', state='output_limit')
            run('Elixir cancellation', 'elixir', 'defmodule Spin do\n def go, do: go()\nend\nSpin.go()', state='cancelled', cancel_after=1)
            run('Elixir recovery', 'elixir', 'IO.puts(42)', '42\n')

        if args.language in (None, 'tcl') and 'tcl' in runtimes:
            run('Tcl list and substitution sum', 'tcl', 'set total 0\nforeach n {1 2 3 4 5 6 7 8 9 10} {incr total $n}\nputs $total', '55\n')
            run('Tcl procedure and expression', 'tcl', 'proc square {n} {expr {$n * $n}}\nputs [square 7]', '49\n')
            run('TclOO class and object method', 'tcl', 'oo::class create Box {\n variable value\n constructor {n} {set value $n}\n method doubled {} {expr {$value * 2}}\n}\nBox create box 6\nputs [box doubled]', '12\n')
            run('Tcl multiline UTF-8 stdin', 'tcl', 'fconfigure stdin -encoding utf-8\nfconfigure stdout -encoding utf-8\nforeach _ {1 2} {puts [format {[%s]} [gets stdin]]}', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            run('Tcl syntax error', 'tcl', 'set broken {', '', 'failed')
            run('Tcl unhandled error fails', 'tcl', 'error "intentional error"', '', 'failed')
            run('Tcl handled error succeeds', 'tcl', 'try {error expected} on error {message options} {puts handled}', 'handled\n')
            run('Tcl missing package fails without install', 'tcl', 'package require museum_missing_package', '', 'failed')
            run('Tcl timeout', 'tcl', 'while 1 {}', state='timed_out')
            run('Tcl bounded output', 'tcl', 'while 1 {puts xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx}', state='output_limit')
            run('Tcl cancellation', 'tcl', 'while 1 {}', state='cancelled', cancel_after=1)
            run('Tcl recovery', 'tcl', 'puts 42', '42\n')

        if args.language in (None, 'standard-ml') and 'standard-ml' in runtimes:
            run('Standard ML list fold', 'standard-ml', 'val values = List.tabulate(10, fn i => i+1);\nval () = print(Int.toString(List.foldl (op +) 0 values) ^ "\\n");\n', '55\n')
            run('Standard ML datatype and pattern matching', 'standard-ml', 'datatype shape = Circle of int | Rectangle of int * int;\nfun area (Circle r) = 3*r*r | area (Rectangle (w,h)) = w*h;\nval () = print(Int.toString(area(Rectangle(3,4))) ^ "\\n");', '12\n')
            run('Standard ML structure and function', 'standard-ml', 'structure Museum = struct val n=6 fun twice x=x*2 end;\nval () = print(Int.toString(Museum.twice Museum.n) ^ "\\n");', '12\n')
            run('Standard ML multiline UTF-8 stdin', 'standard-ml', 'fun line () = case TextIO.inputLine TextIO.stdIn of SOME s => print("[" ^ String.substring(s,0,String.size s-1) ^ "]\\n") | NONE => ();\nval () = (line(); line());', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            run('Standard ML type error fails', 'standard-ml', 'val bad : int = "wrong";\n', state='failed')
            run('Standard ML later declaration type error', 'standard-ml', 'val () = print "before\\n";\nval bad : int = "wrong";\n', state='failed')
            run('Standard ML unhandled exception fails', 'standard-ml', 'val () = raise Fail "intentional error";\n', state='failed')
            run('Standard ML handled exception succeeds', 'standard-ml', 'val () = (raise Fail "expected") handle Fail _ => print "handled\\n";\n', 'handled\n')
            run('Standard ML timeout', 'standard-ml', 'fun spin () = spin ();\nval () = spin ();', state='timed_out')
            run('Standard ML bounded output', 'standard-ml', 'fun flood () = (print "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\\n"; flood ());\nval () = flood ();', state='output_limit')
            run('Standard ML cancellation', 'standard-ml', 'fun spin () = spin ();\nval () = spin ();', state='cancelled', cancel_after=1)
            run('Standard ML recovery', 'standard-ml', 'val () = print "42\\n";\n', '42\n')

        if args.language in (None, 'scala') and 'scala' in runtimes:
            run('Scala typed collection sum', 'scala', 'object Main { def main(args: Array[String]): Unit = println((1 to 10).sum) }', '55\n')
            run('Scala case class and pattern matching', 'scala', 'object Main { sealed trait Shape; case class Rectangle(w: Int,h: Int) extends Shape; def area(s: Shape): Int = s match { case Rectangle(w,h) => w*h }; def main(args: Array[String]): Unit = println(area(Rectangle(3,4))) }', '12\n')
            run('Scala multiline UTF-8 stdin', 'scala', 'object Main { def main(args: Array[String]): Unit = (1 to 2).foreach(_ => println("[" + scala.io.StdIn.readLine() + "]")) }', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            error=run('Scala type error prevents execution', 'scala', 'object Main { def main(args: Array[String]): Unit = { println("MUST_NOT_RUN"); val n: Int = "wrong"; println(n) } }', '', 'compile_error')
            assert 'runMs' not in error and error.get('compilerStderr'), error
            run('Scala unhandled exception fails', 'scala', 'object Main { def main(args: Array[String]): Unit = throw new RuntimeException("intentional error") }', '', 'failed')
            run('Scala handled exception succeeds', 'scala', 'object Main { def main(args: Array[String]): Unit = try { throw new RuntimeException("expected") } catch { case _: RuntimeException => println("handled") } }', 'handled\n')
            run('Scala timeout', 'scala', 'object Main { def main(args: Array[String]): Unit = { while (true) {} } }', state='timed_out')
            run('Scala bounded output', 'scala', 'object Main { def main(args: Array[String]): Unit = { while (true) println("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") } }', state='output_limit')
            run('Scala cancellation', 'scala', 'object Main { def main(args: Array[String]): Unit = { while (true) {} } }', state='cancelled', cancel_after=1)
            run('Scala recovery', 'scala', 'object Main { def main(args: Array[String]): Unit = println(42) }', '42\n')

        if args.language in (None, 'visual-basic.net') and 'visual-basic.net' in runtimes:
            def vb(body, extra=''):
                return 'Imports System\n'+extra+'\nModule Museum\nSub Main()\n'+body+'\nEnd Sub\nEnd Module\n'
            run('VB.NET typed loop sum', 'visual-basic.net', vb('Dim total As Integer = 0\nFor n As Integer = 1 To 10\n total += n\nNext\nConsole.WriteLine(total)'), '55\n')
            run('VB.NET typed function', 'visual-basic.net', 'Imports System\nModule Museum\nFunction Square(n As Integer) As Integer\nReturn n * n\nEnd Function\nSub Main()\nConsole.WriteLine(Square(7))\nEnd Sub\nEnd Module', '49\n')
            run('VB.NET LINQ standard library', 'visual-basic.net', vb('Console.WriteLine(Enumerable.Range(1,10).Sum())','Imports System.Linq'), '55\n')
            run('VB.NET multiline UTF-8 stdin', 'visual-basic.net', vb('Console.InputEncoding = New System.Text.UTF8Encoding(False)\nConsole.OutputEncoding = New System.Text.UTF8Encoding(False)\nFor n As Integer = 1 To 2\n Console.WriteLine("[" & Console.ReadLine() & "]")\nNext'), '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            error=run('VB.NET strict type error prevents execution', 'visual-basic.net', vb('Console.WriteLine("MUST_NOT_RUN")\nDim n As Integer = "wrong"\nConsole.WriteLine(n)'), '', 'compile_error')
            assert 'runMs' not in error and (error.get('compilerStdout') or error.get('compilerStderr')), error
            run('VB.NET unhandled exception fails', 'visual-basic.net', vb('Throw New Exception("intentional error")'), '', 'failed')
            run('VB.NET handled exception succeeds', 'visual-basic.net', vb('Try\n Throw New Exception("expected")\nCatch e As Exception\n Console.WriteLine("handled")\nEnd Try'), 'handled\n')
            run('VB.NET timeout', 'visual-basic.net', vb('Do\nLoop'), state='timed_out')
            run('VB.NET bounded output', 'visual-basic.net', vb('Do\n Console.WriteLine("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")\nLoop'), state='output_limit')
            run('VB.NET cancellation', 'visual-basic.net', vb('Do\nLoop'), state='cancelled', cancel_after=1)
            run('VB.NET recovery', 'visual-basic.net', vb('Console.WriteLine(42)'), '42\n')

        if args.language in (None, 'f-sharp') and 'f-sharp' in runtimes:
            def fs(body, extra=''):
                return 'module Museum\n'+extra+'\n[<EntryPoint>]\nlet main _ =\n'+''.join('    '+line+'\n' for line in body.splitlines())+'    0\n'
            run('F# typed list pipeline sum', 'f-sharp', fs('[1..10] |> List.sum |> printfn "%d"'), '55\n')
            run('F# discriminated union and pattern matching', 'f-sharp', fs('printfn "%d" (area (Rectangle(3,4)))','type Shape = Circle of int | Rectangle of int * int\nlet area = function Circle r -> 3*r*r | Rectangle(w,h) -> w*h'), '12\n')
            run('F# record update', 'f-sharp', fs('let box = {Value=6}\nlet changed = {box with Value=box.Value*2}\nprintfn "%d" changed.Value','type Box = {Value:int}'), '12\n')
            run('F# multiline UTF-8 stdin', 'f-sharp', fs('System.Console.InputEncoding <- System.Text.UTF8Encoding(false)\nSystem.Console.OutputEncoding <- System.Text.UTF8Encoding(false)\nfor _ in 1..2 do\n    printfn "[%s]" (System.Console.ReadLine())'), '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            error=run('F# type error prevents execution', 'f-sharp', fs('printfn "MUST_NOT_RUN"\nlet n:int = "wrong"\nprintfn "%d" n'), '', 'compile_error')
            assert 'runMs' not in error and (error.get('compilerStdout') or error.get('compilerStderr')), error
            run('F# unhandled exception fails', 'f-sharp', fs('failwith "intentional error"'), '', 'failed')
            run('F# handled exception succeeds', 'f-sharp', fs('try failwith "expected" with _ -> printfn "handled"'), 'handled\n')
            run('F# missing package fails without restore', 'f-sharp', fs('printfn "MUST_NOT_RUN"','open MuseumMissingLibrary'), '', 'compile_error')
            run('F# timeout', 'f-sharp', fs('while true do\n    ()'), state='timed_out')
            run('F# bounded output', 'f-sharp', fs('while true do\n    printfn "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"'), state='output_limit')
            run('F# cancellation', 'f-sharp', fs('while true do\n    ()'), state='cancelled', cancel_after=1)
            run('F# recovery', 'f-sharp', fs('printfn "42"'), '42\n')

        if args.language in (None, 'd') and 'd' in runtimes:
            run('D range and sum', 'd', 'import std.stdio; void main() { int total=0; foreach(n;1..11) total+=n; writeln(total); }', '55\n')
            run('D template function', 'd', 'import std.stdio; T square(T)(T n) { return n*n; } void main() { writeln(square(7)); }', '49\n')
            run('D compile-time expression and Phobos', 'd', 'import std.stdio; import std.algorithm; import std.range; enum value=6*7; void main() { writeln(value); writeln([1,2,3,4].map!(n => n*n).sum); }', '42\n30\n')
            run('D multiline UTF-8 stdin', 'd', 'import std.stdio; import std.string; void main() { foreach(_;0..2) writeln("[",readln().strip(),"]"); }', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            error=run('D type error prevents execution', 'd', 'import std.stdio; void main() { writeln("MUST_NOT_RUN"); int n="wrong"; writeln(n); }', '', 'compile_error')
            assert 'runMs' not in error and error.get('compilerStderr'), error
            run('D unhandled exception fails', 'd', 'void main() { throw new Exception("intentional error"); }', '', 'failed')
            run('D handled exception succeeds', 'd', 'import std.stdio; void main() { try { throw new Exception("expected"); } catch(Exception e) { writeln("handled"); } }', 'handled\n')
            run('D timeout', 'd', 'void main() { while(true) {} }', state='timed_out')
            run('D bounded output', 'd', 'import std.stdio; void main() { while(true) writeln("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"); }', state='output_limit')
            run('D cancellation', 'd', 'void main() { while(true) {} }', state='cancelled', cancel_after=1)
            run('D recovery', 'd', 'import std.stdio; void main() { writeln(42); }', '42\n')

        if args.language in (None, 'nim') and 'nim' in runtimes:
            run('Nim range sum', 'nim', 'var total = 0\nfor n in 1..10:\n  total += n\necho total\n', '55\n')
            run('Nim generic procedure', 'nim', 'proc square[T](n:T):T = n*n\necho square(7)\n', '49\n')
            run('Nim object and sequtils', 'nim', 'import std/sequtils\ntype Box = object\n  value:int\nlet values = @[Box(value:3),Box(value:4),Box(value:5)]\necho values.mapIt(it.value).foldl(a+b)\n', '12\n')
            run('Nim multiline UTF-8 stdin', 'nim', 'for _ in 0..<2:\n  echo "[" & stdin.readLine() & "]"\n', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            error=run('Nim type error prevents execution', 'nim', 'echo "MUST_NOT_RUN"\nlet n:int = "wrong"\necho n\n', '', 'compile_error')
            assert 'runMs' not in error and error.get('compilerStderr'), error
            run('Nim unhandled exception fails', 'nim', 'raise newException(ValueError,"intentional error")\n', '', 'failed')
            run('Nim handled exception succeeds', 'nim', 'try:\n  raise newException(ValueError,"expected")\nexcept ValueError:\n  echo "handled"\n', 'handled\n')
            run('Nim missing package fails without install', 'nim', 'import museum_missing_package\n', '', 'compile_error')
            run('Nim timeout', 'nim', 'while true:\n  discard\n', state='timed_out')
            run('Nim bounded output', 'nim', 'while true:\n  echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"\n', state='output_limit')
            run('Nim cancellation', 'nim', 'while true:\n  discard\n', state='cancelled', cancel_after=1)
            run('Nim recovery', 'nim', 'echo 42\n', '42\n')

        if args.language in (None, 'zig') and 'zig' in runtimes:
            run('Zig typed range sum', 'zig', 'const std = @import("std");\npub fn main() !void { var total:u32=0; for (1..11) |n| total += @intCast(n); try std.io.getStdOut().writer().print("{d}\\n", .{total}); }\n', '55\n')
            run('Zig comptime generic function', 'zig', 'const std = @import("std");\nfn square(comptime T:type, n:T) T { return n*n; }\npub fn main() !void { const value = comptime square(i32,7); try std.io.getStdOut().writer().print("{d}\\n", .{value}); }\n', '49\n')
            run('Zig tagged union and switch', 'zig', 'const std = @import("std");\nconst Shape = union(enum) { rect:struct { w:i32, h:i32 }, circle:i32 };\nfn area(s:Shape) i32 { return switch(s) { .rect => |r| r.w*r.h, .circle => |r| 3*r*r }; }\npub fn main() !void { try std.io.getStdOut().writer().print("{d}\\n", .{area(.{.rect=.{.w=3,.h=4}})}); }\n', '12\n')
            run('Zig multiline UTF-8 stdin', 'zig', 'const std = @import("std");\npub fn main() !void { const input=std.io.getStdIn().reader(); const output=std.io.getStdOut().writer(); var buf:[1024]u8=undefined; for(0..2) |_| { const line=(try input.readUntilDelimiterOrEof(&buf, \'\\n\')) orelse break; try output.print("[{s}]\\n", .{line}); } }\n', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            error=run('Zig type error prevents execution', 'zig', 'const std = @import("std");\npub fn main() !void { try std.io.getStdOut().writer().writeAll("MUST_NOT_RUN\\n"); const n:i32="wrong"; _=n; }\n', '', 'compile_error')
            assert 'runMs' not in error and error.get('compilerStderr'), error
            run('Zig unhandled error union fails', 'zig', 'pub fn main() !void { return error.Intentional; }\n', '', 'failed')
            run('Zig panic fails', 'zig', 'pub fn main() void { @panic("intentional error"); }\n', '', 'failed')
            run('Zig handled error union succeeds', 'zig', 'const std = @import("std");\nfn expected() error{Expected}!void { return error.Expected; }\npub fn main() !void { expected() catch { try std.io.getStdOut().writer().writeAll("handled\\n"); }; }\n', 'handled\n')
            run('Zig timeout', 'zig', 'pub fn main() void { while(true) {} }\n', state='timed_out')
            run('Zig bounded output', 'zig', 'const std = @import("std");\npub fn main() !void { while(true) try std.io.getStdOut().writer().writeAll("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\\n"); }\n', state='output_limit')
            run('Zig cancellation', 'zig', 'pub fn main() void { while(true) {} }\n', state='cancelled', cancel_after=1)
            run('Zig recovery', 'zig', 'const std = @import("std");\npub fn main() !void { try std.io.getStdOut().writer().writeAll("42\\n"); }\n', '42\n')

        if args.language in (None, 'swift') and 'swift' in runtimes:
            run('Swift typed range sum', 'swift', 'var total = 0\nfor n in 1...10 { total += n }\nprint(total)\n', '55\n')
            run('Swift generic Numeric function', 'swift', 'func square<T: Numeric>(_ n:T) -> T { n*n }\nprint(square(7))\n', '49\n')
            run('Swift enum pattern and optional', 'swift', 'enum Shape { case rectangle(Int,Int); case circle(Int) }\nfunc area(_ shape:Shape) -> Int { switch shape { case let .rectangle(w,h): return w*h; case let .circle(r): return 3*r*r } }\nlet shape:Shape? = .rectangle(3,4)\nprint(shape.map(area) ?? 0)\n', '12\n')
            run('Swift multiline UTF-8 stdin', 'swift', 'for _ in 0..<2 { if let line=readLine() { print("[\\(line)]") } }\n', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            error=run('Swift type error prevents execution', 'swift', 'print("MUST_NOT_RUN")\nlet n:Int="wrong"\nprint(n)\n', '', 'compile_error')
            assert 'runMs' not in error and error.get('compilerStderr'), error
            run('Swift unhandled error fails', 'swift', 'enum Failure:Error { case expected }\nthrow Failure.expected\n', '', 'failed')
            run('Swift handled error succeeds', 'swift', 'enum Failure:Error { case expected }\ndo { throw Failure.expected } catch { print("handled") }\n', 'handled\n')
            run('Swift Foundation fixed library', 'swift', 'import Foundation\nprint([3,4,5].map { String($0) }.joined(separator: ":"))\n', '3:4:5\n')
            run('Swift missing module fails without package resolution', 'swift', 'import MuseumMissingPackage\nprint("MUST_NOT_RUN")\n', '', 'compile_error')
            run('Swift timeout', 'swift', 'while true {}\n', state='timed_out')
            run('Swift bounded output', 'swift', 'while true { print("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") }\n', state='output_limit')
            run('Swift cancellation', 'swift', 'while true {}\n', state='cancelled', cancel_after=1)
            run('Swift recovery', 'swift', 'print(42)\n', '42\n')

        if args.language in (None, 'dart') and 'dart' in runtimes:
            run('Dart typed range sum', 'dart', 'void main() { var total=0; for(var n=1;n<=10;n++) { total+=n; } print(total); }', '55\n')
            run('Dart generic class and null safety', 'dart', 'class Box<T> { final T value; Box(this.value); }\nvoid main() { Box<int>? box=Box(6); print(box.value*2); }\n', '12\n')
            run('Dart records and switch expression', 'dart', 'int area((int,int) shape) => switch(shape) { (var w,var h) => w*h };\nvoid main() { print(area((3,4))); }\n', '12\n')
            run('Dart async Future', 'dart', 'Future<void> main() async { final value=await Future<int>.delayed(Duration(milliseconds:5),()=>42); print(value); }', '42\n')
            run('Dart multiline UTF-8 stdin', 'dart', 'import "dart:io"; import "dart:convert";\nvoid main() { for(var i=0;i<2;i++) { final line=stdin.readLineSync(encoding:utf8); print("[$line]"); } }', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            error=run('Dart type error prevents execution', 'dart', 'void main() { print("MUST_NOT_RUN"); int n="wrong"; print(n); }', '', 'compile_error')
            assert 'runMs' not in error and error.get('compilerStderr'), error
            run('Dart unhandled exception fails', 'dart', 'void main() { throw StateError("intentional error"); }', '', 'failed')
            run('Dart handled exception succeeds', 'dart', 'void main() { try { throw StateError("expected"); } catch(e) { print("handled"); } }', 'handled\n')
            run('Dart missing package fails without pub resolution', 'dart', 'import "package:museum_missing_library/library.dart"; void main() { print("MUST_NOT_RUN"); }', '', 'compile_error')
            run('Dart timeout', 'dart', 'void main() { while(true) {} }', state='timed_out')
            run('Dart bounded output', 'dart', 'void main() { while(true) { print("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"); } }', state='output_limit')
            run('Dart cancellation', 'dart', 'void main() { while(true) {} }', state='cancelled', cancel_after=1)
            run('Dart recovery', 'dart', 'void main() { print(42); }', '42\n')

        if args.language in (None, 'julia') and 'julia' in runtimes:
            run('Julia sum and broadcast', 'julia', 'println(sum(1:10))\nprintln(join([1,2,3].^2, ","))\n', '55\n1,4,9\n')
            run('Julia multiple dispatch', 'julia', 'describe(x::Int) = "integer"\ndescribe(x::AbstractString) = "text"\nprintln(describe(7))\nprintln(describe("museum"))\n', 'integer\ntext\n')
            run('Julia parametric struct and Unicode identifier', 'julia', 'struct Box{T}\n value::T\nend\nδ=Box(6)\nprintln(δ.value*2)\n', '12\n')
            run('Julia multiline UTF-8 stdin', 'julia', 'for _ in 1:2\n println("[",readline(),"]")\nend\n', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            run('Julia real syntax error', 'julia', 'function broken(\n', '', 'failed')
            run('Julia runtime error preserves prior stdout', 'julia', 'println("before")\nerror("intentional error")\n', 'before\n', 'failed')
            run('Julia handled error succeeds', 'julia', 'try\n error("expected")\ncatch e\n println("handled")\nend\n', 'handled\n')
            run('Julia fixed Dates standard library', 'julia', 'using Dates\nprintln(Date(2026,1,1)+Day(2))\n', '2026-01-03\n')
            run('Julia missing package fails without install', 'julia', 'using MuseumMissingPackage\n', '', 'failed')
            run('Julia timeout', 'julia', 'while true\nend\n', state='timed_out')
            run('Julia bounded output', 'julia', 'while true\n println("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")\nend\n', state='output_limit')
            run('Julia cancellation', 'julia', 'while true\nend\n', state='cancelled', cancel_after=1)
            run('Julia recovery', 'julia', 'println(42)\n', '42\n')

        if args.language in (None, 'octave') and 'octave' in runtimes:
            run('Octave range sum', 'octave', 'printf("%d\\n",sum(1:10));\n', '55\n')
            run('Octave local function in a single script', 'octave', '1;\nfunction y=square(x)\n y=x.*x;\nendfunction\nprintf("%d\\n",square(7));\n', '49\n')
            run('Octave matrix solve', 'octave', 'A=[2,0;0,4]; b=[6;8]; x=A\\b;\nprintf("%d,%d\\n",x(1),x(2));\n', '3,2\n')
            run('Octave complex arithmetic', 'octave', 'printf("%d\\n",round(abs(3+4i)));\n', '5\n')
            run('Octave multiline UTF-8 stdin', 'octave', 'for n=1:2\n line=fgetl(stdin); printf("[%s]\\n",line);\nendfor\n', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            run('Octave real syntax error', 'octave', 'x = ;\n', '', state='failed')
            run('Octave runtime error preserves prior stdout', 'octave', 'disp("before"); error("intentional error");\n', 'before\n', state='failed')
            run('Octave handled error succeeds', 'octave', 'try\n error("expected");\ncatch\n disp("handled");\nend_try_catch\n', 'handled\n')
            run('Octave missing package fails without install', 'octave', 'pkg("load","museum_missing_package");\n', '', state='failed')
            run('Octave timeout', 'octave', 'while(true)\nendwhile\n', state='timed_out')
            run('Octave bounded output', 'octave', 'while(true)\n printf("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\\n");\nendwhile\n', state='output_limit')
            run('Octave cancellation', 'octave', 'while(true)\nendwhile\n', state='cancelled', cancel_after=1)
            run('Octave recovery', 'octave', 'printf("42\\n");\n', '42\n')

        if args.language in (None, 'powershell') and 'powershell' in runtimes:
            run('PowerShell object pipeline sum', 'powershell', 'Write-Output ((1..10 | Measure-Object -Sum).Sum)\n', '55\n')
            run('PowerShell typed function', 'powershell', 'function Square([int]$n) { $n*$n }\nSquare 7\n', '49\n')
            run('PowerShell custom object and JSON', 'powershell', '[pscustomobject][ordered]@{value=6;label="museum"} | ConvertTo-Json -Compress\n', '{"value":6,"label":"museum"}\n')
            run('PowerShell multiline UTF-8 stdin', 'powershell', '1..2 | ForEach-Object { Write-Output ("["+[Console]::ReadLine()+"]") }\n', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            run('PowerShell real syntax error', 'powershell', 'function broken {\n', '', state='failed')
            run('PowerShell default Write-Error fails', 'powershell', 'Write-Error "intentional error"\n', '', state='failed')
            run('PowerShell unhandled throw fails', 'powershell', 'throw "intentional exception"\n', '', state='failed')
            run('PowerShell handled exception succeeds', 'powershell', 'try { throw "expected" } catch { Write-Output "handled" }\n', 'handled\n')
            result = run('PowerShell ordinary stderr is not failure', 'powershell', '[Console]::Error.WriteLine("ordinary stderr"); Write-Output 42\n', '42\n')
            assert 'ordinary stderr' in result['stderr'], result
            result = run('PowerShell explicit exit code', 'powershell', 'exit 7\n', '', state='failed')
            assert result['exitCode']==7, result
            run('PowerShell missing module fails without install', 'powershell', 'Import-Module MuseumMissingModule\n', '', state='failed')
            run('PowerShell timeout', 'powershell', 'while($true) {}\n', state='timed_out')
            run('PowerShell bounded output', 'powershell', 'while($true) { Write-Output "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }\n', state='output_limit')
            run('PowerShell cancellation', 'powershell', 'while($true) {}\n', state='cancelled', cancel_after=1)
            run('PowerShell recovery', 'powershell', 'Write-Output 42\n', '42\n')
            run('PowerShell writable tmpfs stays bounded despite sparse JIT mapping', 'powershell', 'try { [IO.File]::WriteAllBytes("/work/oversize", [byte[]]::new(20*1024*1024)); throw "UNEXPECTED_WRITE" } catch { if ($_.Exception.InnerException -is [IO.IOException] -and $_.Exception.InnerException.Message.Contains("No space left on device")) { $bounded=$true } else { throw } } finally { Remove-Item /work/oversize -ErrorAction SilentlyContinue }; if ($bounded) { Write-Output "bounded" }', 'bounded\n')
            run('PowerShell root filesystem remains read-only', 'powershell', 'try { [IO.File]::WriteAllText("/must-not-write", "x"); throw "UNEXPECTED_WRITE" } catch { if ($_.Exception.InnerException -is [IO.IOException] -and $_.Exception.InnerException.Message.Contains("Read-only file system")) { Write-Output "readonly" } else { throw } }', 'readonly\n')

        if args.language in (None, 'korn-shell') and 'korn-shell' in runtimes:
            run('Korn shell integer loop', 'korn-shell', 'integer total=0; for ((i=1;i<=10;i++)); do ((total+=i)); done; print -r -- "$total"', '55\n')
            run('Korn shell function', 'korn-shell', 'function square { print -r -- "$(( $1 * $1 ))"; }; square 7', '49\n')
            run('Korn shell indexed array', 'korn-shell', 'typeset -a nums=(3 4 5); print -r -- "$((nums[0]+nums[1]+nums[2]))"', '12\n')
            run('Korn shell floating arithmetic', 'korn-shell', 'typeset -F value; ((value=1.5*2)); printf "%.1f\\n" "$value"', '3.0\n')
            run('Korn shell multiline UTF-8 stdin', 'korn-shell', 'for n in 1 2; do IFS= read -r line; print -r -- "[$line]"; done', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            run('Korn shell real syntax error', 'korn-shell', 'if then', '', state='failed')
            result=run('Korn shell missing command', 'korn-shell', 'museum_missing_command', '', state='failed')
            assert result['exitCode']==127, result
            result=run('Korn shell explicit exit', 'korn-shell', 'exit 7', '', state='failed')
            assert result['exitCode']==7, result
            run('Korn shell handled failure follows native status', 'korn-shell', 'false; print -r -- handled', 'handled\n')
            result=run('Korn shell ordinary stderr succeeds', 'korn-shell', 'print -r -- note >&2; print -r -- 42', '42\n')
            assert 'note' in result['stderr'], result
            run('Korn shell timeout', 'korn-shell', 'while :; do :; done', state='timed_out')
            run('Korn shell bounded output', 'korn-shell', 'while :; do print -r -- xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx; done', state='output_limit')
            run('Korn shell cancellation', 'korn-shell', 'while :; do :; done', state='cancelled', cancel_after=1)
            run('Korn shell recovery', 'korn-shell', 'print -r -- 42', '42\n')

        if args.language in (None, 'tcsh') and 'tcsh' in runtimes:
            run('tcsh foreach arithmetic', 'tcsh', '@ total = 0\nforeach n (1 2 3 4 5 6 7 8 9 10)\n @ total += $n\nend\necho $total\n', '55\n')
            run('tcsh list indexing', 'tcsh', 'set values = (3 4 5)\n@ answer = $values[1] + $values[2] + $values[3]\necho $answer\n', '12\n')
            run('tcsh switch branch', 'tcsh', 'set value = museum\nswitch ($value)\ncase museum:\n echo matched\n breaksw\ndefault:\n exit 1\nendsw\n', 'matched\n')
            run('tcsh multiline UTF-8 input', 'tcsh', 'foreach n (1 2)\n set line = "$<"\n echo "[$line]"\nend\n', '[hello]\n[博物馆]\n', stdin='hello\n博物馆\n')
            run('tcsh real syntax error', 'tcsh', 'echo "broken\n', '', state='failed')
            run('tcsh undefined variable', 'tcsh', 'echo $museum_missing_variable\n', '', state='failed')
            result=run('tcsh explicit exit', 'tcsh', 'exit 7\n', '', state='failed')
            assert result['exitCode']==7, result
            run('tcsh handled earlier failure', 'tcsh', 'false\necho handled\n', 'handled\n')
            run('tcsh timeout', 'tcsh', 'while (1)\nend\n', state='timed_out')
            run('tcsh bounded output', 'tcsh', 'while (1)\n echo xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\nend\n', state='output_limit')
            run('tcsh cancellation', 'tcsh', 'while (1)\nend\n', state='cancelled', cancel_after=1)
            run('tcsh recovery', 'tcsh', 'echo 42\n', '42\n')

        if args.language in (None, 'wasm') and 'wasm' in runtimes:
            def wasi_text(text, body=None, imports=''):
                raw=text.encode(); data=''.join('\\%02x'%b for b in raw)
                emit='(drop (call $write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 8)))'
                return '(module (import "wasi_snapshot_preview1" "fd_write" (func $write (param i32 i32 i32 i32) (result i32))) '+imports+' (memory (export "memory") 1) (data (i32.const 32) "'+data+'") (func (export "_start") (i32.store (i32.const 0) (i32.const 32)) (i32.store (i32.const 4) (i32.const '+str(len(raw))+')) '+(body or emit)+'))'
            run('Wasm computed integer with WASI output', 'wasm', ';; Wasm arithmetic with real WASI output\n(module\n  (import "wasi_snapshot_preview1" "fd_write"\n    (func $write (param i32 i32 i32 i32) (result i32)))\n  (memory (export "memory") 1)\n  (func (export "_start") (local $n i32)\n    (local.set $n (i32.mul (i32.const 7) (i32.const 7)))\n    (i32.store (i32.const 0) (i32.const 16))\n    (i32.store (i32.const 4) (i32.const 3))\n    (i32.store8 (i32.const 16) (i32.add (i32.const 48) (i32.div_u (local.get $n) (i32.const 10))))\n    (i32.store8 (i32.const 17) (i32.add (i32.const 48) (i32.rem_u (local.get $n) (i32.const 10))))\n    (i32.store8 (i32.const 18) (i32.const 10))\n    (drop (call $write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 8)))))\n', '49\n')
            run('Wasm Unicode WASI output', 'wasm', wasi_text('博物馆\n'), '博物馆\n')
            echo='(module (import "wasi_snapshot_preview1" "fd_read" (func $read (param i32 i32 i32 i32) (result i32))) (import "wasi_snapshot_preview1" "fd_write" (func $write (param i32 i32 i32 i32) (result i32))) (memory (export "memory") 1) (func (export "_start") (i32.store (i32.const 0) (i32.const 32)) (i32.store (i32.const 4) (i32.const 1024)) (drop (call $read (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 8))) (i32.store (i32.const 4) (i32.load (i32.const 8))) (drop (call $write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 8)))))'
            run('Wasm multiline UTF-8 WASI stdin', 'wasm', echo, 'hello\n博物馆\n', stdin='hello\n博物馆\n')
            run('Wasm invalid WAT rejected', 'wasm', '(module (func', '', state='failed')
            run('Wasm type validation rejected', 'wasm', '(module (func (export "_start") i32.const 1))', '', state='failed')
            run('Wasm integer divide by zero traps', 'wasm', '(module (func (export "_start") (drop (i32.div_s (i32.const 7) (i32.const 0)))))', '', state='failed')
            run('Wasm out of bounds memory traps', 'wasm', '(module (memory 1) (func (export "_start") (drop (i32.load (i32.const 65536)))))', '', state='failed')
            result=run('Wasm WASI proc_exit preserves status', 'wasm', '(module (import "wasi_snapshot_preview1" "proc_exit" (func $exit (param i32))) (memory (export "memory") 1) (func (export "_start") (call $exit (i32.const 7))))', '', state='failed')
            assert result['exitCode']==7, result
            run('Wasm browser host import rejected', 'wasm', '(module (import "env" "console_log" (func $log)) (func (export "_start") (call $log)))', '', state='failed')
            run('Wasm component model disabled', 'wasm', '(component)', '', state='failed')
            run('Wasm linear memory bounded', 'wasm', '(module (memory 4097) (func (export "_start")))', '', state='failed')
            spin='(module (func (export "_start") (loop $again (br $again))))'
            run('Wasm timeout', 'wasm', spin, state='timed_out')
            emit='(loop $again (drop (call $write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 8))) (br $again))'
            run('Wasm bounded WASI output', 'wasm', wasi_text('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n',emit), state='output_limit')
            run('Wasm cancellation', 'wasm', spin, state='cancelled', cancel_after=1)
            emit='(drop (call $write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 8)))'
            imports='(import "wasi_snapshot_preview1" "fd_prestat_get" (func $prestat (param i32 i32) (result i32)))'
            body='(if (i32.ne (call $prestat (i32.const 3) (i32.const 64)) (i32.const 8)) (then unreachable)) '+emit
            run('Wasm no preopened directory', 'wasm', wasi_text('no-preopen\n',body,imports), 'no-preopen\n')
            imports='(import "wasi_snapshot_preview1" "environ_sizes_get" (func $env (param i32 i32) (result i32)))'
            body='(drop (call $env (i32.const 64) (i32.const 68))) (if (i32.load (i32.const 64)) (then unreachable)) '+emit
            run('Wasm no inherited environment', 'wasm', wasi_text('no-env\n',body,imports), 'no-env\n')
            run('Wasm recovery', 'wasm', wasi_text('42\n'), '42\n')

        if args.language in (None, 'x86-assembly') and 'x86-assembly' in runtimes:
            run('x86-64 integer loop', 'x86-assembly', 'section .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nxor eax,eax\nmov ecx,10\nagain:\nadd eax,ecx\nloop again\nxor edx,edx\nmov ecx,10\ndiv ecx\nadd al,48\nadd dl,48\nmov [rel buffer],al\nmov [rel buffer+1],dl\nmov byte [rel buffer+2],10\nmov eax,1\nmov edi,1\nlea rsi,[rel buffer]\nmov edx,3\nsyscall\nmov eax,60\nxor edi,edi\nsyscall\n', '55\n')
            run('x86-64 native function', 'x86-assembly', 'section .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nmov eax,7\ncall square\nxor edx,edx\nmov ecx,10\ndiv ecx\nadd al,48\nadd dl,48\nmov [rel buffer],al\nmov [rel buffer+1],dl\nmov byte [rel buffer+2],10\nmov eax,1\nmov edi,1\nlea rsi,[rel buffer]\nmov edx,3\nsyscall\nmov eax,60\nxor edi,edi\nsyscall\nsquare:\nimul eax,eax\nret\n', '49\n')
            run('x86-64 multiline UTF-8 syscall input', 'x86-assembly', 'section .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nxor eax,eax\nxor edi,edi\nlea rsi,[rel buffer]\nmov edx,1024\nsyscall\nmov rdx,rax\nmov eax,1\nmov edi,1\nsyscall\nmov eax,60\nxor edi,edi\nsyscall\n', 'hello\n博物馆\n', stdin='hello\n博物馆\n')
            run('x86-64 NASM syntax rejection', 'x86-assembly', 'section .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nmuseum_invalid_instruction eax,ebx\nmov eax,60\nxor edi,edi\nsyscall\n', '', state='compile_error')
            run('x86-64 linker undefined symbol rejection', 'x86-assembly', 'section .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nextern museum_missing_symbol\ncall museum_missing_symbol\nmov eax,60\nxor edi,edi\nsyscall\n', '', state='compile_error')
            run('x86-64 native divide by zero', 'x86-assembly', 'section .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nmov eax,7\nxor edx,edx\nxor ecx,ecx\ndiv ecx\nmov eax,60\nxor edi,edi\nsyscall\n', '', state='failed')
            run('x86-64 native invalid memory access', 'x86-assembly', 'section .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nxor eax,eax\nmov [rax],rax\nmov eax,60\nxor edi,edi\nsyscall\n', '', state='failed')
            result=run('x86-64 explicit exit status', 'x86-assembly', 'section .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nmov eax,60\nmov edi,7\nsyscall\nmov eax,60\nxor edi,edi\nsyscall\n', '', state='failed')
            assert result['exitCode']==7, result
            result=run('x86-64 compiler warning preserved', 'x86-assembly', '%warning intentional-warning\nsection .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nmov eax,7\ncall square\nxor edx,edx\nmov ecx,10\ndiv ecx\nadd al,48\nadd dl,48\nmov [rel buffer],al\nmov [rel buffer+1],dl\nmov byte [rel buffer+2],10\nmov eax,1\nmov edi,1\nlea rsi,[rel buffer]\nmov edx,3\nsyscall\nmov eax,60\nxor edi,edi\nsyscall\nsquare:\nimul eax,eax\nret\n', '49\n')
            assert 'intentional-warning' in result['compilerStderr'], result
            spin='section .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\njmp $\nmov eax,60\nxor edi,edi\nsyscall\n'
            run('x86-64 timeout', 'x86-assembly', spin, state='timed_out')
            run('x86-64 bounded syscall output', 'x86-assembly', 'section .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nmov byte[rel buffer],120\nagain:\nmov eax,1\nmov edi,1\nlea rsi,[rel buffer]\nmov edx,1\nsyscall\njmp again\nmov eax,60\nxor edi,edi\nsyscall\n', state='output_limit')
            run('x86-64 cancellation', 'x86-assembly', spin, state='cancelled', cancel_after=1)
            run('x86-64 recovery', 'x86-assembly', 'section .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nmov eax,7\ncall square\nxor edx,edx\nmov ecx,10\ndiv ecx\nadd al,48\nadd dl,48\nmov [rel buffer],al\nmov [rel buffer+1],dl\nmov byte [rel buffer+2],10\nmov eax,1\nmov edi,1\nlea rsi,[rel buffer]\nmov edx,3\nsyscall\nmov eax,60\nxor edi,edi\nsyscall\nsquare:\nimul eax,eax\nret\n', '49\n')

        if args.language in (None, 'verilog') and 'verilog' in runtimes:
            run('Verilog simulated counter', 'verilog', '// Verilog simulated counter\nmodule main;\n  reg clk = 0;\n  integer count = 0;\n  always #5 clk = ~clk;\n  always @(posedge clk) begin\n    count = count + 1;\n    $display("count=%0d", count);\n    if (count == 3) $finish;\n  end\nendmodule\n', 'count=1\ncount=2\ncount=3\n')
            run('Verilog function and arithmetic', 'verilog', 'module main; function integer square; input integer n; begin square=n*n; end endfunction initial begin $display("%0d",square(7)); $finish; end endmodule', '49\n')
            run('Verilog four-state X and Z', 'verilog', 'module main; reg [3:0] bits; initial begin bits=4\'b10xz; $display("%b",bits); $finish; end endmodule', '10xz\n')
            run('Verilog delayed combinational assignment', 'verilog', 'module main; reg a,b; wire y; assign y=a & b; initial begin a=1;b=0;#1;$display("%b",y);b=1;#1;$display("%b",y);$finish;end endmodule', '0\n1\n')
            run('Verilog multiline UTF-8 stdin', 'verilog', 'module main; reg [8191:0] line; integer n; initial begin repeat (2) begin n=$fgets(line,32\'h80000000); if(n>0) $write("%0s",line); end $finish; end endmodule', 'hello\n博物馆\n', stdin='hello\n博物馆\n')
            run('Verilog syntax rejection', 'verilog', 'module main initial begin $display("must_not_run"); end endmodule', '', state='compile_error')
            run('Verilog elaboration rejects undefined module', 'verilog', 'module main; museum_missing_module x(); initial $display("must_not_run"); endmodule', '', state='compile_error')
            run('Verilog fatal stops simulation', 'verilog', 'module main; initial $fatal(1,"intentional failure"); endmodule', state='failed')
            run('Verilog stop is noninteractive failure', 'verilog', 'module main; initial $stop; endmodule', state='failed')
            spin='module main; initial forever #1; endmodule'
            run('Verilog simulation wall timeout', 'verilog', spin, state='timed_out')
            run('Verilog bounded output', 'verilog', 'module main; initial forever $display("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"); endmodule', state='output_limit')
            run('Verilog cancellation', 'verilog', spin, state='cancelled', cancel_after=1)
            run('Verilog recovery', 'verilog', 'module main; initial begin $display("42"); $finish; end endmodule', '42\n')

        if args.language in (None, 'vhdl') and 'vhdl' in runtimes:
            run('VHDL timed text simulation', 'vhdl', '-- VHDL timed text simulation\nuse std.textio.all;\nentity main is end entity;\narchitecture test of main is\nbegin\n  process\n    variable line_out : line;\n  begin\n    for n in 1 to 3 loop\n      wait for 5 ns;\n      write(line_out, string\'("count="));\n      write(line_out, n);\n      writeline(output, line_out);\n    end loop;\n    wait;\n  end process;\nend architecture;\n', 'count=1\ncount=2\ncount=3\n')
            run('VHDL typed function', 'vhdl', 'use std.textio.all;\nentity main is end entity;\narchitecture test of main is\nfunction square(n:integer) return integer is begin return n*n; end function;\nbegin\nprocess\nvariable l:line;\n\nbegin\nwrite(l,square(7)); writeline(output,l);\nwait;\nend process;\nend architecture;\n', '49\n')
            run('VHDL record type', 'vhdl', 'use std.textio.all;\nentity main is end entity;\narchitecture test of main is\n\nbegin\nprocess\nvariable l:line;\ntype point is record x,y:integer; end record; variable p:point;\nbegin\np.x:=3;p.y:=4;write(l,p.x*p.x+p.y*p.y);writeline(output,l);\nwait;\nend process;\nend architecture;\n', '25\n')
            run('VHDL IEEE multivalued logic', 'vhdl', 'library ieee;use ieee.std_logic_1164.all;use std.textio.all;entity main is end entity;\narchitecture test of main is\n\nbegin\nprocess\nvariable l:line;\n\nbegin\nwrite(l,to_string(std_logic_vector\'( "10XZ" )));writeline(output,l);\nwait;\nend process;\nend architecture;\n', '10XZ\n')
            run('VHDL simulated time assertion', 'vhdl', 'use std.textio.all;\nentity main is end entity;\narchitecture test of main is\n\nbegin\nprocess\nvariable l:line;\n\nbegin\nwait for 5 ns;assert now=5 ns severity failure;write(l,string\'("time-ok"));writeline(output,l);\nwait;\nend process;\nend architecture;\n', 'time-ok\n')
            run('VHDL multiline UTF-8 TextIO input', 'vhdl', 'use std.textio.all;\nentity main is end entity;\narchitecture test of main is\n\nbegin\nprocess\nvariable l:line;\n\nbegin\nfor n in 1 to 2 loop readline(input,l); writeline(output,l); end loop;\nwait;\nend process;\nend architecture;\n', 'hello\n博物馆\n', stdin='hello\n博物馆\n')
            run('VHDL syntax rejection', 'vhdl', 'entity main is end entity architecture broken of main is begin end architecture;', '', state='compile_error')
            run('VHDL incompatible type rejection', 'vhdl', 'use std.textio.all;\nentity main is end entity;\narchitecture test of main is\n\nbegin\nprocess\nvariable l:line;\nvariable value:integer;\nbegin\nvalue:=true;\nwait;\nend process;\nend architecture;\n', '', state='compile_error')
            run('VHDL runtime bound check', 'vhdl', 'use std.textio.all;\nentity main is end entity;\narchitecture test of main is\n\nbegin\nprocess\nvariable l:line;\nvariable value:integer range 0 to 3;\nbegin\nvalue:=4;\nwait;\nend process;\nend architecture;\n', state='failed')
            run('VHDL error-level assertion stops simulation', 'vhdl', 'use std.textio.all;\nentity main is end entity;\narchitecture test of main is\n\nbegin\nprocess\nvariable l:line;\n\nbegin\nassert false report "intentional failure" severity error;\nwait;\nend process;\nend architecture;\n', state='failed')
            result=run('VHDL warning remains successful', 'vhdl', 'use std.textio.all;\nentity main is end entity;\narchitecture test of main is\n\nbegin\nprocess\nvariable l:line;\n\nbegin\nassert false report "intentional warning" severity warning;write(l,42);writeline(output,l);\nwait;\nend process;\nend architecture;\n')
            assert 'intentional warning' in result['stdout']+result['stderr'] and result['stdout'].endswith('42\n'), result
            spin='use std.textio.all;\nentity main is end entity;\narchitecture test of main is\n\nbegin\nprocess\nvariable l:line;\n\nbegin\nwhile true loop null; end loop;\nwait;\nend process;\nend architecture;\n'
            run('VHDL wall timeout', 'vhdl', spin, state='timed_out')
            run('VHDL bounded output', 'vhdl', 'use std.textio.all;\nentity main is end entity;\narchitecture test of main is\n\nbegin\nprocess\nvariable l:line;\n\nbegin\nwhile true loop write(l,string\'("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"));writeline(output,l);end loop;\nwait;\nend process;\nend architecture;\n', state='output_limit')
            run('VHDL cancellation', 'vhdl', spin, state='cancelled', cancel_after=1)
            run('VHDL recovery', 'vhdl', 'use std.textio.all;\nentity main is end entity;\narchitecture test of main is\n\nbegin\nprocess\nvariable l:line;\n\nbegin\nwrite(l,42);writeline(output,l);\nwait;\nend process;\nend architecture;\n', '42\n')

        if args.language in (None, 'postscript') and 'postscript' in runtimes:
            run('PostScript stack procedure', 'postscript', '/square { dup mul } bind def 7 square =', '49\n')
            run('PostScript array fold', 'postscript', '0 [3 4 5] {add} forall =', '12\n')
            run('PostScript recursive factorial', 'postscript', '/fact {dup 1 le {pop 1} {dup 1 sub fact mul} ifelse} bind def 5 fact =', '120\n')
            run('PostScript dictionary lookup', 'postscript', '/d 2 dict def d begin /x 6 def end d /x get 2 mul =', '12\n')
            run('PostScript multiline UTF-8 stdin', 'postscript', '/f (%stdin) (r) file def /s 4096 string def\n2 { f s readline { print (\\n) print } { pop } ifelse } repeat\n', 'hello\n博物馆\n', stdin='hello\n博物馆\n')
            run('PostScript real syntax error', 'postscript', '{', state='failed')
            run('PostScript undefined operator', 'postscript', 'museumMissingOperator', state='failed')
            run('PostScript real stack underflow', 'postscript', 'pop', state='failed')
            run('PostScript divide by zero', 'postscript', '1 0 div =', state='failed')
            run('PostScript caught error succeeds', 'postscript', '{1 0 div} stopped {clear (handled\\n) print} if', 'handled\n')
            result=run('PostScript SAFER denies unapproved read', 'postscript', '(/etc/passwd) (r) file', state='failed')
            assert 'invalidfileaccess' in result['stdout']+result['stderr'], result
            result=run('PostScript SAFER denies file write', 'postscript', '(/work/forbidden) (w) file', state='failed')
            assert 'invalidfileaccess' in result['stdout']+result['stderr'], result
            run('PostScript timeout', 'postscript', '{} loop', state='timed_out')
            run('PostScript bounded output', 'postscript', '{(xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\\n) print flush} loop', state='output_limit')
            run('PostScript cancellation', 'postscript', '{} loop', state='cancelled', cancel_after=1)
            run('PostScript recovery', 'postscript', '42 =', '42\n')

        if args.language in (None, 'bcpl') and 'bcpl' in runtimes:
            header = 'GET "libhdr"\n'
            def bcpl(body): return header + 'LET start() = VALOF { ' + body + '; RESULTIS 0 }\n'
            run('BCPL native function', 'bcpl', header + 'LET square(n) = n*n\nLET start() = VALOF { writef("%n*n",square(7)); RESULTIS 0 }', '49\n')
            run('BCPL vector and edited output', 'bcpl', bcpl('LET v = VEC 2; v!0:=3; v!1:=4; v!2:=5; writef("%n*n",v!0+v!1+v!2)'), '12\n')
            run('BCPL recursive factorial', 'bcpl', header + 'LET fact(n) = n<=1 -> 1, n*fact(n-1)\nLET start() = VALOF { writef("%n*n",fact(5)); RESULTIS 0 }', '120\n')
            run('BCPL multiline UTF-8 stdin', 'bcpl', bcpl('LET ch=rdch(); WHILE ch~=-1 DO { wrch(ch); ch:=rdch() }'), 'hello\n博物馆\n', stdin='hello\n博物馆\n')
            run('BCPL leftover stdin is not a CLI command', 'bcpl', bcpl('writef("42*n")'), '42\n', stdin='echo must_not_run\n')
            result=run('BCPL syntax rejection prevents execution', 'bcpl', header + 'LET start( =', '', 'compile_error')
            assert 'runMs' not in result and result.get('compilerStdout'), result
            run('BCPL undefined name', 'bcpl', bcpl('museumMissingFunction()'), '', 'compile_error')
            result=run('BCPL division trap exits nonzero', 'bcpl', bcpl('LET n=0; writef("%n*n",7/n)'), state='failed')
            assert 'BCPL Cintcode stopped: code 5' in result['stderr'], result
            pc = re.search(r'PC (\d+)', result['stderr'])
            assert pc and int(pc.group(1)) > 6, result  # This program faults in bytecode, not the ST=1 register.
            result=run('BCPL explicit return status', 'bcpl', header + 'LET start() = 7', '', 'failed')
            assert result['exitCode']==7, result
            run('BCPL timeout', 'bcpl', bcpl('WHILE TRUE DO {}'), state='timed_out')
            run('BCPL bounded output', 'bcpl', bcpl('WHILE TRUE DO writef("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx*n")'), state='output_limit')
            run('BCPL cancellation', 'bcpl', bcpl('WHILE TRUE DO {}'), state='cancelled', cancel_after=1)
            run('BCPL recovery', 'bcpl', bcpl('writef("42*n")'), '42\n')
        if args.language in (None, 'oberon') and 'oberon' in runtimes:
            def oberon(body, imports='Out', declarations=''):
                return 'MODULE Main; IMPORT '+imports+'; '+declarations+' BEGIN '+body+' END Main.\n'
            run('Oberon typed function', 'oberon', oberon('Out.Int(Square(7),0); Out.Ln', declarations='PROCEDURE Square(n:INTEGER):INTEGER; BEGIN RETURN n*n END Square;'), '49\n')
            run('Oberon array fold and edited source', 'oberon', oberon('v[0]:=3;v[1]:=4;v[2]:=5;s:=0;FOR i:=0 TO 2 DO s:=s+v[i] END;Out.Int(s,0);Out.Ln', declarations='VAR v:ARRAY 3 OF INTEGER; i,s:INTEGER;'), '12\n')
            run('Oberon records pointers and GC', 'oberon', oberon('NEW(p);p.value:=6;Out.Int(p.value*2,0);Out.Ln', declarations='TYPE Box=POINTER TO RECORD value:INTEGER END; VAR p:Box;'), '12\n')
            run('Oberon multiline UTF-8 stdin', 'oberon', oberon('In.Line(s);ASSERT(In.Done);Out.String(s);Out.Ln;In.Line(s);ASSERT(In.Done);Out.String(s);Out.Ln',imports='In,Out',declarations='VAR s:ARRAY 4096 OF CHAR;'), 'hello\n博物馆\n', stdin='hello\n博物馆\n')
            result=run('Oberon type rejection prevents execution', 'oberon', oberon('n:=TRUE;Out.Int(n,0)',declarations='VAR n:INTEGER;'), '', 'compile_error')
            assert 'runMs' not in result and result.get('compilerStderr'), result
            run('Oberon missing SDL module', 'oberon', oberon('XYplane.Open',imports='XYplane'), '', 'compile_error')
            result=run('Oberon explicit ASSERT(FALSE) exit', 'oberon', 'MODULE Main; BEGIN ASSERT(FALSE) END Main.', '', 'failed')
            assert result['exitCode']==1 and not result['stderr'], result
            result=run('Oberon checked assertion trap', 'oberon', oberon('n:=0;ASSERT(n>0)',declarations='VAR n:INTEGER;'), '', 'failed')
            assert 'Exception (E8)' in result['stderr'], result
            result=run('Oberon array bound trap', 'oberon', oberon('i:=2;a[i]:=1',declarations='VAR a:ARRAY 2 OF INTEGER;i:INTEGER;'), '', 'failed')
            assert 'Exception (E2)' in result['stderr'], result
            result=run('Oberon ordinary stderr succeeds', 'oberon', oberon('Err.String("diagnostic");Err.Ln;Out.Int(42,0);Out.Ln',imports='Err:=extErr,Out'), '42\n')
            assert 'diagnostic' in result['stderr'], result
            run('Oberon timeout', 'oberon', oberon('WHILE TRUE DO END'), state='timed_out')
            run('Oberon bounded output', 'oberon', oberon('WHILE TRUE DO Out.String("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");Out.Ln END'), state='output_limit')
            run('Oberon cancellation', 'oberon', oberon('WHILE TRUE DO END'), state='cancelled', cancel_after=1)
            run('Oberon recovery', 'oberon', oberon('Out.Int(42,0);Out.Ln'), '42\n')
    finally: runner.cleanup_stale()
    remaining = subprocess.check_output(['docker', 'ps', '-a', '--filter', 'label=' + runner.label, '--format', '{{.Names}}']).decode().strip()
    assert not remaining, remaining
    assert checks, "No cases executed for selected language"
    report = dict(checkedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), scope='Actual isolated Docker runc on the existing Linux preparation host; no production API changes, no downloads during tasks, not a container escape proof.', inputs={f: hashlib.sha256((ROOT / f).read_bytes()).hexdigest() for f in FILES}, runtimes=[runtimes[k] for k in ['algol-60','common-lisp','prolog','forth','racket','smalltalk','cobol','ada','clojure','ocaml','haskell','kotlin','groovy','erlang','elixir','tcl','standard-ml','scala','visual-basic.net','f-sharp','d','nim','zig','swift','dart','julia','octave','powershell','korn-shell','tcsh','wasm','x86-assembly','verilog','vhdl','postscript','bcpl','oberon'] if k in runtimes and args.language in (None,k)], checks=checks, leftoverContainers=0)
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')


if __name__ == '__main__': main()
