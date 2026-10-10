# 馆藏语言证据审查

核查日期：2026-10-10。

全量初筛覆盖 **5,155** 条馆藏，其中来源标为语言的 **4,608** 条。逐项外部文档核查覆盖 **93** 条；其余条目的证据线索已逐条列出，仍未完成人工核实。

已核到语法资料和实现依据的语言/方言 **60** 条；本机独立示例通过 **17** 条。主图按明确的语法/执行线索收录 **233** 个节点。二者是不同维度。

## 查看结果

- [全量清单 catalogue.csv](catalogue.csv)：每条记录的来源分类、证据线索、审查结果、运行状态及下一步。
- [覆盖与关系完整性审计](INTEGRITY.md)：独立目录对照、别名冲突、关系来源与缺口队列。
- [人工审查记录与原文摘录](../../data/audit/reviews.json)：来源地址、取回时间、内容摘要哈希、短摘录、访问失败记录及判断范围。
- 构建后可从网站 `/data/audit-reviews.json` 下载同一审查输入；`/data/provenance.json` 的 `meta.reviewEvidence` 提供文件路径、SHA-256 和覆盖数量。下载记录不等于完整原网页归档，也不代表全馆已核。
- [本机执行记录](../../data/audit/runtime-checks.json)：原创样例、命令、版本、实际标准输出与错误。
- [ALGOL 60 独立执行记录](../../data/audit/algol60-runtime-checks.json)：临时构建的 MARST，三条原创样例及无效语法拒绝。
- [主图收录节点](../../data/audit/map-eligible-ids.json)。
- [地图人工分类决定](../../data/audit/map-curation.json)：明显的工具/产品排除及可执行的记法类例外。
- [汇总数据](summary.json)。

## 判断口径

1. **语言身份**：编程语言、DSL、查询语言、硬件描述语言可保留；标记/样式/数据语法单列；库、编译器、协议和编码单列为相关技术。
2. **语法依据**：已阅读的官方手册、语言规范或实现项目文档；快照中的示例和语法高亮仓库仅作为线索。
3. **实现依据**：有对应编译器、解释器、数据库执行器、仿真器或其他处理器文档；下载页面和手册不等于已经本机运行。
4. **执行依据**：仅将本次成功运行的原创小程序标为通过，记录具体方言与版本。这不是完整标准符合性测试，也不代表馆内实验台已接入该运行时。
5. **历史语言**：有一手资料可以确认其历史存在，即使没有核到现代可运行环境。没有证据不能直接判为不存在。

证据强弱不按使用人数、排名、年份或热门程度决定。自动字段分组不构成逐项确认；缺少这些字段也不等于语言没有语法或实现。

审计与构建使用同一审查记录校验：已阅读的来源必须带 URL、读取时间、成功响应状态、标题、摘录和 SHA-256；“已核语言”必须同时具备语法和实现来源，或明确标为二者合一的来源。地图筛选结果固定审查记录与分类决定的哈希，输入变化后必须重跑审计。校验只检查记录的完整性与一致性，不能代替阅读原文，也不能单凭哈希证明史料真实。

## 汇总

|审查结果|条数|
|---|---:|
|有论文书目：语法与实现待核|1|
|历史语言：一手文献支持|11|
|尚未逐条人工核实|5072|
|已核形式语言/数据语法|5|
|已核语法与实现文档|60|
|已核相关技术：不是独立程序语言|6|

来源标为语言但主分类属于工具、协议、编码或标准等的候选共 **260** 条。这是分类复核队列，不能仅凭主标签批量否定语言身份（例如某些工具也附带 DSL）。

来源语言中，缺少官网、规范、代码仓库、简介和代码示例字段的有 **1784** 条；其中可能仍有 HOPL、论文或百科线索。

## 已核语法与实现的清单

“文档已核”表示存在可追溯的语法和实现资料；“示例通过”仅针对本机记录的版本。BASIC、Scheme 等家族条目以备注中的具体方言为准。

