const assert=require('node:assert/strict');
module.exports=async function({evaluate,wait,page,screenshot,results,root}){
 let lastRun=0;
 const selected=process.env.PLANNED_LANGUAGE;
 const configured=new Set(JSON.parse(require('node:fs').readFileSync(require('node:path').join(root,'server/runtime-images.json'))).runtimes.map(r=>r.id));
 const samples=[["bcpl", "// BCPL native function\nGET \"libhdr\"\nLET square(n)=n*n\nLET start()=VALOF { writef(\"%n*n\",square(7)); RESULTIS 0 }\n", "", "49\n"], ["oberon", "(* Oberon typed function *)\nMODULE Main;\nIMPORT Out;\nPROCEDURE Square(n:INTEGER):INTEGER;\nBEGIN RETURN n*n END Square;\nBEGIN Out.Int(Square(7),0); Out.Ln END Main.\n", "", "49\n"],["postscript", "%!PS\n/square { dup mul } bind def\n7 square =\n", "", "49\n"],["vhdl", "-- VHDL typed function\nuse std.textio.all;\nentity main is end entity;\narchitecture test of main is\nfunction square(n:integer) return integer is begin return n*n; end function;\nbegin\nprocess\nvariable l:line;\n\nbegin\nwrite(l,square(7)); writeline(output,l);\nwait;\nend process;\nend architecture;\n", "", "49\n"],["verilog", "// Verilog simulated counter\nmodule main;\n  reg clk = 0;\n  integer count = 0;\n  always #5 clk = ~clk;\n  always @(posedge clk) begin\n    count = count + 1;\n    $display(\"count=%0d\", count);\n    if (count == 3) $finish;\n  end\nendmodule\n", "", "count=1\ncount=2\ncount=3\n"],["x86-assembly", "; NASM native function\nsection .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nmov eax,7\ncall square\nxor edx,edx\nmov ecx,10\ndiv ecx\nadd al,48\nadd dl,48\nmov [rel buffer],al\nmov [rel buffer+1],dl\nmov byte [rel buffer+2],10\nmov eax,1\nmov edi,1\nlea rsi,[rel buffer]\nmov edx,3\nsyscall\nmov eax,60\nxor edi,edi\nsyscall\nsquare:\nimul eax,eax\nret\n", "", "49\n"],["wasm", ";; Wasm arithmetic with real WASI output\n(module\n  (import \"wasi_snapshot_preview1\" \"fd_write\"\n    (func $write (param i32 i32 i32 i32) (result i32)))\n  (memory (export \"memory\") 1)\n  (func (export \"_start\") (local $n i32)\n    (local.set $n (i32.mul (i32.const 7) (i32.const 7)))\n    (i32.store (i32.const 0) (i32.const 16))\n    (i32.store (i32.const 4) (i32.const 3))\n    (i32.store8 (i32.const 16) (i32.add (i32.const 48) (i32.div_u (local.get $n) (i32.const 10))))\n    (i32.store8 (i32.const 17) (i32.add (i32.const 48) (i32.rem_u (local.get $n) (i32.const 10))))\n    (i32.store8 (i32.const 18) (i32.const 10))\n    (drop (call $write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 8)))))\n", "", "49\n"],["tcsh", "# tcsh list and arithmetic\nset values = (3 4 5)\n@ answer = $values[1] + $values[2] + $values[3]\necho $answer\n", "", "12\n"],["korn-shell", "# Korn shell native function\nfunction square {\n  print -r -- \"$(( $1 * $1 ))\"\n}\nsquare 7\n", "", "49\n"],["powershell", "# PowerShell typed function\nfunction Square([int]$n) {\n  $n * $n\n}\nSquare 7\n", "", "49\n"],["octave", "% GNU Octave single-file function\n1;\nfunction y = square(x)\n  y = x .* x;\nendfunction\nprintf(\"%d\\n\", square(7));\n", "", "49\n"],["julia", "# Julia method with a typed argument\nfunction square(x::Number)\n    x * x\nend\nprintln(square(7))\n", "", "49\n"],["dart", "// Dart AOT generic class\nclass Box<T> {\n  final T value;\n  Box(this.value);\n}\nvoid main() {\n  final box = Box(7);\n  print(box.value * box.value);\n}\n", "", "49\n"],["swift", "// Swift 6 generic function\nfunc square<T: Numeric>(_ n: T) -> T {\n    n * n\n}\nprint(square(7))\n", "", "49\n"],['algol-60','begin outstring(1,"museum 42") end\n','','museum 42'],['common-lisp','(defmacro twice (x) `(+ ,x ,x))\n(format t "~d~%" (twice 6))\n','','12\n'],['prolog','color(red). color(blue).\nmain :- findall(X,color(X),Xs), writeln(Xs).\n','','[red,blue]\n'],['forth',': square dup * ; 7 square . cr\n','','49 \n'],['racket','#lang racket/base\n(define-syntax-rule (twice x) (+ x x))\n(displayln (twice 6))\n','','12\n'],['smalltalk','(#(3 4 5) inject: 0 into: [:sum :n | sum + n]) printNl.\n','','12\n'],['cobol','identification division.\nprogram-id. museum.\nprocedure division.\ndisplay function upper-case("museum")\ngoback.\n','','MUSEUM\n'],['ada','with Ada.Text_IO; with Ada.Integer_Text_IO;\nprocedure Main is\n function Square(N : Integer) return Integer is\n begin return N * N; end Square;\nbegin Ada.Integer_Text_IO.Put(Square(7), Width => 0); Ada.Text_IO.New_Line; end Main;\n','','49\n'],['clojure','(defmacro twice [x] (list (quote +) x x))\n(println (twice 6))\n','','12\n'] ,['ocaml','let square n = n * n\nlet () = Printf.printf "%d\\n" (square 7)\n','','49\n'],['haskell','data Shape = Circle Int | Rectangle Int Int\narea (Circle r) = r * r\narea (Rectangle w h) = w * h\nmain :: IO ()\nmain = print (area (Rectangle 3 4))\n','','12\n'],['kotlin','data class Box(val value: Int)\nfun main() { val box: Box? = Box(6); println((box?.value ?: 0) * 2) }\n','','12\n'],['groovy','class Box { int value; int doubled() { value * 2 } }\nprintln(new Box(value: 6).doubled())\n','','12\n'],['erlang','-module(main).\n-export([main/0]).\nmain() -> Parent=self(), spawn(fun() -> Parent ! {result,7*7} end), receive {result,N} -> io:format("~p~n",[N]) end.\n','','49\n'],['elixir','parent = self()\nspawn(fn -> send(parent, {:result,7*7}) end)\nreceive do {:result,n} -> IO.puts(n) end\n','','49\n'],['tcl','oo::class create Box {\n variable value\n constructor {n} {set value $n}\n method doubled {} {expr {$value * 2}}\n}\nBox create box 6\nputs [box doubled]\n','','12\n'],['standard-ml','datatype shape = Circle of int | Rectangle of int * int;\nfun area (Circle r) = 3*r*r | area (Rectangle(w,h)) = w*h;\nval () = print(Int.toString(area(Rectangle(3,4))) ^ "\\n");\n','','12\n'],['scala','object Main {\n sealed trait Shape\n case class Rectangle(w: Int,h: Int) extends Shape\n def area(s: Shape): Int = s match { case Rectangle(w,h) => w*h }\n def main(args: Array[String]): Unit = println(area(Rectangle(3,4)))\n}\n','','12\n'],["visual-basic.net", "Imports System\nModule Museum\nFunction Square(n As Integer) As Integer\nReturn n*n\nEnd Function\nSub Main()\nConsole.WriteLine(Square(7))\nEnd Sub\nEnd Module\n", "", "49\n"],["f-sharp", "module Museum\ntype Shape = Circle of int | Rectangle of int * int\nlet area = function Circle r -> 3*r*r | Rectangle(w,h) -> w*h\n[<EntryPoint>]\nlet main _ =\n    printfn \"%d\" (area (Rectangle(3,4)))\n    0\n", "", "12\n"],["d", "import std.stdio;\nT square(T)(T n) { return n*n; }\nvoid main() { writeln(square(7)); }\n", "", "49\n"],["nim", "proc square[T](n:T):T = n*n\necho square(7)\n", "", "49\n"],["zig", "const std = @import(\"std\");\nfn square(comptime T:type,n:T) T { return n*n; }\npub fn main() !void { const value=comptime square(i32,7); try std.io.getStdOut().writer().print(\"{d}\\n\", .{value}); }\n", "", "49\n"]].filter(s=>(!selected||s[0]===selected)&&configured.has(s[0]));
 if(!samples.length)throw new Error('No planned browser cases for '+selected);
 const includes=id=>samples.some(s=>s[0]===id);
 const compiled=new Set(require('./execution-capabilities.cjs').executionCapabilities(root).languages.filter(r=>r.remote?.compileSeconds>0).map(r=>r.id));
 async function edit(code){await evaluate(`(()=>{const e=document.querySelector('#lab-code');e.value=${JSON.stringify(code)};e.dispatchEvent(new Event('input',{bubbles:true}))})()`)}
 async function run(){const delay=Math.max(0,6500-(Date.now()-lastRun));if(delay)await new Promise(ok=>setTimeout(ok,delay));lastRun=Date.now();await evaluate(`document.querySelector('#lab-run').click()`)}
 async function output(expected){await wait(`document.querySelector('#lab-result').dataset.state==='ok'&&document.querySelector('#lab-result').textContent===${JSON.stringify(expected)}`,30000)}
 for(const width of [1440,390]){
  await page('Emulation.setDeviceMetricsOverride',{width,height:width===1440?1000:844,mobile:width===390,deviceScaleFactor:1});
  await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(width===1440?'dark':'light')}`);
  for(const [id,code,stdin,expected] of samples){
   await wait(`window.MUSEUM_EXECUTION.canRun(${JSON.stringify(id)})`);
   const before=await evaluate('window.__posts');
   await evaluate(`window.MUSEUM_LAB.open(${JSON.stringify(id)});document.querySelector('#lab-stdin').value=${JSON.stringify(stdin)}`);
   await edit(code);assert.equal(await evaluate('window.__posts'),before);
   if(id==='bcpl'){assert.equal(await evaluate(`document.querySelector('#lab-file').textContent`),'main.b');assert.equal(await evaluate(`Array.from(document.querySelectorAll('#lab-highlight .tok-keyword')).some(s=>s.textContent==='RESULTIS')`),true);assert.match(await evaluate(`document.querySelector('#lab-highlight .tok-comment').textContent`),/BCPL native/)}
   if(id==='oberon'){assert.equal(await evaluate(`document.querySelector('#lab-file').textContent`),'Main.obn');assert.equal(await evaluate(`Array.from(document.querySelectorAll('#lab-highlight .tok-keyword')).some(s=>s.textContent==='PROCEDURE')`),true);assert.match(await evaluate(`document.querySelector('#lab-highlight .tok-comment').textContent`),/Oberon typed/)}
   if(id==='postscript'){assert.equal(await evaluate(`document.querySelector('#lab-file').textContent`),'main.ps');assert.equal(await evaluate(`Array.from(document.querySelectorAll('#lab-highlight .tok-keyword')).some(s=>s.textContent==='def')`),true);assert.match(await evaluate(`document.querySelector('#lab-highlight .tok-comment').textContent`),/PS/)}
   if(id==='vhdl'){assert.equal(await evaluate(`document.querySelector('#lab-file').textContent`),'main.vhd');assert.equal(await evaluate(`document.querySelector('#lab-run').textContent`),'仿真代码');assert.equal(await evaluate(`Array.from(document.querySelectorAll('#lab-highlight .tok-keyword')).some(s=>s.textContent==='architecture')`),true);assert.match(await evaluate(`document.querySelector('#lab-highlight .tok-comment').textContent`),/VHDL typed/)}
   if(id==='verilog'){assert.equal(await evaluate(`document.querySelector('#lab-file').textContent`),'main.v');assert.equal(await evaluate(`document.querySelector('#lab-run').textContent`),'仿真代码');assert.equal(await evaluate(`document.querySelector('#lab-output-label').textContent`),'仿真结果');assert.equal(await evaluate(`Array.from(document.querySelectorAll('#lab-highlight .tok-keyword')).some(s=>s.textContent==='endmodule')`),true)}
   if(id==='x86-assembly'){assert.equal(await evaluate(`document.querySelector('#lab-file').textContent`),'main.asm');assert.equal(await evaluate(`Array.from(document.querySelectorAll('#lab-highlight .tok-keyword')).some(s=>s.textContent==='syscall')`),true);assert.match(await evaluate(`document.querySelector('#lab-highlight .tok-comment').textContent`),/NASM/)}
   if(id==='wasm'){assert.equal(await evaluate(`document.querySelector('#lab-file').textContent`),'main.wat');assert.equal(await evaluate(`Array.from(document.querySelectorAll('#lab-highlight .tok-keyword')).some(s=>s.textContent==='i32.mul')`),true);assert.match(await evaluate(`document.querySelector('#lab-highlight .tok-comment').textContent`),/Wasm arithmetic/)}
   if(id==='tcsh')assert.equal(await evaluate(`document.querySelector('#lab-file').textContent`),'main.tcsh');
   if(id==='korn-shell'){assert.equal(await evaluate(`document.querySelector('#lab-file').textContent`),'main.ksh');assert.equal(await evaluate(`Array.from(document.querySelectorAll('#lab-highlight .tok-keyword')).some(s=>s.textContent==='function')`),true)}
   if(id==='powershell'){assert.equal(await evaluate(`Array.from(document.querySelectorAll('#lab-highlight .tok-keyword')).some(s=>s.textContent.toLowerCase()==='function')`),true);assert.match(await evaluate(`document.querySelector('#lab-highlight .tok-comment').textContent`),/PowerShell typed/)}
   if(id==='octave'){assert.equal(await evaluate(`Array.from(document.querySelectorAll('#lab-highlight .tok-keyword')).some(s=>s.textContent==='endfunction')`),true);assert.match(await evaluate(`document.querySelector('#lab-highlight .tok-comment').textContent`),/GNU Octave/)}
   if(id==='julia'){assert.equal(await evaluate(`Array.from(document.querySelectorAll('#lab-highlight .tok-keyword')).some(s=>s.textContent==='function')`),true);assert.match(await evaluate(`document.querySelector('#lab-highlight .tok-comment').textContent`),/Julia method/)}
   if(id==='dart'){assert.equal(await evaluate(`Array.from(document.querySelectorAll('#lab-highlight .tok-keyword')).some(s=>s.textContent==='final')`),true);assert.match(await evaluate(`document.querySelector('#lab-highlight .tok-comment').textContent`),/Dart AOT/)}
   if(id==='swift'){assert.equal(await evaluate(`Array.from(document.querySelectorAll('#lab-highlight .tok-keyword')).some(s=>s.textContent==='func')`),true);assert.match(await evaluate(`document.querySelector('#lab-highlight .tok-comment').textContent`),/Swift 6 generic/)}
   assert.equal(await evaluate(`document.querySelector('#lab-execution-mode option[value="local"]').disabled`),true);
   await run();await output(expected);
   assert.equal(await evaluate(`document.querySelector('#lab-compiler').hidden`),!compiled.has(id));
   if(id==='kotlin')assert.doesNotMatch(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/Failed to load native library|UnsatisfiedLinkError/);
   assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
   await evaluate(`document.querySelector('#lab-result').scrollIntoView({block:'center'})`);
   await screenshot('planned-'+id+'-'+width+'.png');
   results.push({name:id+' edited source executes in actual browser with correct diagnostics controls',width,output:expected});
  }
 }
 if(includes('algol-60')){
 await evaluate(`window.MUSEUM_LAB.open('algol-60')`);await edit('begin integer ; end\n');await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`);
 assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/missing simple variable/);
 results.push({name:'ALGOL 60 syntax rejection is separate from execution',passed:true});
 await edit('begin outstring(1,"ready") end\n');await run();await output('ready');
 results.push({name:'ALGOL 60 recovery executes changed source',passed:true});
 }
 if(includes('common-lisp')){
 await evaluate(`window.MUSEUM_LAB.open('common-lisp');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
 await edit('(loop for line = (read-line *standard-input* nil nil) while line do (format t "[~a]~%" line))');await run();await output('[hello]\n[博物馆]\n');
 results.push({name:'Common Lisp multiline UTF-8 stdin',passed:true});
 await edit('(error "intentional error")');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
 assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
 results.push({name:'Common Lisp actual errors appear without fake success',passed:true});
 await edit('(format t "ready~%")');await run();await output('ready\n');
 results.push({name:'Common Lisp recovers after a real error',passed:true});
 }
 if(includes('prolog')){
 await evaluate(`window.MUSEUM_LAB.open('prolog')`);
 await edit('broken( .\nmain :- writeln(must_not_run).');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
 assert.doesNotMatch(await evaluate(`document.querySelector('#lab-result').textContent`),/must_not_run/);
 results.push({name:'Prolog syntax error halts before main in actual browser',passed:true});
 await edit('main :- writeln(ready).');await run();await output('ready\n');
 results.push({name:'Prolog real recovery after syntax error',passed:true});
 }
 if(includes('forth')){
 await evaluate(`window.MUSEUM_LAB.open('forth')`);
 await edit('museum_missing_word');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
 assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/Undefined word/i);
 results.push({name:'Forth undefined word is a real interpreter failure',passed:true});
 await edit('." ready" cr');await run();await output('ready\n');
 results.push({name:'Forth recovers after interpreter failure',passed:true});
 }
 if(includes('racket')){
  await evaluate(`window.MUSEUM_LAB.open('racket');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit('#lang racket/base\n(let loop () (define line (read-line)) (unless (eof-object? line) (displayln (string-append "[" line "]")) (loop)))');await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'Racket multiline UTF-8 input',passed:true});
  await edit('#lang racket/base\n(define value )');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/define|syntax/);
  results.push({name:'Racket genuine syntax error',passed:true});
  await edit('#lang racket/base\n(displayln 42)');await run();await output('42\n');
  results.push({name:'Racket recovery executes changed source',passed:true});
 }
 if(includes('smalltalk')){
  const painted=await evaluate(`window.MUSEUM_LAB.formatCode('(\"note\" #(3 4 5))', 'smalltalk')`);
  assert.equal((painted.match(/tok-comment/g)||[]).length,1);
  assert.match(painted,/#\(<span class="tok-number">3/);
  await evaluate(`window.MUSEUM_LAB.open('smalltalk')`);
  await edit('| broken');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/parse error/);
  results.push({name:'Smalltalk parser errors return real failed status',passed:true});
  await edit('1 / 0.');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  results.push({name:'Smalltalk unhandled runtime exception returns failed status',passed:true});
  await edit('42 printNl.');await run();await output('42\n');
  results.push({name:'Smalltalk recovery executes changed source',passed:true});
 }
 if(includes('cobol')){
  await evaluate(`window.MUSEUM_LAB.open('cobol')`);
  await edit('identification division.\nprogram-id. museum.\nprocedure division.\ndisplay "MUST_NOT_RUN"\nadd 1 to .\n');await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-result').textContent`),/MUST_NOT_RUN/);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/error/i);
  results.push({name:'COBOL compile error is separate and prevents execution',passed:true});
  await edit('identification division.\nprogram-id. museum.\nprocedure division.\ndisplay 42\ngoback.\n');await run();await output('42\n');
  results.push({name:'COBOL recovery compiles and executes changed source',passed:true});
 }
 if(includes('ada')){
  await evaluate(`window.MUSEUM_LAB.open('ada')`);
  await edit('with Ada.Text_IO;\nprocedure Main is N : Integer;\nbegin Ada.Text_IO.Put_Line("MUST_NOT_RUN"); N := "wrong"; end Main;\n');await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-result').textContent`),/MUST_NOT_RUN/);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/expected|error/i);
  results.push({name:'Ada type error is separate and prevents execution',passed:true});
  await edit('procedure Main is begin raise Constraint_Error; end Main;\n');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/CONSTRAINT_ERROR|Constraint_Error/);
  results.push({name:'Ada unhandled exception returns an actual runtime failure',passed:true});
  await edit('with Ada.Text_IO;\nprocedure Main is begin Ada.Text_IO.Put_Line("ready"); end Main;\n');await run();await output('ready\n');
  results.push({name:'Ada recovery compiles and executes changed source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);
  assert.equal(downloaded,'main.adb');
  results.push({name:'Ada source download preserves the mandatory Main unit filename',passed:true});
 }
 if(includes('clojure')){
  await evaluate(`window.MUSEUM_LAB.open('clojure');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit('(doseq [_ (range 2)] (println (str "[" (read-line) "]")))');await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'Clojure multiline UTF-8 stdin',passed:true});
  await edit('(defn broken [');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/EOF while reading|Syntax error/);
  results.push({name:'Clojure actual reader error',passed:true});
  await edit('(throw (ex-info "intentional error" {}))');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'Clojure actual runtime exception',passed:true});
  await edit('(println 42)');await run();await output('42\n');
  results.push({name:'Clojure recovery executes changed source',passed:true});
 }
 if(includes('ocaml')){
  await evaluate(`window.MUSEUM_LAB.open('ocaml');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit('let () = for _ = 1 to 2 do Printf.printf "[%s]\\n" (read_line ()) done\n');await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'OCaml multiline UTF-8 stdin',passed:true});
  await edit('let () = print_endline "MUST_NOT_RUN"\nlet broken = "wrong" + 1\n');await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-result').textContent`),/MUST_NOT_RUN/);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/Error|expected/);
  results.push({name:'OCaml static type rejection prevents execution',passed:true});
  await edit('let () = failwith "intentional error"\n');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'OCaml actual runtime exception',passed:true});
  await edit('let () = print_endline "ready"\n');await run();await output('ready\n');
  results.push({name:'OCaml recovery compiles and executes changed source',passed:true});
 }
 if(includes('haskell')){
  await evaluate(`window.MUSEUM_LAB.open('haskell');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit('import Control.Monad (replicateM_)\nmain :: IO ()\nmain = replicateM_ 2 (getLine >>= putStrLn . ("[" ++) . (++ "]"))\n');await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'Haskell multiline UTF-8 stdin',passed:true});
  await edit('broken :: Int\nbroken = "wrong"\nmain :: IO ()\nmain = putStrLn "MUST_NOT_RUN"\n');await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-result').textContent`),/MUST_NOT_RUN/);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/error|match/);
  results.push({name:'Haskell static type rejection prevents execution',passed:true});
  await edit('main :: IO ()\nmain = error "intentional error"\n');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'Haskell actual runtime exception',passed:true});
  await edit('main :: IO ()\nmain = print (42 :: Int)\n');await run();await output('42\n');
  results.push({name:'Haskell recovery compiles and executes changed source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);
  assert.equal(downloaded,'Main.hs');
  results.push({name:'Haskell download preserves the Main module filename',passed:true});
 }
 if(includes('kotlin')){
  await evaluate(`window.MUSEUM_LAB.open('kotlin');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit('fun main() { repeat(2) { println("[" + readln() + "]") } }\n');await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'Kotlin multiline UTF-8 stdin',passed:true});
  await edit('fun main() { println("MUST_NOT_RUN"); val n: Int = "wrong"; println(n) }\n');await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`,45000);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-result').textContent`),/MUST_NOT_RUN/);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/error|mismatch/);
  results.push({name:'Kotlin static type rejection prevents execution',passed:true});
  await edit('fun main() { error("intentional error") }\n');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`,45000);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'Kotlin actual runtime exception',passed:true});
  await edit('fun main() { println(42) }\n');await run();await output('42\n');
  results.push({name:'Kotlin recovery compiles and executes changed source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);
  assert.equal(downloaded,'Main.kt');
  results.push({name:'Kotlin source download uses the compiler entry filename',passed:true});
 }
 if(includes('groovy')){
  await evaluate(`window.MUSEUM_LAB.open('groovy');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit('def reader = new BufferedReader(new InputStreamReader(System.in, "UTF-8"))\n2.times { println("[" + reader.readLine() + "]") }\n');await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'Groovy multiline UTF-8 stdin',passed:true});
  await edit('def broken = [');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/compilation|Unexpected/i);
  results.push({name:'Groovy actual script compiler error',passed:true});
  await edit('throw new IllegalStateException("intentional error")');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'Groovy actual runtime exception',passed:true});
  await edit('println(42)');await run();await output('42\n');
  results.push({name:'Groovy recovery executes changed source',passed:true});
 }
 if(includes('erlang')){
  await evaluate(`window.MUSEUM_LAB.open('erlang');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit('-module(main).\n-export([main/0]).\nmain() -> io:setopts(standard_io,[{encoding,unicode}]), lists:foreach(fun(_) -> Line=io:get_line(""), io:put_chars(["[",string:trim(Line),"]\\n"]) end,[1,2]).\n');await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'Erlang multiline UTF-8 stdin',passed:true});
  await edit('-module(main).\n-export([main/0]).\nmain() -> io:format("MUST_NOT_RUN"), broken(.\n');await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-result').textContent`),/MUST_NOT_RUN/);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/syntax error|error/i);
  results.push({name:'Erlang actual compiler error prevents execution',passed:true});
  await edit('-module(main).\n-export([main/0]).\nmain() -> erlang:error(intentional_error).\n');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional_error/);
  results.push({name:'Erlang actual runtime exception',passed:true});
  await edit('-module(main).\n-export([main/0]).\nmain() -> io:format("42~n").\n');await run();await output('42\n');
  results.push({name:'Erlang recovery compiles and executes changed source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);
  assert.equal(downloaded,'main.erl');
  results.push({name:'Erlang download preserves the required module filename',passed:true});
 }
 if(includes('elixir')){
  await evaluate(`window.MUSEUM_LAB.open('elixir');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit('Enum.each(1..2, fn _ -> line = IO.read(:stdio, :line); IO.puts("[" <> String.trim_trailing(line, "\\n") <> "]") end)');await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'Elixir multiline UTF-8 stdin',passed:true});
  await edit('if true do\n');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/TokenMissingError|SyntaxError|missing/i);
  results.push({name:'Elixir actual script syntax error',passed:true});
  await edit('raise "intentional error"');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'Elixir actual runtime exception',passed:true});
  await edit('IO.puts(42)');await run();await output('42\n');
  results.push({name:'Elixir recovery executes changed source',passed:true});
 }
 if(includes('tcl')){
  await evaluate(`window.MUSEUM_LAB.open('tcl');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit('fconfigure stdin -encoding utf-8\nfconfigure stdout -encoding utf-8\nforeach _ {1 2} {puts [format {[%s]} [gets stdin]]}');await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'Tcl multiline UTF-8 stdin',passed:true});
  await edit('set broken {');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/missing close-brace/i);
  results.push({name:'Tcl actual parser error',passed:true});
  await edit('error "intentional error"');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'Tcl actual runtime error',passed:true});
  await edit('puts 42');await run();await output('42\n');
  results.push({name:'Tcl recovery executes changed source',passed:true});
 }
 if(includes('standard-ml')){
  await evaluate(`window.MUSEUM_LAB.open('standard-ml');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit('fun line () = case TextIO.inputLine TextIO.stdIn of SOME s => print("[" ^ String.substring(s,0,String.size s-1) ^ "]\\n") | NONE => ();\nval () = (line(); line());');await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'Standard ML multiline UTF-8 stdin',passed:true});
  await edit('val bad : int = "wrong";');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/incompatible types|unify/i);
  results.push({name:'Standard ML actual static type error',passed:true});
  await edit('val () = print "before\\n";\nval bad : int = "wrong";');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/^before\n/);
  results.push({name:'Standard ML preserves prior declaration output before a later type error',passed:true});
  await edit('val () = raise Fail "intentional error";');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'Standard ML actual unhandled exception',passed:true});
  await edit('val () = print "42\\n";');await run();await output('42\n');
  results.push({name:'Standard ML recovery executes changed source',passed:true});
 }
 if(includes('scala')){
  await evaluate(`window.MUSEUM_LAB.open('scala');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit('object Main { def main(args: Array[String]): Unit = (1 to 2).foreach(_ => println("[" + scala.io.StdIn.readLine() + "]")) }');await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'Scala multiline UTF-8 stdin',passed:true});
  await edit('object Main { def main(args: Array[String]): Unit = { println("MUST_NOT_RUN"); val n: Int = "wrong"; println(n) } }');await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`,45000);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-result').textContent`),/MUST_NOT_RUN/);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/error|mismatch/i);
  results.push({name:'Scala static type rejection prevents execution',passed:true});
  await edit('object Main { def main(args: Array[String]): Unit = throw new RuntimeException("intentional error") }');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`,45000);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'Scala actual runtime exception',passed:true});
  await edit('object Main { def main(args: Array[String]): Unit = println(42) }');await run();await output('42\n');
  results.push({name:'Scala recovery compiles and executes changed source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);
  assert.equal(downloaded,'Main.scala');
  results.push({name:'Scala source download uses the compiler entry filename',passed:true});
 }
 if(includes('visual-basic.net')){
  const vb=body=>'Imports System\nModule Museum\nSub Main()\n'+body+'\nEnd Sub\nEnd Module\n';
  const painted=await evaluate(`window.MUSEUM_LAB.formatCode("' note\\nDiM n As Integer = 1", 'visual-basic.net')`);
  assert.match(painted,/tok-comment/);assert.match(painted,/<span class="tok-keyword">DiM/);
  await evaluate(`window.MUSEUM_LAB.open('visual-basic.net');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit(vb('Console.InputEncoding = New System.Text.UTF8Encoding(False)\nConsole.OutputEncoding = New System.Text.UTF8Encoding(False)\nFor n As Integer = 1 To 2\nConsole.WriteLine("[" & Console.ReadLine() & "]")\nNext'));await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'VB.NET multiline UTF-8 stdin and native comment/keyword highlighting',passed:true});
  await edit(vb('Console.WriteLine("MUST_NOT_RUN")\nDim n As Integer = "wrong"\nConsole.WriteLine(n)'));await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`,45000);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-result').textContent`),/MUST_NOT_RUN/);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/Option Strict|error|BC30512/i);
  results.push({name:'VB.NET strict type error prevents execution',passed:true});
  await edit(vb('Throw New Exception("intentional error")'));await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`,45000);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'VB.NET actual runtime exception',passed:true});
  await edit(vb('Console.WriteLine(42)'));await run();await output('42\n');
  results.push({name:'VB.NET recovery compiles and executes changed source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);
  assert.equal(downloaded,'Main.vb');
  results.push({name:'VB.NET source download uses the displayed filename',passed:true});
 }
 if(includes('f-sharp')){
  const fs=body=>'module Museum\n[<EntryPoint>]\nlet main _ =\n'+body.split('\n').map(s=>'    '+s+'\n').join('')+'    0\n';
  await evaluate(`window.MUSEUM_LAB.open('f-sharp');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit(fs('System.Console.InputEncoding <- System.Text.UTF8Encoding(false)\nSystem.Console.OutputEncoding <- System.Text.UTF8Encoding(false)\nfor _ in 1..2 do\n    printfn "[%s]" (System.Console.ReadLine())'));await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'F# multiline UTF-8 stdin',passed:true});
  await edit(fs('printfn "MUST_NOT_RUN"\nlet n:int = "wrong"\nprintfn "%d" n'));await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`,45000);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-result').textContent`),/MUST_NOT_RUN/);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/FS0001|error/i);
  results.push({name:'F# type error prevents execution',passed:true});
  await edit(fs('failwith "intentional error"'));await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`,45000);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'F# actual runtime exception',passed:true});
  await edit(fs('printfn "42"'));await run();await output('42\n');
  results.push({name:'F# recovery compiles and executes changed source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);
  assert.equal(downloaded,'Main.fs');
  results.push({name:'F# source download uses the displayed filename',passed:true});
 }
 if(includes('d')){
  await evaluate(`window.MUSEUM_LAB.open('d');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit('import std.stdio; import std.string; void main() { foreach(_;0..2) writeln("[",readln().strip(),"]"); }');await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'D multiline UTF-8 stdin',passed:true});
  await edit('import std.stdio; void main() { writeln("MUST_NOT_RUN"); int n="wrong"; writeln(n); }');await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-result').textContent`),/MUST_NOT_RUN/);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/error|convert/i);
  results.push({name:'D static type error prevents execution',passed:true});
  await edit('void main() { throw new Exception("intentional error"); }');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'D actual runtime exception',passed:true});
  await edit('import std.stdio; void main() { writeln(42); }');await run();await output('42\n');
  results.push({name:'D recovery compiles and executes changed source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);
  assert.equal(downloaded,'main.d');
  results.push({name:'D source download matches the displayed and executed filename',passed:true});
 }
 if(includes('nim')){
  await evaluate(`window.MUSEUM_LAB.open('nim');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit('for _ in 0..<2:\n  echo "[" & stdin.readLine() & "]"\n');await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'Nim multiline UTF-8 stdin',passed:true});
  await edit('echo "MUST_NOT_RUN"\nlet n:int = "wrong"\necho n\n');await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`,35000);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-result').textContent`),/MUST_NOT_RUN/);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/Error|type mismatch/);
  results.push({name:'Nim type error prevents execution',passed:true});
  await edit('raise newException(ValueError,"intentional error")\n');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`,35000);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'Nim actual runtime exception',passed:true});
  await edit('echo 42\n');await run();await output('42\n');
  results.push({name:'Nim recovery compiles and executes changed source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);
  assert.equal(downloaded,'main.nim');
  results.push({name:'Nim source download matches the displayed filename',passed:true});
 }
 if(includes('zig')){
  await evaluate(`window.MUSEUM_LAB.open('zig');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit("const std = @import(\"std\");\npub fn main() !void { const input=std.io.getStdIn().reader(); const output=std.io.getStdOut().writer(); var buf:[1024]u8=undefined; for(0..2) |_| { const line=(try input.readUntilDelimiterOrEof(&buf, '\\n')) orelse break; try output.print(\"[{s}]\\n\", .{line}); } }\n");await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'Zig multiline UTF-8 stdin',passed:true});
  await edit("const std = @import(\"std\");\npub fn main() !void { try std.io.getStdOut().writer().writeAll(\"MUST_NOT_RUN\\n\"); const n:i32=\"wrong\"; _=n; }\n");await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`,45000);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-result').textContent`),/MUST_NOT_RUN/);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/error|expected/i);
  results.push({name:'Zig type error prevents execution',passed:true});
  await edit('pub fn main() !void { return error.Intentional; }');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`,45000);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/Intentional/);
  results.push({name:'Zig actual unhandled error union',passed:true});
  await edit('pub fn main() void { @panic("intentional error"); }');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`,45000);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'Zig actual panic',passed:true});
  await edit("const std = @import(\"std\");\npub fn main() !void { try std.io.getStdOut().writer().writeAll(\"42\\n\"); }\n");await run();await output('42\n');
  results.push({name:'Zig recovery compiles and executes changed source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);
  assert.equal(downloaded,'main.zig');
  results.push({name:'Zig source download matches the displayed filename',passed:true});
 }
 if(includes('swift')){
  await evaluate(`window.MUSEUM_LAB.open('swift');document.querySelector('#lab-stdin').value=${JSON.stringify("hello\n博物馆\n")}`);
  await edit("for _ in 0..<2 { if let line=readLine() { print(\"[\\(line)]\") } }\n");
  await run();await output('[hello]\n[博物馆]\n');
  results.push({name:'Swift multiline UTF-8 stdin',passed:true});
  await edit('print("MUST_NOT_RUN")\nlet n:Int="wrong"\nprint(n)\n');await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`,45000);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-result').textContent`),/MUST_NOT_RUN/);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/error|cannot convert/i);
  results.push({name:'Swift type error prevents execution',passed:true});
  await edit('enum Failure:Error { case expected }\nthrow Failure.expected\n');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`,45000);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/expected|Error raised/i);
  results.push({name:'Swift actual unhandled error',passed:true});
  await edit('print(42)');await run();await output('42\n');
  results.push({name:'Swift recovery compiles and executes changed source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);
  assert.equal(downloaded,'main.swift');results.push({name:'Swift source download matches the displayed filename',passed:true});
  await evaluate(`document.querySelector('#lab-environment-summary').click()`);
  assert.match(await evaluate(`document.querySelector('#lab-environment-detail').textContent`),/Swift Package Manager.*Apple UI/);
  results.push({name:'Swift version and Linux scope remain visible',passed:true});
 }
 if(includes('dart')){
  await evaluate(`window.MUSEUM_LAB.open('dart');document.querySelector('#lab-stdin').value=${JSON.stringify("hello\n博物馆\n")}`);
  await edit("import \"dart:io\"; import \"dart:convert\";\nvoid main() { for(var i=0;i<2;i++) { final line=stdin.readLineSync(encoding:utf8); print(\"[$line]\"); } }");await run();await output("[hello]\n[博物馆]\n");
  results.push({name:'Dart multiline UTF-8 stdin',passed:true});
  await edit("void main() { print(\"MUST_NOT_RUN\"); int n=\"wrong\"; print(n); }");await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`,30000);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-result').textContent`),/MUST_NOT_RUN/);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/error|assigned/i);
  results.push({name:'Dart type error prevents execution',passed:true});
  await edit("void main() { throw StateError(\"intentional error\"); }");await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`,30000);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'Dart actual unhandled exception',passed:true});
  const uploads=await evaluate('window.__posts');
  await evaluate(`(()=>{const data=new DataTransfer();data.items.add(new File(['void main() { print(42); }'],'import.dart',{type:'text/plain'}));const input=document.querySelector('#lab-import-file');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait(`document.querySelector('#lab-code').value==='void main() { print(42); }'`);assert.equal(await evaluate('window.__posts'),uploads);
  results.push({name:'Dart file import never uploads or executes automatically',passed:true});
  await run();await output("42\n");
  results.push({name:'Dart recovery executes imported source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);
  assert.equal(downloaded,'main.dart');results.push({name:'Dart source download matches the displayed filename',passed:true});
  await evaluate(`document.querySelector('#lab-environment-summary').click()`);
  assert.match(await evaluate(`document.querySelector('#lab-environment-detail').textContent`),/pub.*Flutter/);
  results.push({name:'Dart AOT version and standard-library scope remain visible',passed:true});
 }
 if(includes('julia')){
  await evaluate(`window.MUSEUM_LAB.open('julia');document.querySelector('#lab-stdin').value=${JSON.stringify("hello\n博物馆\n")}`);
  await edit("for _ in 1:2\n println(\"[\",readline(),\"]\")\nend\n");await run();await output("[hello]\n[博物馆]\n");
  results.push({name:'Julia multiline UTF-8 stdin',passed:true});
  await edit("function broken(\n");await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/ParseError|syntax|error/i);
  assert.equal(await evaluate(`document.querySelector('#lab-compiler').hidden`),true);
  results.push({name:'Julia actual syntax error is not presented as compiler success',passed:true});
  await edit("println(\"before\")\nerror(\"intentional error\")\n");await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/before/);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'Julia runtime error preserves real prior stdout',passed:true});
  const uploads=await evaluate('window.__posts');
  await evaluate(`(()=>{const data=new DataTransfer();data.items.add(new File(['δ=6; println(δ*7)'],'import.jl',{type:'text/plain'}));const input=document.querySelector('#lab-import-file');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait(`document.querySelector('#lab-code').value==='δ=6; println(δ*7)'`);assert.equal(await evaluate('window.__posts'),uploads);
  results.push({name:'Julia UTF-8 source import never uploads or executes automatically',passed:true});
  await run();await output("42\n");
  results.push({name:'Julia recovery executes imported Unicode source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);
  assert.equal(downloaded,'main.jl');results.push({name:'Julia source download matches the displayed filename',passed:true});
  await evaluate(`document.querySelector('#lab-environment-summary').click()`);
  assert.match(await evaluate(`document.querySelector('#lab-environment-detail').textContent`),/Pkg.*Notebook/);
  results.push({name:'Julia JIT and package limitations remain visible',passed:true});
 }
 if(includes('octave')){
  await evaluate(`window.MUSEUM_LAB.open('octave');document.querySelector('#lab-stdin').value=${JSON.stringify("hello\n博物馆\n")}`);
  await edit("for n=1:2\n line=fgetl(stdin); printf(\"[%s]\\n\",line);\nendfor\n");await run();await output("[hello]\n[博物馆]\n");
  results.push({name:'Octave multiline UTF-8 stdin',passed:true});
  await edit("x = ;\n");await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/parse|syntax|error/i);assert.equal(await evaluate(`document.querySelector('#lab-compiler').hidden`),true);
  results.push({name:'Octave actual syntax error is shown without fake success',passed:true});
  await edit("disp(\"before\"); error(\"intentional error\");\n");await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/before/);assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  results.push({name:'Octave runtime error preserves real prior stdout',passed:true});
  const uploads=await evaluate('window.__posts');
  await evaluate(`(()=>{const data=new DataTransfer();data.items.add(new File([${JSON.stringify("% 中文注释\nprintf(\"42\\n\");\n")}],'import.m',{type:'text/plain'}));const input=document.querySelector('#lab-import-file');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait(`document.querySelector('#lab-code').value.includes('中文注释')`);assert.equal(await evaluate('window.__posts'),uploads);
  results.push({name:'Octave UTF-8 import never uploads or executes automatically',passed:true});
  await run();await output("42\n");
  results.push({name:'Octave recovery executes imported source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);
  assert.equal(downloaded,'main.m');results.push({name:'Octave source download matches the displayed filename',passed:true});
  await evaluate(`document.querySelector('#lab-environment-summary').click()`);assert.match(await evaluate(`document.querySelector('#lab-environment-detail').textContent`),/pkg.*绘图/);
  results.push({name:'GNU Octave text-only scope remains visible',passed:true});
 }
 if(includes('powershell')){
  await evaluate(`window.MUSEUM_LAB.open('powershell');document.querySelector('#lab-stdin').value=${JSON.stringify("hello\n博物馆\n")}`);
  await edit("1..2 | ForEach-Object { Write-Output (\"[\"+[Console]::ReadLine()+\"]\") }");await run();await output("[hello]\n[博物馆]\n");
  results.push({name:'PowerShell multiline UTF-8 stdin',passed:true});
  await edit("function broken {");await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/brace|ParserError|Missing|error/i);assert.equal(await evaluate(`document.querySelector('#lab-compiler').hidden`),true);
  results.push({name:'PowerShell real parser error fails',passed:true});
  await edit("Write-Error \"intentional error\"");await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);results.push({name:'PowerShell default ErrorActionPreference Stop is real',passed:true});
  await edit("[Console]::Error.WriteLine(\"ordinary stderr\"); Write-Output 42");await run();await wait(`document.querySelector('#lab-result').dataset.state==='ok'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/42/);assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/ordinary stderr/);results.push({name:'PowerShell ordinary stderr remains successful and visible',passed:true});
  const uploads=await evaluate('window.__posts');
  await evaluate(`(()=>{const data=new DataTransfer();data.items.add(new File([${JSON.stringify("# 中文注释\nWrite-Output 42\n")}],'import.ps1',{type:'text/plain'}));const input=document.querySelector('#lab-import-file');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait(`document.querySelector('#lab-code').value.includes('中文注释')`);assert.equal(await evaluate('window.__posts'),uploads);results.push({name:'PowerShell UTF-8 import never uploads or executes automatically',passed:true});
  await run();await output("42\n");results.push({name:'PowerShell recovery executes imported source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);assert.equal(downloaded,'main.ps1');results.push({name:'PowerShell source download matches the displayed filename',passed:true});
  await evaluate(`document.querySelector('#lab-environment-summary').click()`);assert.match(await evaluate(`document.querySelector('#lab-environment-detail').textContent`),/ErrorActionPreference=Stop.*Gallery/);results.push({name:'PowerShell default error policy and Linux scope remain visible',passed:true});
 }

 if(includes('korn-shell')){
  await evaluate(`window.MUSEUM_LAB.open('korn-shell');document.querySelector('#lab-stdin').value=${JSON.stringify("hello\n博物馆\n")}`);
  await edit('for n in 1 2; do IFS= read -r line; print -r -- "[$line]"; done');await run();await output('[hello]\n[博物馆]\n');results.push({name:'Korn shell multiline UTF-8 input',passed:true});
  await edit('if then');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/syntax/i);results.push({name:'Korn shell genuine parser error',passed:true});
  await edit('false; print -r -- handled');await run();await output('handled\n');results.push({name:'Korn shell native status allows handled failure',passed:true});
  const uploads=await evaluate('window.__posts');
  await evaluate(`(()=>{const data=new DataTransfer();data.items.add(new File([${JSON.stringify('# 中文注释\nprint -r -- 42\n')}],'import.ksh',{type:'text/plain'}));const input=document.querySelector('#lab-import-file');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait(`document.querySelector('#lab-code').value.includes('中文注释')`);assert.equal(await evaluate('window.__posts'),uploads);results.push({name:'Korn shell import does not upload or execute',passed:true});
  await run();await output('42\n');results.push({name:'Korn shell recovery executes imported source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);assert.equal(downloaded,'main.ksh');results.push({name:'Korn shell download filename',passed:true});
  await evaluate(`document.querySelector('#lab-environment-summary').click()`);assert.match(await evaluate(`document.querySelector('#lab-environment-detail').textContent`),/ksh93u\+m.*ksh88/);results.push({name:'Korn shell concrete implementation scope visible',passed:true});
 }

 if(includes('tcsh')){
  await evaluate(`window.MUSEUM_LAB.open('tcsh');document.querySelector('#lab-stdin').value=${JSON.stringify("hello\n博物馆\n")}`);
  await edit('foreach n (1 2)\n set line = "$<"\n echo "[$line]"\nend\n');await run();await output('[hello]\n[博物馆]\n');results.push({name:'tcsh multiline UTF-8 input',passed:true});
  await edit('echo "broken\n');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/Unmatched|quote/i);results.push({name:'tcsh genuine parser error',passed:true});
  await edit('false\necho handled\n');await run();await output('handled\n');results.push({name:'tcsh native final status preserved',passed:true});
  const uploads=await evaluate('window.__posts');
  await evaluate(`(()=>{const data=new DataTransfer();data.items.add(new File([${JSON.stringify('# 中文注释\necho 42\n')}],'import.tcsh',{type:'text/plain'}));const input=document.querySelector('#lab-import-file');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait(`document.querySelector('#lab-code').value.includes('中文注释')`);assert.equal(await evaluate('window.__posts'),uploads);results.push({name:'tcsh import does not upload or execute',passed:true});
  await run();await output('42\n');results.push({name:'tcsh recovery executes imported source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);assert.equal(downloaded,'main.tcsh');results.push({name:'tcsh download filename',passed:true});
  await evaluate(`document.querySelector('#lab-environment-summary').click()`);assert.match(await evaluate(`document.querySelector('#lab-environment-detail').textContent`),/6\.24\.07.*-f.*早期 csh/);results.push({name:'tcsh concrete implementation scope visible',passed:true});
 }

 if(includes('wasm')){
  await evaluate(`window.MUSEUM_LAB.open('wasm');document.querySelector('#lab-stdin').value=${JSON.stringify("hello\n博物馆\n")}`);
  await edit("(module (import \"wasi_snapshot_preview1\" \"fd_read\" (func $read (param i32 i32 i32 i32) (result i32))) (import \"wasi_snapshot_preview1\" \"fd_write\" (func $write (param i32 i32 i32 i32) (result i32))) (memory (export \"memory\") 1) (func (export \"_start\") (i32.store (i32.const 0) (i32.const 32)) (i32.store (i32.const 4) (i32.const 1024)) (drop (call $read (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 8))) (i32.store (i32.const 4) (i32.load (i32.const 8))) (drop (call $write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 8)))))");await run();await output('hello\n博物馆\n');results.push({name:'Wasm real multiline UTF-8 WASI input',passed:true});
  await edit('(module (func');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/expected|parse|end|Error/i);results.push({name:'Wasm genuine WAT parse failure',passed:true});
  await edit('(module (func (export "_start") unreachable))');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/unreachable/);results.push({name:'Wasm actual guest trap is visible',passed:true});
  const uploads=await evaluate('window.__posts');
  await evaluate(`(()=>{const data=new DataTransfer();data.items.add(new File([${JSON.stringify(";; \u4e2d\u6587\u6ce8\u91ca\n;; Wasm arithmetic with real WASI output\n(module\n  (import \"wasi_snapshot_preview1\" \"fd_write\"\n    (func $write (param i32 i32 i32 i32) (result i32)))\n  (memory (export \"memory\") 1)\n  (func (export \"_start\") (local $n i32)\n    (local.set $n (i32.mul (i32.const 7) (i32.const 7)))\n    (i32.store (i32.const 0) (i32.const 16))\n    (i32.store (i32.const 4) (i32.const 3))\n    (i32.store8 (i32.const 16) (i32.add (i32.const 48) (i32.div_u (local.get $n) (i32.const 10))))\n    (i32.store8 (i32.const 17) (i32.add (i32.const 48) (i32.rem_u (local.get $n) (i32.const 10))))\n    (i32.store8 (i32.const 18) (i32.const 10))\n    (drop (call $write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 8)))))\n")}],'import.wat',{type:'text/plain'}));const input=document.querySelector('#lab-import-file');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait(`document.querySelector('#lab-code').value.includes('中文注释')`);assert.equal(await evaluate('window.__posts'),uploads);results.push({name:'Wasm import does not upload or execute',passed:true});
  await run();await output('49\n');results.push({name:'Wasm recovery executes imported source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);assert.equal(downloaded,'main.wat');results.push({name:'Wasm WAT download filename',passed:true});
  await evaluate(`document.querySelector('#lab-environment-summary').click()`);assert.match(await evaluate(`document.querySelector('#lab-environment-detail').textContent`),/WASI Preview 1.*组件模型.*浏览器宿主/);results.push({name:'Wasm WAT and WASI host scope visible',passed:true});
 }

 if(includes('x86-assembly')){
  await evaluate(`window.MUSEUM_LAB.open('x86-assembly');document.querySelector('#lab-stdin').value=${JSON.stringify("hello\n博物馆\n")}`);
  await edit("section .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nxor eax,eax\nxor edi,edi\nlea rsi,[rel buffer]\nmov edx,1024\nsyscall\nmov rdx,rax\nmov eax,1\nmov edi,1\nsyscall\nmov eax,60\nxor edi,edi\nsyscall\n");await run();await output('hello\n博物馆\n');results.push({name:'x86-64 real UTF-8 syscall input',passed:true});
  await edit("section .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nmuseum_invalid_instruction eax,ebx\nmov eax,60\nxor edi,edi\nsyscall\n");await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`);assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/error|instruction/i);results.push({name:'x86-64 NASM error blocks execution with compiler diagnostics',passed:true});
  await edit("section .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nextern museum_missing_symbol\ncall museum_missing_symbol\nmov eax,60\nxor edi,edi\nsyscall\n");await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`);assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/undefined reference/);results.push({name:'x86-64 linker error blocks execution',passed:true});
  const uploads=await evaluate('window.__posts');
  await evaluate(`(()=>{const data=new DataTransfer();data.items.add(new File([${JSON.stringify("; \u4e2d\u6587\u6ce8\u91ca\nsection .bss\n buffer resb 1024\nsection .text\n global _start\n_start:\nmov eax,7\ncall square\nxor edx,edx\nmov ecx,10\ndiv ecx\nadd al,48\nadd dl,48\nmov [rel buffer],al\nmov [rel buffer+1],dl\nmov byte [rel buffer+2],10\nmov eax,1\nmov edi,1\nlea rsi,[rel buffer]\nmov edx,3\nsyscall\nmov eax,60\nxor edi,edi\nsyscall\nsquare:\nimul eax,eax\nret\n")}],'import.asm',{type:'text/plain'}));const input=document.querySelector('#lab-import-file');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait(`document.querySelector('#lab-code').value.includes('中文注释')`);assert.equal(await evaluate('window.__posts'),uploads);results.push({name:'x86-64 import does not upload or execute',passed:true});
  await run();await output('49\n');results.push({name:'x86-64 recovery executes imported source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);assert.equal(downloaded,'main.asm');results.push({name:'x86-64 assembly download filename',passed:true});
  await evaluate(`document.querySelector('#lab-environment-summary').click()`);assert.match(await evaluate(`document.querySelector('#lab-environment-detail').textContent`),/ELF64.*8086/);results.push({name:'x86-64 ISA and Linux ABI scope visible',passed:true});
 }

 if(includes('verilog')){
  await evaluate(`window.MUSEUM_LAB.open('verilog');document.querySelector('#lab-stdin').value=${JSON.stringify("hello\n博物馆\n")}`);
  await edit("module main; reg [8191:0] line; integer n; initial begin repeat (2) begin n=$fgets(line,32'h80000000); if(n>0) $write(\"%0s\",line); end $finish; end endmodule");await run();await output('hello\n博物馆\n');results.push({name:'Verilog real UTF-8 simulation stdin',passed:true});
  await edit('module main initial begin $display("must_not_run"); end endmodule');await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`);assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/syntax|error/i);results.push({name:'Verilog syntax error blocks simulation',passed:true});
  await edit('module main; initial $fatal(1,"intentional failure"); endmodule');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional failure/);results.push({name:'Verilog native fatal simulation error visible',passed:true});
  const uploads=await evaluate('window.__posts');
  await evaluate(`(()=>{const data=new DataTransfer();data.items.add(new File([${JSON.stringify('// 中文注释\nmodule main; initial begin $display("42"); $finish; end endmodule\n')}],'import.v',{type:'text/plain'}));const input=document.querySelector('#lab-import-file');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait(`document.querySelector('#lab-code').value.includes('中文注释')`);assert.equal(await evaluate('window.__posts'),uploads);results.push({name:'Verilog import does not upload or simulate',passed:true});
  await run();await output('42\n');results.push({name:'Verilog recovery simulates imported source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);assert.equal(downloaded,'main.v');results.push({name:'Verilog source download filename',passed:true});
  await evaluate(`document.querySelector('#lab-environment-summary').click()`);assert.match(await evaluate(`document.querySelector('#lab-environment-detail').textContent`),/文本仿真.*FPGA.*真实电路/);results.push({name:'Verilog simulation boundary visible',passed:true});
  await evaluate(`window.MUSEUM_LAB.open('javascript')`);assert.equal(await evaluate(`document.querySelector('#lab-run').textContent`),'运行代码');await evaluate(`window.MUSEUM_LAB.open('verilog')`);assert.equal(await evaluate(`document.querySelector('#lab-run').textContent`),'仿真代码');results.push({name:'Simulation action labels reset when switching languages',passed:true});
 }

 if(includes('vhdl')){
  await evaluate(`window.MUSEUM_LAB.open('vhdl');document.querySelector('#lab-stdin').value=${JSON.stringify("hello\n博物馆\n")}`);
  await edit("use std.textio.all;\nentity main is end entity;\narchitecture test of main is\n\nbegin\nprocess\nvariable l:line;\n\nbegin\nfor n in 1 to 2 loop readline(input,l); writeline(output,l); end loop;\nwait;\nend process;\nend architecture;\n");await run();await output('hello\n博物馆\n');results.push({name:'VHDL real UTF-8 TextIO input',passed:true});
  await edit("use std.textio.all;\nentity main is end entity;\narchitecture test of main is\n\nbegin\nprocess\nvariable l:line;\nvariable value:integer;\nbegin\nvalue:=true;\nwait;\nend process;\nend architecture;\n");await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`);assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/type|match|literal/i);results.push({name:'VHDL typed rejection blocks simulation',passed:true});
  await edit("use std.textio.all;\nentity main is end entity;\narchitecture test of main is\n\nbegin\nprocess\nvariable l:line;\n\nbegin\nassert false report \"intentional failure\" severity error;\nwait;\nend process;\nend architecture;\n");await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional failure/);results.push({name:'VHDL native assertion failure visible',passed:true});
  const uploads=await evaluate('window.__posts');
  await evaluate(`(()=>{const data=new DataTransfer();data.items.add(new File([${JSON.stringify("-- \u4e2d\u6587\u6ce8\u91ca\nuse std.textio.all;\nentity main is end entity;\narchitecture test of main is\n\nbegin\nprocess\nvariable l:line;\n\nbegin\nwrite(l,42);writeline(output,l);\nwait;\nend process;\nend architecture;\n")}],'import.vhd',{type:'text/plain'}));const input=document.querySelector('#lab-import-file');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait(`document.querySelector('#lab-code').value.includes('中文注释')`);assert.equal(await evaluate('window.__posts'),uploads);results.push({name:'VHDL import does not upload or simulate',passed:true});
  await run();await output('42\n');results.push({name:'VHDL recovery simulates imported source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);assert.equal(downloaded,'main.vhd');results.push({name:'VHDL source download filename',passed:true});
  await evaluate(`document.querySelector('#lab-environment-summary').click()`);assert.match(await evaluate(`document.querySelector('#lab-environment-detail').textContent`),/assert-level=error.*FPGA.*真实电路/);results.push({name:'VHDL assertion policy and simulation boundary visible',passed:true});
 }

 if(includes('postscript')){
  await evaluate(`window.MUSEUM_LAB.open('postscript');document.querySelector('#lab-stdin').value=${JSON.stringify("hello\n博物馆\n")}`);
  await edit("/f (%stdin) (r) file def /s 4096 string def\n2 { f s readline { print (\\n) print } { pop } ifelse } repeat\n");await run();await output('hello\n博物馆\n');results.push({name:'PostScript real UTF-8 standard input',passed:true});
  await edit('museumMissingOperator');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/undefined/);results.push({name:'PostScript native interpreter failure visible',passed:true});
  await edit('{1 0 div} stopped {clear (handled\n) print} if');await run();await output('handled\n');results.push({name:'PostScript native stopped error handling succeeds',passed:true});
  const uploads=await evaluate('window.__posts');
  await evaluate(`(()=>{const data=new DataTransfer();data.items.add(new File([${JSON.stringify('% 中文注释\n42 =\n')}],'import.ps',{type:'text/plain'}));const input=document.querySelector('#lab-import-file');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait(`document.querySelector('#lab-code').value.includes('中文注释')`);assert.equal(await evaluate('window.__posts'),uploads);results.push({name:'PostScript import does not upload or execute',passed:true});
  await run();await output('42\n');results.push({name:'PostScript recovery executes imported source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);assert.equal(downloaded,'main.ps');results.push({name:'PostScript source download filename',passed:true});
  await evaluate(`document.querySelector('#lab-environment-summary').click()`);assert.match(await evaluate(`document.querySelector('#lab-environment-detail').textContent`),/SAFER.*NODISPLAY.*页面渲染/);results.push({name:'PostScript text-only and device boundary visible',passed:true});
 }

 if(includes('bcpl')){
  await evaluate(`window.MUSEUM_LAB.open('bcpl');document.querySelector('#lab-stdin').value=${JSON.stringify("hello\n博物馆\n")}`);
  await edit('GET "libhdr"\nLET start()=VALOF { LET ch=rdch(); WHILE ch~=-1 DO { wrch(ch); ch:=rdch() }; RESULTIS 0 }\n');await run();await output('hello\n博物馆\n');results.push({name:'BCPL real multiline UTF-8 byte input',passed:true});
  await edit('GET "libhdr"\nLET start( =\n');await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`);assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/Error|missing|expected/i);results.push({name:'BCPL compiler error blocks execution with separate diagnostics',passed:true});
  await edit('GET "libhdr"\nLET start()=VALOF { LET n=0; writef("%n*n",7/n); RESULTIS 0 }\n');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/BCPL Cintcode stopped: code 5/);results.push({name:'BCPL division trap is a real noninteractive failure',passed:true});
  const uploads=await evaluate('window.__posts');
  await evaluate(`(()=>{const data=new DataTransfer();data.items.add(new File([${JSON.stringify('// 中文注释\nGET "libhdr"\nLET start()=VALOF { writef("42*n"); RESULTIS 0 }\n')}],'import.b',{type:'text/plain'}));const input=document.querySelector('#lab-import-file');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait(`document.querySelector('#lab-code').value.includes('中文注释')`);assert.equal(await evaluate('window.__posts'),uploads);results.push({name:'BCPL UTF-8 import does not upload or execute',passed:true});
  await run();await output('42\n');results.push({name:'BCPL recovery executes imported changed source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);assert.equal(downloaded,'main.b');results.push({name:'BCPL source download filename',passed:true});
  await evaluate(`document.querySelector('#lab-environment-summary').click()`);assert.match(await evaluate(`document.querySelector('#lab-environment-detail').textContent`),/main\.b.*start\(\).*64.*图形.*历史机器/);await screenshot('planned-bcpl-limits-390.png');results.push({name:'BCPL word size, entry point and runtime boundary visible',passed:true});
 }
 if(includes('oberon')){
  await evaluate(`window.MUSEUM_LAB.open('oberon');document.querySelector('#lab-stdin').value=${JSON.stringify("hello\n博物馆\n")}`);
  await edit('MODULE Main; IMPORT In,Out; VAR s:ARRAY 4096 OF CHAR; BEGIN In.Line(s); Out.String(s); Out.Ln; In.Line(s); Out.String(s); Out.Ln END Main.\n');await run();await output('hello\n博物馆\n');results.push({name:'Oberon real multiline UTF-8 text input',passed:true});
  await edit('MODULE Main; IMPORT Out; VAR n:INTEGER; BEGIN n:=TRUE; Out.Int(n,0) END Main.\n');await run();await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`);assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/type|INTEGER|incompatible|expected/i);results.push({name:'Oberon type rejection blocks execution with separate diagnostics',passed:true});
  await edit('MODULE Main; VAR n:INTEGER; BEGIN n:=0; ASSERT(n>0) END Main.\n');await run();await wait(`document.querySelector('#lab-result').dataset.state==='error'`);assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/assert|Exception|E8/i);results.push({name:'Oberon native assertion failure visible',passed:true});
  const uploads=await evaluate('window.__posts');
  await evaluate(`(()=>{const data=new DataTransfer();data.items.add(new File([${JSON.stringify('(* 中文注释 *)\nMODULE Main; IMPORT Out; BEGIN Out.Int(42,0); Out.Ln END Main.\n')}],'import.obn',{type:'text/plain'}));const input=document.querySelector('#lab-import-file');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait(`document.querySelector('#lab-code').value.includes('中文注释')`);assert.equal(await evaluate('window.__posts'),uploads);results.push({name:'Oberon UTF-8 import does not upload or execute',passed:true});
  await run();await output('42\n');results.push({name:'Oberon recovery executes imported changed source',passed:true});
  const downloaded=await evaluate(`(()=>{const original=HTMLAnchorElement.prototype.click;let name;HTMLAnchorElement.prototype.click=function(){name=this.download};try{document.querySelector('#lab-download').click()}finally{HTMLAnchorElement.prototype.click=original}return name})()`);assert.equal(downloaded,'Main.obn');results.push({name:'Oberon module source download filename',passed:true});
  await evaluate(`document.querySelector('#lab-environment-summary').click()`);assert.match(await evaluate(`document.querySelector('#lab-environment-detail').textContent`),/Main\.obn.*INTEGER 32.*REAL 64.*SDL.*Oberon-2/);await screenshot('planned-oberon-limits-390.png');results.push({name:'Oberon concrete revision, module and text library scope visible',passed:true});
 }
 for(const [id] of samples){
  await evaluate(`document.querySelector('#timeline-view').click();const input=document.querySelector('#map-search');input.value=${JSON.stringify(id)};input.dispatchEvent(new Event('input',{bubbles:true}))`);
  await wait(`!!document.querySelector('[data-map-result="'+${JSON.stringify(id)}+'"]')`);
  await evaluate(`document.querySelector('[data-map-result="'+${JSON.stringify(id)}+'"]').click()`);
  await wait(`!!document.querySelector('#docks .dock.selected')`);
  assert.equal(await evaluate(`document.querySelector('#docks .dock.selected').hasAttribute('data-runnable')`),true);
  assert.match(await evaluate(`document.querySelector('#detail-open-lab').textContent`),/运行|仿真/);
  results.push({name:id+' map and archive expose real remote entry',passed:true});
 }
 if(includes('algol-60')){
 await evaluate(`window.MUSEUM_LAB.open('algol-60');document.querySelector('#lab-environment-summary').click()`);
 assert.match(await evaluate(`document.querySelector('#lab-environment-detail').textContent`),/传名调用.*警告/);
 await screenshot('planned-algol60-limits-390.png');
 results.push({name:'ALGOL 60 translation limitations are visible in environment details',passed:true});
 }
};
