(() => {
  const $=id=>document.getElementById(id),lab=window.MUSEUM_LAB;
  if(!lab)return;
  const lessons=window.MUSEUM_LESSONS,execution=window.MUSEUM_EXECUTION;
  const names=new Map(window.MUSEUM_DATA.records.map(r=>[r.id,r.name]));
  const extensions={bcpl:'b',oberon:'obn',postscript:'ps',vhdl:'vhd',verilog:'v','x86-assembly':'asm',wasm:'wat','algol-60':'alg','common-lisp':'lisp',prolog:'pl',forth:'fs',racket:'rkt',smalltalk:'st',cobol:'cob',ada:'adb',clojure:'clj',ocaml:'ml',haskell:'hs',kotlin:'kt',groovy:'groovy',erlang:'erl',elixir:'exs',tcl:'tcl','standard-ml':'sml',scala:'scala','visual-basic.net':'vb','f-sharp':'fs',d:'d',nim:'nim',zig:'zig',swift:'swift',dart:'dart',julia:'jl',octave:'m',powershell:'ps1',javascript:'js',typescript:'ts',sql:'sql',awk:'awk',sed:'sed',php:'php',perl:'pl',xslt:'xsl',python:'py',lua:'lua',scheme:'scm',ruby:'rb',c:'c',cpp:'cpp',java:'java',csharp:'cs',fortran:'f90',pascal:'pas',r:'R',go:'go',rust:'rs',bash:'bash','korn-shell':'ksh',tcsh:'tcsh'};
  let importing=false;
  function environment(){
    const id=lab.current,mode=execution?.handles(id)?execution.mode(id):'local';
    const local=mode==='local';
    const descriptions={
      'korn-shell':'Korn shell / ksh93u+m 1.0.4 · 远端 · 256 MiB / 3 秒 · main.ksh，-p 忽略 ENV 启动配置；保留原生退出状态，无在线依赖，不冒充 ksh88',
      postscript:'PostScript / Ghostscript 10.00.0 · 远端 · 256 MiB / 3 秒 · main.ps，SAFER、NODISPLAY 与批处理；原生栈/过程和文本输出，无页面渲染、打印设备或文件产物下载',
      wasm:'WebAssembly / Wasmtime 50.0.1 · 远端 · 512 MiB / 3 秒含 WAT 翻译与 JIT，线性内存至多 256 MiB · main.wat 核心模块 / _start / WASI Preview 1 文本输入输出；禁用组件模型/线程，无目录、环境变量、网络或浏览器宿主',
      tcsh:'tcsh 6.24.07 · 远端 · 256 MiB / 3 秒 · main.tcsh，-f 禁用启动配置，保留原生 shell 退出状态，无在线依赖，不冒充早期 csh',
      powershell:'PowerShell 7.5.4 / Linux · 远端 · 768 MiB / 3 秒 · main.ps1、预装核心模块，默认 ErrorActionPreference=Stop；可显式捕获/调整错误策略；无在线 Gallery 或 Windows/Office 宿主',
      octave:'GNU Octave 7.3.0 · 远端 · 512 MiB / 3 秒 · main.m 脚本与预装核心库，文本输出；禁用 GUI/窗口系统、启动脚本和历史，无在线 pkg 或绘图界面，错误前输出保留',
      julia:'Julia 1.11.7 · 远端 · 768 MiB / 3 秒含启动和正常 JIT · main.jl、预装标准库；已有模块缓存可用，不生成新预编译缓存，按顺序求值，错误前输出保留；无 Pkg 在线安装、绘图或 Notebook',
      'standard-ml':'Standard ML / PolyML 5.7.1 · 远端 · 512 MiB / 3 秒含脚本编译执行 · 单文件与 Standard Basis 库；按声明编译求值，后续报错不撤销先前输出，无在线安装包，不冒充 SML/NJ 或 MLton',
      tcl:'Tcl 8.6.13 · 远端 · 256 MiB / 3 秒 · 单文件与基础库、TclOO，无 Tk GUI 或在线安装包；非 Tcl 9',
      elixir:'Elixir 1.14.0 / OTP 25.2.3 · 远端 · 512 MiB · 3 秒含 BEAM 启动与脚本编译执行 · 单调度器，无 Mix/Hex 在线依赖或分布式节点',
      groovy:'Groovy 4.0.26 / Java 17 · 远端 · 768 MiB / JVM 堆 256 MiB · 8 秒含启动与脚本编译执行 · 固定核心 JAR、禁用 Grape，无依赖在线还原',
      clojure:'Clojure 1.11.1 / Java 17 · 远端 · JVM 堆 256 MiB · 3 秒包含 JVM 启动 · 仅固定基础 JAR，无 tools.deps/Leiningen/Maven 在线还原',
      smalltalk:'GNU Smalltalk 3.2.5 · 远端 · 字节码 VM，禁用 JIT · CLI 适配使报告的语法错误和未处理异常返回失败 · 无图形环境或在线包安装',
      racket:'Minimal Racket 8.7 CS · 远端 · 单文件 #lang racket/base 与预装基础库 · 无 DrRacket/图形界面或在线包安装',
      forth:'Gforth 0.7.3 · 远端 · 栈语言，单文件执行后退出 · 16 MiB 字典 · 无交互式 REPL 或在线包安装',
      prolog:'SWI-Prolog 9.0.4 · 远端 · 定义 main/0 作为入口 · 128 MiB 栈限制 · 无图形界面或在线扩展包',
      'common-lisp':'Common Lisp · SBCL 2.2.9 · 远端 · 单文件与预装标准环境 · 无 Quicklisp / 第三方包，不冒充早期 LISP',
      javascript:'浏览器原生 JavaScript · 无需下载 · 2秒执行预算 · 不上传代码',
      python:local?'浏览器 Python · Pyodide · 约13.53 MB未压缩 · 加载90秒 / 执行3秒 · 不上传代码':'服务器 Python · 限额试用 · 点击运行才上传 · 3秒执行预算',
      lua:'浏览器 Lua 5.4 · Wasmoon · 约413 KiB未压缩 · 加载30秒 / 执行2秒 · 不上传代码',
      scheme:'浏览器 Scheme · BiwaScheme 0.8.3 · 约244 KiB · 非Wasm / 非完整R7RS · 加载30秒 / 执行2秒',
      r:'Rscript · 远端 · --vanilla · 预装基础包和文本输出 · 用 file("stdin") 读取标准输入，不在线安装 CRAN 包',
      ruby:'服务器 Ruby · 限额试用 · 点击运行才上传 · 3秒执行预算 · 无本地环境',
      sql:'SQLite SQL · 每次使用独立内存数据库 · 不使用独立标准输入 · 禁用文件和系统命令 · 非完整 SQL 标准',
      bash:'GNU Bash · 远端 · 可读取标准输入 · 禁网、临时容器内执行',
      awk:'GNU awk · 远端 · 编辑区填写 AWK 程序，标准输入填写待处理文本',
      sed:'GNU sed · 远端 · 编辑区填写 sed 脚本，标准输入填写待处理文本',
      php:'PHP 8.3 · 远端 · 可读取标准输入 · 禁网、临时容器内执行 · 禁用系统命令与网络函数',
      perl:'Perl 5.42 · 远端 · 可读取标准输入 · 禁网、临时容器内执行 · 不提供 CPAN 在线安装',
      xslt:'XSLT 1.0 · libxslt / xsltproc · 编辑区为样式表，标准输入为 XML 文档 · 禁网'
    };
    const short={javascript:'浏览器 JavaScript · 无需下载',python:local?'浏览器 Python · 约13.53 MB':'服务器 Python · 限额试用',lua:'浏览器 Lua · 约413 KiB',scheme:'浏览器 Scheme · 约244 KiB',ruby:'服务器 Ruby · 限额试用'};
    const compiled={bcpl:['BCPL Cintcode64 · 2026-11-09 快照',10],oberon:['OBNC 0.17.2 · Oberon 2016',10],vhdl:['GHDL 2.0.0 mcode · VHDL-2008 仿真',10],verilog:['Icarus Verilog 11.0 · Verilog-2005 仿真',10],'x86-assembly':['NASM 2.16.01 · x86-64 / Linux ELF64',10],dart:['Dart 3.9.4 · AOT',15],swift:['Swift 6.1.3 · Swift 6 模式',30],zig:['Zig 0.14.1 · Debug / LLVM',30],nim:['Nim 1.6.10 · GCC',20],d:['GNU D 12.2.0 · Phobos',10],'f-sharp':['F# 10.0 · .NET SDK 10.0.403',30],'visual-basic.net':['VB.NET · .NET SDK 10.0.403',30],scala:['Scala 2.13.16 · Java 17',30],erlang:['Erlang/OTP 25.2.3 · BEAM',10],kotlin:['Kotlin 2.1.20 · Java 17 / JVM',30],haskell:['GHC 9.0.2 · Haskell 2010',20],ocaml:['OCaml 4.13.1 · ocamlc 字节码',10],ada:['GNAT 12.2.0 · Ada 2012',10],cobol:['GnuCOBOL 3.1.2 · free / COBOL 2014',10],'algol-60':['MARST 2.8 · ALGOL 60 → C89',10],c:['C11',10],cpp:['C++17',10],rust:['Rust 2021',15],go:['Go',30],java:['Java 17',15],fortran:['Fortran 2008',10],csharp:['C# / .NET 10',30],pascal:['Free Pascal · ObjFPC',10]};
    compiled.typescript=['TypeScript（严格类型检查）',15];
    for(const [key,name] of Object.entries({postscript:'Ghostscript 10.00.0 · 文本解释',wasm:'Wasmtime 50.0.1 · WAT / WASIp1',tcsh:'tcsh 6.24.07','korn-shell':'ksh93u+m 1.0.4',powershell:'PowerShell 7.5.4 · Linux',octave:'GNU Octave 7.3.0 · 文本 CLI',julia:'Julia 1.11.7 · JIT',sql:'SQLite SQL',bash:'Bash',awk:'GNU awk',sed:'GNU sed',php:'PHP 8.3',perl:'Perl 5.42',xslt:'XSLT 1.0 / xsltproc',r:'Rscript','common-lisp':'SBCL 2.2.9',prolog:'SWI-Prolog 9.0.4',forth:'Gforth 0.7.3',racket:'Racket 8.7 CS',smalltalk:'GNU Smalltalk 3.2.5',clojure:'Clojure 1.11.1 / Java 17',groovy:'Groovy 4.0.26 / Java 17',elixir:'Elixir 1.14.0 / OTP 25',tcl:'Tcl 8.6.13','standard-ml':'PolyML 5.7.1 / Standard ML'}))short[key]='服务器 '+name+' · 限额试用';
    if(compiled[id]){short[id]='服务器 '+compiled[id][0]+' · 限额试用';descriptions[id]='远端编译执行 · 点击运行才上传 · 编译'+compiled[id][1]+'秒 / 运行3秒 · 禁网，不安装外部依赖'+(id==='java'?' · 入口类名 Museum':'')}
    if(id==='bcpl')descriptions[id]+=' · main.b / start()，512 MiB；现代 64 位字 Cintcode VM、固定标准头文件，原生错误和退出码；仅私人/学术用途，无图形、音频或历史机器重现';
    if(id==='oberon')descriptions[id]+=' · Main.obn / MODULE Main，512 MiB；OBNC → C/GCC，INTEGER 32 位、REAL 64 位，保留默认运行时检查；固定文本库，无 SDL Input/XYplane、在线模块或 Oberon-2/Ceres 系统';
    if(id==='x86-assembly')descriptions[id]+=' · main.asm / _start / Linux syscall ABI，256 MiB；NASM → GNU ld → 原生 ELF64，无 libc 或外部目标文件，不冒充 8086/DOS/Windows';
    if(['verilog','vhdl'].includes(id))descriptions[id]=descriptions[id].replace('编译执行','编译仿真').replace('运行3秒','仿真3秒实际时间');
    if(id==='verilog')descriptions[id]+=' · main.v / 顶层 module main，512 MiB；Icarus 编译/vvp 文本仿真，3 秒为实际时间；$stop 返回失败，无综合、FPGA 部署或波形下载，不是真实电路';
    if(id==='vhdl')descriptions[id]+=' · main.vhd / 顶层 entity main，512 MiB；GHDL 分析/展开后文本仿真，--assert-level=error 保留约束/断言错误，无综合、FPGA 部署或波形下载，不是真实电路';
    if(id==='dart')descriptions[id]+=' · main.dart 单文件、固定标准库与 AOT 原生可执行文件，768 MiB；无 pub 在线依赖或 Flutter';
    if(id==='swift')descriptions[id]+=' · main.swift 单文件、固定标准库与 Foundation，1024 MiB；无 Swift Package Manager 在线依赖或 Apple UI 框架';
    if(id==='zig')descriptions[id]+=' · main.zig 与固定标准库、Debug 检查和完整 LLVM 后端，无在线包下载；仅 Zig 0.14.1 API';
    if(id==='nim')descriptions[id]+=' · main.nim 单文件与固定标准库、GCC，缓存仅在临时目录，无 Nimble 在线安装；非 Nim 2';
    if(id==='d')descriptions[id]+=' · main.d 单文件与固定 Phobos，无 dub 在线安装，不冒充 DMD 版本或完整符合性';
    if(id==='f-sharp')descriptions[id]+=' · Main.fs 单文件与预装标准库、FSharp.Core，不在线还原 NuGet 包';
    if(id==='visual-basic.net')descriptions[id]+=' · Main.vb 单文件控制台，默认 Option Strict On，无桌面 My 服务或 NuGet 在线还原';
    if(id==='scala')descriptions[id]+=' · Main.scala / object Main / main(args: Array[String])，固定标准库，无 sbt/Maven/Coursier 在线还原；非 Scala 3';
    if(id==='erlang')descriptions[id]+=' · main.erl / 模块 main / 入口 main/0，单调度器与预装基础库；无 rebar3 在线安装或分布式节点';
    if(id==='kotlin')descriptions[id]+=' · Main.kt 单文件编译为 JVM JAR；无 Gradle/Maven 在线还原或脚本插件';
    if(id==='haskell')descriptions[id]+=' · 单文件 Main.hs，预装标准库；不在线还原 Cabal/Stack 依赖';
    if(id==='ocaml')descriptions[id]+=' · 单文件 main.ml 与标准库；不安装 opam/dune 包';
    if(id==='ada')descriptions[id]+=' · 单文件 main.adb，入口 procedure Main；预装运行库，不在线安装 Alire 包';
    if(id==='cobol')descriptions[id]+=' · GNU 编译器，不冒充 IBM 主机；无外部数据库或在线 COPYBOOK 安装';
    if(id==='algol-60')descriptions[id]+=' · 现代翻译器；传名调用可能生成求值顺序警告，不能保证完整语义；诊断原样保留';
    $('lab-environment-summary').textContent=short[id]||'仅编辑 · 未接入在线运行';
    $('lab-environment-detail').textContent=descriptions[id]||'仅编辑示例或草稿 · 尚未接入在线运行环境';
    $('lab-local-suggestion').hidden=id!=='python'||local;
    const next=$('lab-next-action');
    if(lab.entry(id).kind==='editor')next.textContent='此语言目前仅供阅读和编辑，可以下载代码到自己的环境运行。';
    else if(!local){
      next.textContent=!execution?.canRun(id)?'远端服务尚未就绪。可展开服务状态或重试连接，编辑内容会保留。':'点击“运行代码”后才上传代码；最多5个活跃会话，繁忙时请稍后重试。';
    }else next.textContent=id==='javascript'?'浏览器运行，无需下载。编辑后自动更新结果，也可点击“运行代码”。':execution?.allowed(id)?'本地环境已启用。编辑后自动更新结果，也可点击“运行代码”。':'先点击“下载并启用本地环境”，再运行；代码留在浏览器。';
  }
  function render(){
    const id=lab.current,entry=lessons.languages[id];
    if(!importing)$('lab-file-feedback').hidden=true;
    $('lab-topic').innerHTML='<option value="default">馆内示例 / 自由草稿</option>'+(entry?lessons.topics.map(t=>`<option value="${t.id}">${t.name}</option>`).join(''):'');
    $('lab-topic').value=lab.topic;
    const topic=lessons.topics.find(t=>t.id===lab.topic);
    $('lab-topic-note').textContent=topic?`${topic.task} · ${entry.version}`:'切换主题会保留各自草稿；导入和恢复示例不会自动执行。';
    $('lab-undo').hidden=!lab.hasBackup;
    $('lab-draft-status').textContent=(lab.modified?'已修改 · ':'')+(window.MUSEUM_DRAFT_STORE?.persistent?'草稿已在本机保存':'草稿仅当前页面保存（浏览器存储不可用）');
    environment();
  }
  function activity(){
    const stage=$('lab-runtime-state').dataset.stage;
    $('lab-stop').hidden=!['downloading','initializing','submitting','queued','compiling','running'].includes(stage);
    const result=$('lab-result'),error=$('lab-error-kind');
    error.hidden=result.dataset.state!=='error';
    if(!error.hidden){
      const text=result.textContent;
      error.textContent=/编译超过/.test(text)?'编译超时':/编译失败/.test(text)?'编译错误':/超过.*秒|超时|timed.out/i.test(text)?'执行超时':/SyntaxError|syntax error|语法错误|unexpected token|unexpected end|expected near|unexpected symbol|found EOS|unterminated/i.test(text)?'语法错误':/访问比较多|配额|队列已满/.test(text)?'访问限制':/加载|运行环境|连接|响应无效|Worker|资源/.test(text)?'环境不可用':'运行异常';
    }
  }
  document.addEventListener('click',event=>{for(const id of ['lab-file-tools','lab-environment'])if(!$(id).contains(event.target))$(id).open=false});
  $('lab-topic').onchange=()=>lab.chooseTopic($('lab-topic').value);
  $('lab-local-suggestion').onclick=()=>execution.chooseLocal();
  $('lab-stop').onclick=()=>lab.manualStop();
  $('lab-undo').onclick=()=>lab.undo();
  $('lab-import').onclick=()=>{if(!importing)$('lab-import-file').click()};
  $('lab-import-file').onchange=async()=>{
    const file=$('lab-import-file').files[0];if(!file)return;
    const id=lab.current,topic=lab.topic;
    importing=true;
    try{
      if(file.size>131072)throw new Error('代码文件最多128 KiB。');
      const bytes=await file.arrayBuffer();
      let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw new Error('请选择有效的 UTF-8 文本代码文件。')}
      if(text.includes('\0'))throw new Error('请选择 UTF-8 文本代码文件。');
      if(id!==lab.current||topic!==lab.topic)throw new Error('语言或主题已切换，请重新导入。');
      lab.importCode(text);$('lab-file-tools').open=false;$('lab-file-feedback').textContent='已导入；替换前草稿可恢复，点击运行后执行。';$('lab-file-feedback').hidden=false;
    }catch(error){$('lab-file-feedback').textContent=error.message||'导入失败，请使用 UTF-8 文本。';$('lab-file-feedback').hidden=false;}
    finally{importing=false;$('lab-import-file').value=''}
  };
  $('lab-download').onclick=()=>{
    const blob=new Blob([lab.code],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=({bcpl:'main.b',oberon:'Main.obn',java:'Museum.java',csharp:'Program.cs',ada:'main.adb',ocaml:'main.ml',haskell:'Main.hs',kotlin:'Main.kt',erlang:'main.erl',scala:'Main.scala','visual-basic.net':'Main.vb','f-sharp':'Main.fs',d:'main.d',nim:'main.nim',zig:'main.zig',swift:'main.swift',dart:'main.dart',julia:'main.jl',octave:'main.m',powershell:'main.ps1','korn-shell':'main.ksh',tcsh:'main.tcsh',wasm:'main.wat','x86-assembly':'main.asm',verilog:'main.v',vhdl:'main.vhd',postscript:'main.ps'}[lab.current])||'museum-'+lab.current+'-'+lab.topic+'.'+(extensions[lab.current]||'txt');
    a.click();$('lab-file-tools').open=false;setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  document.addEventListener('museum-lab-change',render);
  document.addEventListener('museum-execution-change',environment);
  window.addEventListener('museum-draft-saved',()=>{$('lab-draft-status').textContent=(lab.modified?'已修改 · ':'')+(window.MUSEUM_DRAFT_STORE.persistent?'草稿已在本机保存':'草稿仅当前页面保存（浏览器存储不可用）')});
  new MutationObserver(activity).observe($('lab-runtime-state'),{attributes:true,attributeFilter:['data-stage']});
  new MutationObserver(activity).observe($('lab-result'),{attributes:true,childList:true,characterData:true,subtree:true});
  render();activity();
})();