|条目|实现/方言|本机执行|语法与实现来源|范围说明|
|---|---|---|---|---|
|Ada|GNAT|未测试|[语法](https://docs.adacore.com/live/wave/arm05/html/arm05/arm22-2-1.html) · [实现](https://docs.adacore.com/gnat_ugn-docs/html/gnat_ugn/gnat_ugn.html)|Ada 语言，非 Ada Lovelace 人物。|
|ALGOL 60|GNU MARST 2.8（ALGOL 60 到 C 的翻译器）|示例通过|[历史语言报告](https://www.masswerk.at/algol60/report.htm) · [语法](https://www.masswerk.at/algol60/modified_report.htm) · [实现](https://ftp.gnu.org/gnu/marst/marst-2.8.tar.gz)|核实 ALGOL 60 的语言报告及 GNU MARST 实现说明。1963 Revised Report 与 1976 Modified Report 的 HTML 为 N. Landsteiner 的转录镜像；MARST README 明确采用 1976 修改报告的 Level 0 硬件表示，不能把各版语法视为完全相同。2026-10-04 在临时目录由已核发行包构建 MARST 2.8，原创求和、递归、按名调用样例经翻译至 C 并由本机 Clang 编译执行，实际输出55、720、6；无效语法被拒绝。生成的按名调用 C 程序有未排序修改警告，结果仅证明这些样例在本机本次配置中的输出，不证明完整标准符合性或跨平台语义。详细执行记录见仓库 data/audit/algol60-runtime-checks.json，尚无页面运行时。与馆藏 Algol 家族条目、ALGOL 68 分开；地图上的既有设计关系仍须逐条历史复核。|
|awk|awk / GNU awk|示例通过|[语法](https://www.gnu.org/software/gawk/manual/html_node/Patterns-and-Actions.html) · [实现](https://www.gnu.org/software/gawk/manual/html_node/Running-gawk.html)|文本处理语言；GNU awk 与 POSIX awk 有区别。 手册为 GNU awk；实测为 macOS 系统 awk，仅验证共有基础语法。|
|Bash|GNU Bash|示例通过|[语法与实现](https://www.gnu.org/software/bash/manual/bash.html) · [设计关系：固定版本手册](https://mirrors.kernel.org/gnu/bash/bash-5.3.tar.gz)|Bash 5.3 固定发行包手册明确列出 Bourne、Korn、C shell 的设计输入；后两者包括 typeset 以及历史展开、目录栈等。手册仅称 largely compatible，且 POSIX 行为可能不同于传统 sh，因此不标为严格超集或所有旧程序兼容。Bourne 端点使用已核 V7 身份的 sh；馆藏另有 bourne-shell 待去重，未画两者继承。已有本机 Bash 样例不表示5.3发行包被执行，网页未接入 Bash。|
|BASIC|FreeBASIC|未测试|[语法](https://www.freebasic.net/wiki/wikka.php?wakka=DocToc) · [实现](https://www.freebasic.net/) · [设计者采访](https://time.com/69316/basic/) · [历史语法与宿主](https://bitsavers.org/pdf/dartmouth/dtss/196410_BASIC.pdf)|BASIC 家族的现代 FreeBASIC 方言；不声称重现初版 Dartmouth BASIC。 另视觉核读1964年10月1日 Dartmouth BASIC 手册的语法示例与 DTSS 宿主说明；未运行该历史实现。TIME 2014年采访引 Kurtz 对 FORTRAN/ALGOL 简化尝试的回顾，关系限于初学者语言设计的参照与回应，不能称为已成功的子集或指定 ALGOL 60/FORTRAN II。|
|C|GCC / Clang|示例通过|[语法](https://www.gnu.org/software/c-intro-and-ref/manual/html_node/index.html) · [实现](https://clang.llvm.org/docs/UsersManual.html) · [关系依据](https://www.bell-labs.com/usr/dmr/www/chist.html)|现代 C；具体标准版本依编译器选项。|
|C#|.NET SDK / Roslyn|未测试|[语法](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/) · [实现](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-run) · [关系复核：依据不足](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/introduction) · [关系依据](https://www.artima.com/articles/the-trouble-with-checked-exceptions)||
|C++|GCC / Clang|示例通过|[语法](https://eel.is/c++draft/lex) · [实现](https://clang.llvm.org/docs/UsersManual.html) · [关系依据](https://www.stroustrup.com/bs_faq.html)|C++ 工作草案和编译器文档；具体标准版本需选择。|
|Clojure|Clojure JVM|未测试|[语法](https://clojure.org/reference/reader) · [实现](https://clojure.org/guides/install_clojure)||
|COBOL|GnuCOBOL|未测试|[语法与实现](https://gnucobol.sourceforge.io/doc/gnucobol.html) · [历史原文](https://bitsavers.org/pdf/codasyl/COBOL_Report_Apr60.pdf)|GnuCOBOL 支持的方言，不等同于所有历史版本。 1960年初始规格报告明确列出FLOW-MATIC、IBM Commercial Translator和AIMACO的资料/思想输入；本次先核实FLOW-MATIC端点及历史语法实现，另外两个端点继续独立核对。1959年报告形成与1960年批准分开记录；历史资料输入不代表现代GnuCOBOL方言是FLOW-MATIC超集或源码兼容。|
|Common Lisp|SBCL|未测试|[语法](https://www.lispworks.com/documentation/HyperSpec/Body/02_a.htm) · [实现](https://www.sbcl.org/manual/)|ANSI Common Lisp；不代替所有早期 Lisp 方言。|
|D|DMD|未测试|[语法](https://dlang.org/spec/lex.html) · [实现](https://dlang.org/dmd.html) · [关系依据](https://dlang.org/overview.html)||
|Dart|Dart SDK|未测试|[语法](https://dart.dev/language) · [实现](https://dart.dev/tools/dart-run) · [关系研究：编译目标](https://dart.dev/resources/faq) · [关系研究：未发现直接论证](https://raw.githubusercontent.com/dart-lang/language/main/specification/dartLangSpec.tex) · [关系依据](https://raw.githubusercontent.com/dart-lang/language/675b500505b9ffeb80fbb507f1911e393e400cd9/specification/dartLangSpec.tex)|Dart 可编译为 JavaScript/WebAssembly；固定官方语言规范还明确记录了浏览器/JavaScript 兼容性和向上兼容既有 JavaScript 程序的设计取舍。此处只表示局部设计影响，不把编译目标当作语言继承。|
|Elixir|Elixir / Erlang VM|未测试|[语法](https://hexdocs.pm/elixir/syntax-reference.html) · [实现](https://elixir-lang.org/install/)||
|Erlang|Erlang/OTP|未测试|[语法](https://www.erlang.org/doc/system/expressions.html) · [实现](https://www.erlang.org/doc/system/seq_prog.html) · [作者历史回顾](https://www.erlang.org/download/armstrong_thesis_2003.pdf)|Armstrong 2003年论文第3–5页追溯 Prolog 并发扩展实验、1987年嵌入式原型、JAM/WAM 技术输入，以及1990年独立语法与1991年替代旧实现。关系限于历史演进，不表示当前 Erlang 是 Prolog 超集、保留回溯或源码兼容；本轮未重现历史实现，尚无网页运行时。|
|F#|F# / .NET|未测试|[语法](https://learn.microsoft.com/en-us/dotnet/fsharp/language-reference/) · [实现](https://learn.microsoft.com/en-us/dotnet/fsharp/tools/fsharp-interactive/) · [关系依据](https://fsharp.org/history/hopl-final/hopl-fsharp.pdf)||
|Forth|Gforth|未测试|[语法与实现](https://gforth.org/manual/Your-first-definition.html) · [作者历史回顾](https://raw.githubusercontent.com/colorforth/colorforth.github.io/master/HOPL.html)|以 Gforth 的交互语法及实现作为证据。 作者1991年回顾（1999年HTML前言，作者仓库镜像）支持 APL 运算符参照、Algol 标签格式与 Fortran 循环词名输入；不是已发表 HOPL II 论文。关系限于所述机制，不把作者用过的语言都算作上游，也不据回忆章节给 APL 采纳时间。|
|Fortran|GNU Fortran|未测试|[语法](https://gcc.gnu.org/onlinedocs/gfortran/Fortran-Dialect-Options.html) · [实现](https://gcc.gnu.org/onlinedocs/gfortran/)|现代 Fortran 方言；不代表 1957 年初版已复现。|
|GNU Octave|GNU Octave|未测试|[语法](https://docs.octave.org/latest/Statements.html) · [实现](https://docs.octave.org/latest/Running-Octave.html) · [关系依据](https://octave.org/about.html)|GNU Octave；与 MATLAB 存在兼容范围和差异。|
|Go|Go toolchain|示例通过|[语法](https://go.dev/ref/spec) · [实现](https://go.dev/doc/install) · [关系依据](https://go.dev/doc/faq)| 本机为 Go 1.24.0；在线规范版本更新不代表该版本支持全部新增特性。|
|Groovy|Groovy / JVM|未测试|[语法](https://groovy-lang.org/syntax.html) · [实现](https://groovy-lang.org/install.html) · [关系依据](https://groovy-lang.org/differences.html)||
|Haskell|GHC|未测试|[语法](https://www.haskell.org/onlinereport/haskell2010/haskellch2.html) · [实现](https://downloads.haskell.org/ghc/latest/docs/users_guide/ghci.html)|Haskell 2010 与 GHC 扩展有区别。|
|Java|JDK / javac|示例通过|[语法](https://docs.oracle.com/javase/specs/jls/se25/html/jls-2.html) · [实现](https://docs.oracle.com/en/java/javase/25/docs/specs/man/javac.html) · [关系依据](https://docs.oracle.com/javase/specs/jls/se25/html/jls-1.html)| 规范文档为 Java SE 25；本机小程序使用 JDK 21，未测试新版特性。|
|JavaScript|Node.js|示例通过|[语法](https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html) · [实现](https://nodejs.org/api/synopsis.html) · [关系依据](https://brendaneich.com/2008/04/popularity/)|ECMAScript 与 Node.js；浏览器 API 不等同于语言本身。 ECMAScript 在线规范为滚动草案；Node.js 实测只涉及基础循环。|
|Julia|Julia|未测试|[语法](https://docs.julialang.org/en/v1/manual/variables/) · [实现](https://docs.julialang.org/en/v1/manual/getting-started/) · [关系依据](https://julialang.org/blog/2012/02/why-we-created-julia/)||
|Kotlin|Kotlin compiler|未测试|[语法](https://kotlinlang.org/docs/basic-syntax.html) · [实现](https://kotlinlang.org/docs/command-line.html) · [设计关系](https://kotlinlang.org/docs/faq.html)|JVM、JS 与 Native 后端需分别选择。 官方 FAQ 明确列出 Java、C#、JavaScript、Scala、Groovy 的设计启发；这是设计影响，不表示源码继承或超集。|
|Lua|Lua 5.4|执行受阻|[语法](https://www.lua.org/manual/5.4/manual.html) · [实现](https://www.lua.org/manual/5.4/manual.html#7) · [设计关系](https://www.lua.org/doc/hopl.pdf)| 官方语法与解释器文档已读；本机 lua 因 Bad CPU type in executable 未能运行。 作者《The Evolution of Lua》已核具体设计来源；Modula 与 Modula-2 不自动等同。|
|MATLAB|MathWorks MATLAB|未测试|[语法](https://www.mathworks.com/help/matlab/language-fundamentals.html) · [实现](https://www.mathworks.com/products/matlab.html)|MathWorks 官方 R2026b 语言基础文档覆盖变量、数组、运算符与语句；产品页确认 MATLAB 含编程语言及可安装运行环境。先前 403 访问受阻已在本次复核中解除；尚未本机运行专有 MATLAB。Octave 不代替 MATLAB 验证。|
|Nim|Nim compiler|未测试|[语法](https://nim-lang.org/docs/manual.html) · [实现](https://nim-lang.org/docs/nimc.html)||
|OCaml|OCaml|未测试|[语法](https://ocaml.org/manual/5.3/lex.html) · [实现](https://ocaml.org/manual/5.3/comp.html)||
|Pascal|Free Pascal|未测试|[语法](https://www.freepascal.org/docs-html/ref/ref.html) · [实现](https://www.freepascal.org/docs-html/user/user.html) · [设计关系](https://people.inf.ethz.ch/wirth/Articles/GoodIdeas.pdf)|Free Pascal 的语言模式；历史 Pascal 版本需另核。 2026-10-04 核对 Wirth 作者回顾：Pascal 的引用参数是对 ALGOL 传名参数及其开销的设计回应；这不表示源码兼容或严格超集。|
|Perl|Perl 5|示例通过|[语法](https://perldoc.perl.org/perlsyn) · [实现](https://perldoc.perl.org/5.40.0/perlrun)|Perl 5；Raku 应另列。|
|PHP|PHP interpreter|未测试|[语法](https://www.php.net/manual/en/language.basic-syntax.php) · [实现](https://www.php.net/manual/en/features.commandline.php) · [关系依据](https://www.php.net/manual/en/history.php.php)||
|PL/SQL|Oracle Database PL/SQL|未测试|[语法与实现](https://docs.oracle.com/cd/B28359_01/appdev.111/b28370/overview.htm) · [关系依据](https://docs.oracle.com/en/database/oracle/oracle-database/23/lnpls/overview.html)|依据 Oracle 11g 官方手册；需要 Oracle 数据库环境，不代表现代版本已实测。|
|PowerShell|PowerShell|未测试|[语法](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_language_keywords) · [实现](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell) · [关系研究：语法对照](https://learn.microsoft.com/en-us/powershell/scripting/lang-spec/chapter-01) · [作者设计宣言](https://www.jsnover.com/Docs/MonadManifesto.pdf) · [扩展接口](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/add-type)|作者 Monad 宣言明确借鉴 Bourne Shell 的语法和控制结构；在校订 sh 身份后录入设计影响，范围为2002年长期设计愿景，不是 PowerShell V1.0 完整实现或源码兼容证明。C# 语法对照及迁移目标未单独录入继承；Add-Type 的 C# 编译与调用保留为独立生态扩展接口。本轮未执行该接口，也未接入网页运行。|
|Prolog|SWI-Prolog|未测试|[语法](https://www.swi-prolog.org/man/syntax.html) · [实现](https://www.swi-prolog.org/pldoc/man?section=quickstart)|具体实现为 SWI-Prolog；其他 Prolog 方言可能不兼容。|
|Python|CPython|示例通过|[语法](https://docs.python.org/3/reference/) · [实现](https://docs.python.org/3/using/cmdline.html) · [关系依据](https://docs.python.org/3/faq/general.html) · [关系依据](https://docs.python.org/3/extending/extending.html) · [关系依据](https://www.jython.org/) · [关系依据](https://pyo3.rs/)||
|R|R|未测试|[语法](https://cran.r-project.org/doc/manuals/r-release/R-lang.html) · [实现](https://cran.r-project.org/doc/manuals/r-release/R-intro.html)||
|Racket|Racket|未测试|[语法](https://docs.racket-lang.org/guide/syntax-overview.html) · [实现](https://docs.racket-lang.org/guide/intro.html)||
|Ruby|CRuby|示例通过|[语法](https://docs.ruby-lang.org/en/master/syntax_rdoc.html) · [实现](https://www.ruby-lang.org/en/documentation/installation/) · [关系依据](https://www.ruby-lang.org/en/about/)||
|Rust|rustc / Cargo|示例通过|[语法](https://doc.rust-lang.org/reference/) · [实现](https://doc.rust-lang.org/book/ch01-01-installation.html) · [设计关系](https://doc.rust-lang.org/reference/influences.html) · [关系依据](https://doc.rust-lang.org/nomicon/ffi.html)||
|Scala|Scala compiler / JVM|未测试|[语法](https://docs.scala-lang.org/scala3/reference/syntax.html) · [实现](https://docs.scala-lang.org/getting-started/install-scala.html) · [设计者论文](https://www.scala-lang.org/docu/files/ScalaOverview.pdf)|Scala 3。|
|Scheme|GNU Guile|未测试|[语法](https://www.gnu.org/software/guile/manual/html_node/Scheme-Syntax.html) · [实现](https://www.gnu.org/software/guile/manual/html_node/Invoking-Guile.html) · [关系依据](https://www.scheme.org/)|Scheme 家族，具体实现为 Guile；不等同于每个 Scheme 方言。|
|sed|sed / GNU sed|示例通过|[语法与实现](https://www.gnu.org/software/sed/manual/sed.html)|文本变换脚本语言及流编辑器。 手册为 GNU sed；实测为 macOS 系统 sed，仅验证共有替换命令。|
|Smalltalk|GNU Smalltalk|未测试|[语法与实现](https://www.gnu.org/software/smalltalk/manual/gst.html) · [关系依据](https://worrydream.com/EarlyHistoryOfSmalltalk/)|Smalltalk 家族，证据针对 GNU Smalltalk。|
|SQL|SQLite / PostgreSQL|示例通过|[语法](https://www.sqlite.org/lang.html) · [实现](https://www.sqlite.org/cli.html)|查询语言；核实的是 SQLite SQL 方言，非所有 SQL 标准特性。|
|Standard ML|Standard ML of New Jersey|未测试|[语法与实现](https://www.smlnj.org/doc/interact.html)|具体实现为 SML/NJ。|
|Swift|Swift compiler|未测试|[语法](https://raw.githubusercontent.com/swiftlang/swift-book/main/TSPL.docc/ReferenceManual/LexicalStructure.md) · [实现](https://www.swift.org/install/) · [关系依据](https://raw.githubusercontent.com/swiftlang/swift-org-website/ccf11a958db44ae501a84329455e89fa46fc5d61/about/index.md)||
|Tcl|Tcl / tclsh|未测试|[语法](https://www.tcl-lang.org/man/tcl8.6/TclCmd/Tcl.htm) · [实现](https://www.tcl-lang.org/man/tcl8.6/UserCmd/tclsh.htm)||
|tcsh|tcsh 6.21.00; official source releases|示例通过|[语法](https://raw.githubusercontent.com/tcsh-org/tcsh/TCSH6_21_00/tcsh.man) · [实现](https://www.tcsh.org/)|固定6.21.00官方手册明确命令语言、脚本处理和控制语法，项目官网提供实现源码入口；手册称为 Berkeley C shell 的兼容增强版，并以4.4BSD csh说明扩展标记。本机 /bin/tcsh 与 /bin/csh 指向同一实现，版本6.21.00；另以 tcsh -f 执行两份原创程序，算术循环输出55，列表/条件输出Lisp；错误引号语法被拒绝。执行证据只覆盖本机版本与样例，不证明原始C shell或完整历史兼容性。未接入网页运行。|
|TypeScript|tsc|未测试|[语法](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) · [实现](https://www.typescriptlang.org/docs/handbook/typescript-tooling-in-5-minutes.html) · [关系依据](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html)|转译为 JavaScript，再由 JS 运行时执行。|
|VBA|Microsoft Office VBA / Visual Basic Editor|未测试|[语法](https://learn.microsoft.com/en-us/office/vba/language/reference/user-interface-help/visual-basic-language-reference) · [语法](https://learn.microsoft.com/en-us/office/vba/language/reference/user-interface-help/fornext-statement) · [实现](https://learn.microsoft.com/en-us/office/vba/library-reference/concepts/getting-started-with-vba-in-office) · [关系依据](https://learn.microsoft.com/en-us/office/vba/language/concepts/getting-started/64-bit-visual-basic-for-applications-overview)|已核微软 VBA 语言参考、For...Next 规则与 Office 内编辑/运行步骤。VBA 依赖宿主应用，不等同于 Visual Basic .NET；未在本机执行或接入网页运行时。|
|VBScript|Microsoft VBScript engine / Windows Script Host (cscript.exe)|未测试|[语法](https://learn.microsoft.com/en-us/previous-versions//d1wf56tt(v=vs.85)) · [语法](https://learn.microsoft.com/en-us/previous-versions/sa3hh43e(v=vs.85)) · [实现](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cscript) · [支持状态](https://learn.microsoft.com/en-us/windows-server/get-started/removed-deprecated-features-windows-server) · [关系依据](https://learn.microsoft.com/en-us/windows/win32/com/translating-to-vbscript)|已核微软存档语言参考、For...Next 语法和 Windows cscript 宿主文档。微软列为弃用功能，Windows Server 2025 中以预装按需功能提供，后续计划移除；现代浏览器不支持。存在历史实现不等于推荐新项目使用，未在本机执行或接入网页运行时。|
|Verilog|Icarus Verilog|未测试|[语法与实现](https://steveicarus.github.io/iverilog/usage/simulation.html)|硬件描述语言；软件仿真与实际硬件综合分开。|
|VHDL|GHDL|未测试|[语法与实现](https://ghdl.github.io/ghdl/quick_start/simulation/index.html) · [实现项目的设计说明](https://ghdl.github.io/ghdl/about.html)|硬件描述语言；核实仿真工具，不声称已生成硬件。 GHDL 项目说明明确 VHDL 的大部分语法和语义来自 Ada，同时区分事件驱动的硬件并发模型。这是实现项目说明，非原始设计者论文；1983年研发与1987年标准是不同事件。未运行 GHDL、合成电路或接入网页运行时。|
|Visual Basic .NET|Visual Basic .NET / .NET SDK|未测试|[语法](https://learn.microsoft.com/en-us/dotnet/visual-basic/language-reference/) · [实现](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-run) · [关系依据](https://learn.microsoft.com/en-us/lifecycle/announcements/visual-basic-6-support-announcement)|Visual Basic .NET，与早期 Visual Basic 分开。|
|WebAssembly|WebAssembly / Wasmtime|未测试|[语法](https://webassembly.github.io/spec/core/text/index.html) · [实现](https://docs.wasmtime.dev/cli.html)|包含文本格式与二进制指令；执行需宿主运行时。|
|x86 Assembly|NASM|未测试|[语法](https://www.nasm.us/doc/nasm03.html) · [实现](https://www.nasm.us/doc/nasm02.html)|仅核实 NASM 的 x86 汇编语法；不是所有汇编语言。|
|XSLT|libxslt / xsltproc (XSLT 1.0)|示例通过|[语法](https://www.w3.org/TR/1999/REC-xslt-19991116) · [实现](https://raw.githubusercontent.com/GNOME/libxslt/v1.1.35/doc/intro.html)|W3C XSLT 1.0 原始标准定义模板、变量、参数、条件与结果树的执行语义，是可执行转换语言，不只是 XML 记法。libxslt 有真实处理器；本机 xsltproc 使用 libxslt 1.1.35。标准明确嵌入 XPath 表达式，不以规范引用或同属 XML 推定设计继承。1998馆藏年代与1999年正式 Recommendation 为不同事件，暂保留原值。未接入网页运行，后续版本需分别核实。 本轮已用本机 xsltproc --nonet 执行两份原创 XSLT 1.0：求和实际输出55，排序与条件实际输出8,9,10,，非法 XPath 表达式退出失败；证据与复现脚本保存在项目，属于样例核验而非完整符合性。|
|Zig|Zig compiler|未测试|[语法](https://ziglang.org/documentation/master/) · [实现](https://ziglang.org/learn/getting-started/) · [实现与生态关系](https://ziglang.org/learn/overview/)|Zig 文档为开发分支，具体版本要固定。 2026-10-04 补核官方 Overview：@cImport 导入 C 类型、函数等，export 导出 C ABI；录入 C/Zig 互操作，不据此推断 Zig 继承 C。|

## 历史、形式语言、相关技术与受阻条目

|条目|结论|说明与来源|
|---|---|---|
|11ty|已核相关技术：不是独立程序语言|静态站点生成器，使用多种模板语言；工具不是独立语言。 [技术分类](https://www.11ty.dev/)|
|B|历史语言：一手文献支持|Bell Labs CSTR #8（1973）原文介绍 B 的教程、参考手册、MH-TSS 与 Unix 编译实现；当前未运行历史 B 程序。 [历史原文](https://www.bell-labs.com/usr/dmr/www/bintro.html)|
|BCPL|历史语言：一手文献支持|Martin Richards 的 BCPL 项目资料；现代复现环境另核。 [历史原文](https://www.cl.cam.ac.uk/~mr10/BCPL.html)|
|Bourne shell (sh)|历史语言：一手文献支持|Unix V7 原始手册有完整命令编程语法，源码署名 S. R. Bourne。1978年作者论文的首页印刷页码为1971，明确发表于1978年7–8月，不能把页码当发表年；但也不能由此断言馆藏日期错误的成因。sh 展示校订为 Bourne shell (sh)，1979 表示 Unix V7 发布，而非设计开始；原1971保留可查。馆藏另有 bourne-shell（原值1977、同作者）且 HOPL 两个编号皆为 Bourne/Unix shell 语境，身份及年代范围仍待核，保留且不画彼此继承。不能把现代 /bin/sh、Bash 或 POSIX shell 等同于这个历史实现。本轮未编译历史源码，未接入网页运行。 [历史原文](https://www.tuhs.org/cgi-bin/utree.pl?file=V7/usr/man/man1/sh.1) · [历史实现](https://www.tuhs.org/cgi-bin/utree.pl?file=V7/usr/src/cmd/sh/main.c) · [年代与身份](https://www.in-ulm.de/~mascheck/bourne/) · [历史原文](https://www.tuhs.org/Archive/Documentation/Papers/BSTJ/bstj57-6-1971.pdf) · [目录身份复核](https://hopl.info/showlanguage.prx?exp=568) · [目录身份复核](https://hopl.info/showlanguage.prx?exp=3931)|
|C shell|历史语言：一手文献支持|TUHS 保存的2BSD原始手册定义词法、表达式、管道及控制语法，作者文档署名 William Joy，源码署名 Bill Joy 并标注 October 1978。1979手册日期与1978源码时间分开保留；原始实现未编译执行。本机 /bin/csh 实为 tcsh 6.21，不能将其当作1978年 C shell 的执行证明。未接入网页运行。 作者原始介绍明确以C算术运算及优先级、while/switch和标签形式说明语法参照，同时指出字符串比较及breaksw等差异；据此只录入局部设计影响，不标为C的后继或超集。 [语法](https://www.tuhs.org/cgi-bin/utree.pl?file=2BSD/man/csh.u) · [历史原文](https://www.tuhs.org/cgi-bin/utree.pl?file=2BSD/doc/csh) · [实现](https://www.tuhs.org/cgi-bin/utree.pl?file=2BSD/src/csh/sh.c)|
|CSS|已核形式语言/数据语法|样式语言，有形式语法和处理模型。 [规范](https://www.w3.org/TR/css-syntax-3/)|
|FLOW-MATIC|历史语言：一手文献支持|1958原始手册给出编号语句、词名及标点规则、18条操作的完整库存程序，以及Translation/Selection/Allocation/Processing到机器码磁带的编译过程和启动说明。手册版本年份不替换馆藏1955；未复现原始编译器、二进制或UNIVAC运行环境，未接入网页执行。COBOL初始规格明确承认FLOW-MATIC资料与思想输入，关系只标设计影响。 [历史原文](https://bitsavers.org/pdf/univac/flow-matic/U1518_FLOW-MATIC_Programming_System_1958.pdf)|
|GCC|已核相关技术：不是独立程序语言|编译器集合，支持多种语言；GCC 本身不是语言。 [技术分类](https://gcc.gnu.org/)|
|HTML|已核形式语言/数据语法|标记语言，与编程密切相关；不当作通用程序语言。 [规范](https://html.spec.whatwg.org/multipage/syntax.html)|
|HTTP|已核相关技术：不是独立程序语言|应用层协议，不是编程语言。 [技术分类](https://www.rfc-editor.org/rfc/rfc9110.html)|
|JSON|已核形式语言/数据语法|数据交换语法；不是独立编程语言。 [规范](https://www.rfc-editor.org/rfc/rfc8259.html) · [关系依据](https://www.json.org/json-en.html)|
|Korn shell|历史语言：一手文献支持|作者1994年论文明确叙述在 Bourne shell 上增补并形成 ksh，借鉴 C shell 的历史记录、别名和作业控制，算术及 for 语法借鉴 C；有函数、数组和完整程序，以及实际发行描述。兼容叙述限定历史版本，不能扩成全版本超集；C实现与 ALGOL-like 源码风格不是新增继承依据。本机另以 Version AJM 93u+ 2012-08-01 执行原创算术循环、数组/函数，实际输出55与12，非法语法被拒绝。这不等于执行1988/1993原始二进制或完整符合性，未接入网页运行。 [历史原文](https://www.usenix.org/legacy/publications/library/proceedings/vhll/full_papers/korn.ksh.a)|
|Lisp|历史语言：一手文献支持|McCarthy 1960 年原文描述 S 表达式、函数、解释器及 IBM 704 上已开发的 LISP 系统。此证据针对早期 LISP，不把现代 Lisp 方言视为同一实现。 本批关系核读只确认 Church λ 记法用于函数表示；作者回顾明确未采用其更一般的函数定义机制，不据此声称实现完整 λ 演算。 [历史原文](https://www-formal.stanford.edu/jmc/recursive.pdf) · [关系依据](https://www-formal.stanford.edu/jmc/recursive/node2.html) · [关系依据](https://www-formal.stanford.edu/jmc/history/lisp/node2.html)|
|METAPI|有论文书目：语法与实现待核|Crossref 与 Semantic Scholar 书目一致：Gerald D. Chandler，METAPI - a language for extensions，1971，DOI 10.1145/800006.807972。仅书目支持；未取得全文语法或可运行实现。快照记录 1967，论文出版年 1971，年代口径待核。 [书目](https://hopl.info/showlanguage.prx?exp=5090) · [书目](https://api.semanticscholar.org/graph/v1/paper/a617a6ef72375bfcc912fdbdb645fc66db3c6abc?fields=title,authors,year,abstract,url) · [出版书目交叉核实](https://api.crossref.org/works/10.1145/800006.807972)|
|Modula-2|历史语言：一手文献支持|作者给出模块语法与代码示例、Mesa/Pascal/Modula 的具体设计输入，并叙述 Lilith 等历史编译器；本轮未重现执行。快照1978年与作者所述1979年定义报告是不同事件，保留来源年代并明确口径待补，不自动改年。 [历史原文](https://people.inf.ethz.ch/wirth/Articles/Modula-Oberon-June.pdf)|
|Oberon|历史语言：一手文献支持|作者叙述从 Modula-2 简化设计、语法与类型机制、1986年语言定义及 Ceres 编译器；不是本机重现声明。语言 Oberon 与同名操作系统分开理解，语言定义与系统1989年发布不可混用。ALGOL 60 的家族祖先叙述不自动升级现有直接关系。 [历史原文](https://people.inf.ethz.ch/wirth/Articles/Modula-Oberon-June.pdf)|
|PostScript|历史语言：一手文献支持|Adobe 原始参考手册明确它有可执行对象、后缀语法、栈和解释器，不只是静态排版记法；设计分别参考 Forth 后缀语法与 Lisp 的程序作为数据及执行状态控制。馆藏1982年为设计时代线索，手册所称1985年引入是另一事件；本轮未执行解释器，尚无网页运行时。 [历史原文](https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf)|
|ReactJS|已核相关技术：不是独立程序语言|用于用户界面的 JavaScript 库；不是独立编程语言。 [技术分类](https://react.dev/)|
|Simula|历史语言：一手文献支持|设计者 Ole-Johan Dahl 回顾 Simula I 与 Simula 67 均已定义并实现，并给出 Simula I 语法示例；不是本机重现声明。 2026-10-04 复读论文第2–3页：Simula I 明确以 ALGOL 60 的块结构为基础，并新增模拟机制；编译器兼容叙述仅对应该历史实现，不能泛化为所有 Simula 版本。 [历史原文](https://www.mn.uio.no/ifi/english/about/ole-johan-dahl/bibliography/the-birth-of-object-orientation-the-simula-languages.pdf)|
|TCP|已核相关技术：不是独立程序语言|传输协议，不是编程语言。 [技术分类](https://www.rfc-editor.org/rfc/rfc9293.html)|
|UTF-8|已核相关技术：不是独立程序语言|字符编码，不是编程语言。 [技术分类](https://www.rfc-editor.org/rfc/rfc3629.html)|
|XML|已核形式语言/数据语法|标记/数据表示语言。 [规范](https://www.w3.org/TR/xml/)|
|YAML|已核形式语言/数据语法|数据序列化语言。 [规范](https://yaml.org/spec/1.2.2/)|

## 界限与下一步

- 主图仅显示有语法/示例及执行环境线索、或已人工核实的条目；明显属于工具、协议、编码、标记/数据格式的项目不作为语言节点。可执行的领域语言例外与工具/产品排除记录在 map-curation.json。证据不足的项目留在全馆目录供检索，并标为待核。原始快照完整保留。
- METAPI 的论文书目支持其与语言研究相关；全文语法与实现仍待查证。快照年代与论文出版年不能混作同一日期。
- 本机 Lua 可执行文件因 CPU 架构不兼容而失败，不能据此否定 Lua 的实现；其他环境未安装的语言未伪造执行结果。
- 审查语法和实现文档不保证任意版本互相兼容；现代实现不能证明同名历史初版已重现。官方站点访问失败也不等于对应语言不真实。
- 后续按全量 CSV 的下一步逐项补证。只有人工审查记录可升级为已核，补充源码仓库或示例不会自动升级。

## 离线重生成

```sh
python3 scripts/audit-catalogue.py
```

输入为固定原始快照、人工审查记录及本机执行记录，不联网；需要 Node.js 与 Python 3，以调用与构建相同的审查记录校验器。需要重新运行本机样例时，单独执行 `python3 scripts/verify-language-samples.py`，只使用现有解释器和编译器，不安装或下载软件。

CSV 标签对照：`verified-language`＝已核语法与实现；`historical-primary-source`＝历史一手资料；`bibliographic-only`＝书目支持；`verified-formal-language`＝形式语法；`verified-related-technology`＝相关技术；`review-blocked`＝访问受阻；`unreviewed`＝尚未逐条人工核实。
