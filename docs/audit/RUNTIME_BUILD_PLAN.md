# 地图语言运行环境盘点与分批构建清单

盘点日期：2026-11-02。范围：当前源码对应的 233 个时间长河语言节点，含 50 个常显标签与 183 个微光点；关系谱系是其中的子集。本文同时记录研究排期与实施进度。P1 十二门已接入源码：首批 TypeScript、SQL（SQLite）、Bash、AWK、sed；第二批 PHP、Perl、XSLT、C#、Fortran；2026-11-03 补齐 Pascal、R。十二门均已于 2026-11-03 升级生产执行服务，并完成正式 HTTPS 核验；核验范围见下文。

## 结论与判定口径

“有运行环境”包括解释器、编译器及其产物执行链、转换处理器、求解器和仿真器；这些操作在产品中应分别叫运行、转换、求解、验证或仿真，不统一伪装成控制台程序。

| 分组 | 总数 | 常显标签 | 微光点 | 含义 |
| --- | ---: | ---: | ---: | --- |
| A | 22 | 18 | 4 | 已接入（P1 十二门为临时环境核验） |
| B | 37 | 20 | 17 | 实现资料已核，待接入 |
| C | 126 | 2 | 124 | 已有构建配方，待复现 |
| D | 24 | 0 | 24 | 实现候选明确，构建待核 |
| E | 20 | 10 | 10 | 先明确方言、宿主或历史版本 |
| F | 4 | 0 | 4 | 当前资料不足以构建目标环境 |

A+B+C 共 185 个已有馆内接入、经人工核实的实现资料或具体安装/运行配方。**这不表示 185 个环境都已构建成功**：其中 C 组 126 个本轮只做配置源码核读，仍需固定软件、许可、依赖和实测。D 组 24 个已能指出实现候选，但构建资料核验深度不齐；其中 Janet、MoonScript、ReScript 等本轮已补读官方入口，仍未完成馆内固定构建。E 组 20 个并非没有运行时，而是必须先选对方言、历史版本或宿主。F 组 4 个是本轮尚未找到足以构建对应目标环境的资料，不代表世界上不存在实现。

233 个节点的入图线索不能直接当作 233 个已验证执行环境。地图内外的历史关系证据与运行环境证据分别处理。

50 个常显标签中，18 个已接入、22 个有已核实现或构建配方、10 个需先选方言/宿主；没有标签落入本轮“资料不足”组。183 个点中，4 个已接入、141 个有已核实现或构建配方、24 个有实现候选、10 个需先明确条件、4 个资料不足。

## 已接入基线

2026-11-03 review 修正（本地）：XSLT 的 XML 标准输入现按语言在当前页面内存中保留，切换语言往返及主动清空均不再被默认 XML 覆盖；Perl 默认示例已加入 `use utf8;`，本机中文源码输出回归通过。此修正不增加语言数量、不代表生产升级；原 52 项容器和 27 项远端浏览器报告仍是上轮核验快照；本次补齐 Pascal/R 时，Perl 中文源码用例已纳入最新 72 项固定镜像回归通过。详见 [项目上下文](../PROJECT_CONTEXT.md)。

- 浏览器：JavaScript、Python、Lua、Scheme，共 4 个。
- 私有远端源码现支持 Python、Ruby、C、C++、Rust、Go、Java、TypeScript、SQL（SQLite）、Bash、AWK、sed、PHP、Perl、XSLT、C#、Fortran、Pascal、R，共 19 个；Python 两种模式重叠，合计 22 个语言节点。P1 新增语言的生产服务已升级；运行仍需私有令牌。
- 依据当前源码 `scripts/execution-capabilities.cjs`、`server/runtime-images.json` 与 [执行说明](../EXECUTOR.md)。本轮未探测生产服务、令牌或远端实时健康；“已接入”指代码与既有核验基线。
- 原 10 个环境保留；P1 新增十二门复用私有执行协议。最新 72 项真实容器回归见 [p1-runtime-checks.json](../../data/audit/p1-runtime-checks.json)，前两批快照保留在 [cli-runtime-checks.json](../../data/audit/cli-runtime-checks.json)。新增工具链和复测命令见 [执行说明](../EXECUTOR.md)。最新 [P1 浏览器记录](../../data/audit/p1-runtime-browser-checks.json) 36 项覆盖十二门的真实执行、1440/390 和编译/运行诊断；当前默认测试 83/83、离线构建通过。

生产补记：[正式 HTTPS 浏览器记录](../../data/audit/p1-production-browser-checks.json) 36 项、[服务检查](../../data/audit/p1-production-service-checks.json) 13 项与[一致性检查](../../data/audit/p1-production-consistency.json)通过；[部署记录](../../data/audit/p1-executor-deployment.json)绑定实现提交、安装哈希与回退备份。P1 为 12/12 已接入并上线，不代表其他 211 个节点已具备执行环境；微信扫码授权仍未接入。

## 推荐构建顺序

优先考虑可复现与投入，再考虑教学价值、常显标签覆盖和范式覆盖。每轮只做 2–3 门，通过验收后再推进。优先级是本项目的实施建议，不是语言排名，也不是对所有未来部署成本的定量测量。

### P1：先完成最有把握的一批

进度：顺序 1–12 已完成源码接入及独立临时网页核验，2026-11-03 补齐 Pascal、R，72 项真实容器回归、36 项真实浏览器专项和 83 项默认测试通过；生产执行服务已升级，网页核验记录见已接入基线。

| 顺序 | 语言 | 推荐首版路径 | 原因 / 首版边界 |
| ---: | --- | --- | --- |
| 1 | TypeScript | 固定 TypeScript 编译器 → 现有 JS Worker | 复用现有执行器；先只支持单文件与标准语言功能，分别显示类型诊断及执行结果。 |
| 2 | SQL | 固定 SQLite → 临时内存数据库 | 教学价值高、无需数据库守护进程；首版可走私有远端，浏览器 Wasm 另评估体积与许可。 |
| 3 | Bash | GNU Bash → 私有远端 | 现成 CLI；只允许容器内程序，不暴露宿主文件和命令。 |
| 4 | AWK | GNU awk → 私有远端 | 小型文本样例成本低；明确 gawk 方言。 |
| 5 | sed | GNU sed → 私有远端 | 复用标准输入和文本输出；明确 GNU/POSIX 范围。 |
| 6 | PHP | PHP CLI → 私有远端 | 成熟解释器；先不开放 Web 服务、网络及外部扩展。 |
| 7 | Perl | Perl 5 → 私有远端 | 成熟解释器；与 Raku 分开，不开放 CPAN 在线安装。 |
| 8 | XSLT | xsltproc/libxslt → 私有远端 | 已有本机真执行证据；需增加 XML 输入约定，禁网且处理外部实体/文档访问。 |
| 9 | C# | .NET SDK / Roslyn → 私有远端 | 共享后续 F#/VB.NET 基础；预置参考程序集并禁止任务期间 NuGet restore。 |
| 10 | Fortran | GNU Fortran → 私有远端 | 补齐科学计算及历史展品；标明现代方言和标准选项。 |
| 11 | Pascal | Free Pascal → 私有远端 | 清晰编译链、适合历史比较；固定模式与标准库。 |
| 12 | R | Rscript → 私有远端 | 补统计语言常显标签；先只用基础包和文本输出，绘图之后再做。 |

首批按用户指令完成 **TypeScript → SQLite → Bash → AWK → sed**，第二批完成 **PHP → Perl → XSLT → C# → Fortran**，第三批补齐 **Pascal → R**。TypeScript 首版选用受控服务端 tsc，避免向浏览器增加整套编译器下载；严格类型检查失败不执行。SQLite 首版使用安全模式和独立内存库。PHP 使用最小 CLI 配置并限制文件与网络访问；Perl 不安装 CPAN 包；XSLT 固定 1.0 并禁用网络和写出；C# 直接调用 Roslyn 与预装参考程序集，不还原 NuGet；Fortran 固定 Fortran 2008 标准选项；Pascal 固定 Free Pascal 3.2.2 / ObjFPC 模式与基础 RTL，R 固定 Rscript 4.2.2 / --vanilla / 基础包与文本输出。生产升级单独审核，不把临时核验视为上线。

### P2：历史与范式展品，按编号推进

顺序：ALGOL 60 → Common Lisp → Prolog → Forth → Racket → Smalltalk → BASIC → SNOBOL → APL → COBOL → Ada → Clojure → OCaml → Haskell → Kotlin → Groovy → Erlang → Elixir → Tcl → Standard ML。

- ALGOL 60 已有 GNU MARST 本机样例，可先复核生成 C 的警告与语义，再接网页。
- Common Lisp、Prolog、Forth、Racket、Smalltalk 补充不同计算范式；先做控制台基础语言，不做图形 IDE。
- BASIC、SNOBOL 标为 P2*：先确认 FreeBASIC/BWBasic、SNOBOL4 等具体方言，页面不得声称重现初版。
- APL 明确 GNU APL 或其他实现，并确认 Unicode 编辑与输入。
- Clojure/Kotlin/Groovy 可复用 JVM 基础镜像的构建经验，但各自必须有固定工具链、独立验收和预算；已有 Java 镜像不会自动获得这些能力。
- OCaml/Haskell/Erlang/Elixir/Standard ML 先做单文件、标准库样例；并发或运行库启动超过原配额时，以实测调整单语言预算。

### P3：其余常用语言、专用计算与历史实现

顺序：Scala → Visual Basic .NET → F# → D → Nim → Zig → Swift → Dart → Julia → GNU Octave → PowerShell → Korn shell → tcsh → WebAssembly → x86 Assembly → Verilog → VHDL → PostScript → BCPL → Oberon。

此批成本或界面差异更明显：.NET 分支复用 C# 的准备成果；Julia/Octave 关注镜像和启动体积；Wasm 需明确 WAT 与 WASI；汇编需固定 ISA/ABI；Verilog/VHDL 为仿真；PostScript 首版只输出受控文本或产物，不默认打开设备；BCPL/Oberon 固定现代实现并与历史原版分开说明。

### P4：长尾及候选，先做可复现原型

下方全量表标为 P4 的条目都在后备清单中。组内暂不强排 1–N，先按一个工具链家族选 2–3 门：

1. 现有语言之上的转译器：CoffeeScript、Fennel、MoonScript、Hy、Coconut 等；先核对应目标运行时版本。
2. 独立命令行语言：Janet、Crystal、Dylan、Factor、J、PicoLisp、Raku、Squirrel 等。
3. 文本转换与模板：Less、Sass/SCSS、Pug、Dhall、jq；输出类型与预览约定先落实。
4. 求解/验证/工作流：SMT、MiniZinc、Boogie、Dafny、Promela、CWL、Nextflow；分别制定验收，不把 solver 结果当 stdout 运行示例。
5. 实验与老工具链：Carbon、Jakt、Parrot、Ceylon、Boo、Q# 等；先重核固定发行与依赖，旧配方不直接照搬。
6. 趣味语言：Brainfuck、Befunge、Whitespace、><>、Chef、Zot 等；可做小专题，但不要用热门趣味项目替换全馆覆盖。Velato 另需 MIDI 输入，Entropy 另需随机输出判定。

D 组中 Fennel/MoonScript/ReScript 可因复用现有后端而提前做小原型；SMT/MLIR/Solidity/CWL/Nextflow 需要额外语义或宿主设计，保留专题。

## 条件专题：有实现，但不能直接排普通容器任务

| 节点 | 目标环境 / 候选 | 推进前必须明确 |
| --- | --- | --- |
| Algol (`algol`) | 须选 ALGOL 60 / ALGOL 68；现有 Riju 配方是 a68g（ALGOL 68） | 不能把家族 1958 年条目当作已复现 ALGOL 68；ALGOL 60 另有独立节点。 |
| Applescript (`applescript`) | macOS / osascript | 实现明确；需要专门 macOS 执行主机，不进入当前 Linux 容器首批。 |
| Assembly language (`assembly-language`) | 先选 ISA、汇编器语法、位宽与 ABI；优先复用独立 x86 节点 | 家族总称没有唯一运行时，不能直接分配一个 Assembly 容器。 |
| B (`b`) | Bell Labs 历史 B 编译器；后续查原始工具链或明确命名的复现实现 | 历史手册证实实现存在，尚无本项目固定的现代复现链。 |
| BASIC (`basic`) | FreeBASIC（已有人工核实）；Riju 使用 bwbasic | 可以先做明确标注方言的 BASIC 实验；不代表 1964 年 Dartmouth BASIC。 |
| Batchfile (`batch`) | Windows cmd.exe；Riju 使用 Wine cmd | 先选原生 Windows 或 Wine 兼容子集；不保证 Windows API 与命令兼容。 |
| C shell (`c-shell`) | 2BSD C shell 历史源码；现代演示可另选明确标注的兼容实现 | 本机 /bin/csh 是 tcsh，不作为原始 csh 执行证明。 |
| Lisp (`lisp`) | 原始 LISP / IBM 704 历史实现；现代教学先用独立 Common Lisp 或 Scheme 节点 | 现代 SBCL 不代替 1958/1960 年历史 LISP 实现。 |
| Linden Scripting Language (`lsl`) | Second Life 宿主；OpenSimulator LSL 子集候选 | 依赖事件、对象和世界 API；单个 lsl 命令名不足以证明独立执行。 |
| MATLAB (`matlab`) | MathWorks MATLAB | 实现明确但需许可和对应宿主；GNU Octave 是独立节点，不能冒充 MATLAB。 |
| Modula-2 (`modula-2`) | 历史 Lilith 编译器已有资料；现代 GNU Modula-2 为待核构建候选 | 需确认具体语言模式、标准库和版本，不能以现代编译代替 Lilith 重现。 |
| Nu (`nu`) | programming-nu/nu / nush，依赖 Objective-C runtime 与 Foundation | 有源码与构建说明；需验证老依赖在目标平台可编译，不与 Nushell 混淆。 |
| PL/SQL (`pl-sql`) | Oracle Database PL/SQL | 需数据库发行版本、许可、隔离 schema 和会话清理；PostgreSQL PL/pgSQL 不能替代。 |
| sh (`sh`) | Unix V7 Bourne shell 源码及历史宿主；现代 POSIX shell 应另标 | Riju 的 posh 不能作为 V7 sh 的原样执行证据。 |
| Simula (`simula`) | Simula I / Simula 67 历史实现；先选版本并研究可复现发行 | 历史存在性有依据，但尚未核定本馆的源码、宿主和引导链。 |
| SNOBOL (`snobol`) | 先选 SNOBOL4 / CSNOBOL4；Riju 命令 snobol4 | 可搭现代 SNOBOL4 方言，但不能宣称运行 1962 年初始 SNOBOL。 |
| VBA (`vba`) | Microsoft Office VBA / Visual Basic Editor | 依赖 Office 宿主及文档对象模型，不等同于 VB.NET。 |
| VBScript (`vbscript`) | Windows Script Host / cscript.exe | 需确认所选 Windows 版本功能可用；不在浏览器直接运行。 |
| Visual Basic (`visual-basic`) | 经典 Visual Basic / VB6 历史开发与运行环境 | 快照 Riju 和 Compiler Explorer 线索对应 .NET 风格工具链，不能用来证明 VB6。 |
| Wolfram Language (`wolfram`) | Wolfram 官方引擎；Mathics 仅为兼容实现候选 | Riju 使用 Mathics；须标注兼容子集，官方环境另核许可与部署。 |

LSL 的 OpenSimulator 候选见 [官方脚本文档](https://opensimulator.dev/wiki/Scripting_Documentation)，仅支持其声明的 LSL 子集及扩展；Nu 候选见 [原项目源码](https://github.com/programming-nu/nu)。Classic VB 和 Windows/Office 系语言应单独评估宿主，不用 Mono/VB.NET 替换。

### 本轮发现的身份错配线索

这些发现先记入研究计划，本轮没有修改原始快照、入图资格或线上页面。后续修正应连同身份、示例和运行链接一起核验。

| 地图记录 | 链接实际对应 | 固定配方依据 | 处理方式 |
| --- | --- | --- | --- |
| Algol 家族 | ALGOL 68 Genie | [algol.yaml](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/algol.yaml) | 先选版本，勿覆盖独立 ALGOL 60 节点。 |
| Classic Visual Basic | Mono VB.NET / vbnc | [visualbasic.yaml](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/visualbasic.yaml) | VB.NET 环境归独立 .NET 节点，VB6 另核。 |
| inkle ink | thesephist/ink | [ink.yaml](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/ink.yaml) | 已定位 inkle 官方 inklecate 编译器/播放器，待固定构建。 |
| 图形语言 GRASS | 趣味语言 Grass | [grass.yaml](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/grass.yaml) | 不采用该配方证明原图形语言可执行。 |
| 1960 SLANG | S-Lang / slsh | [slang.yaml](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/slang.yaml) | 原 SLANG 继续查历史资料。 |
| Text Executive Programming Language | TeX | [tex.yaml](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/tex.yaml) | 分清身份，重新寻找对应实现。 |

## 当前资料不足：先研究，暂不承诺构建

| 节点 | 本轮发现 | 下一步 / 解锁条件 |
| --- | --- | --- |
| FLOW-MATIC (`flow-matic`) | 1958 原始手册已证明语法与 UNIVAC 编译系统；本馆未找到已核可复现的完整执行链。 | 寻找编译器源码或可再分发磁带/二进制、机器型号和模拟器、装载及输入格式；若自写解释器，明确为现代教学重实现并单独核对语义。 |
| GRASS (`grass`) | 快照主体描述 DeFanti 的图形动画语言，Riju 配方却下载只使用 w/W/v 语法的趣味语言 Grass。 | 查目标图形系统的手册、软件发行/模拟器和显示设备协议；不能用同名趣味语言或 GRASS GIS 替代。 |
| SLANG (`slang`, 1960) | 快照只有 Riju 线索；配方实际是 S-Lang / slsh，不能对应早期 SLANG。 | 先确认原始 SLANG 身份和手册，再找源程序/二进制及机器环境；现代 S-Lang 如要展示需独立身份，不直接改年替换。 |
| Text Executive Programming Language (`text-executive-programming-language`) | 快照链接 `/tex` 的 Riju 配方明确是 TeX；不能当作该语言的执行证据。 | 查目标语言原始手册、作者及实现；建立与 Donald Knuth TeX 的身份区分后，再判断能否复现。 |

这里的“资料不足”是截至本轮证据范围的结论，不是判定语言不可实现。FLOW-MATIC 的仓库依据见 [人工审查记录](../../data/audit/reviews.json)；SLANG、GRASS 和 Text Executive 三项错配来自固定快照与固定 Riju 配方直接对照。GRASS 的原始方向另见 [开发机构 EVL 的历史说明](https://www-new.evl.uic.edu/news/1973/1973-01-01-1935/)，它同样未提供本馆已核的完整可运行发行。SLANG 的早期背景另有 [参与者第一人称回顾](https://ethw.org/First-Hand%3AExperiences_and_Reflections_of_a_Computer_Pioneer)，它不提供本馆已核的完整可运行发行。

## 每门语言的完成条件

1. 确认节点身份、方言/版本、输入与输出类型；选定源码/发行包/镜像，保存来源、许可、哈希和平台。获取依赖是显式准备步骤；网站构建与用户任务执行都不能临时联网下载。
2. 先完成固定环境原型：至少两个有辨识度的原创正例、一个真正错误用例；用改动后的源码产生不同结果，不能只验证预编译展品。检查编译诊断与执行输出分离。
3. 纳入现有受控执行协议：资源预算、标准输入、输出限制、超时/取消、禁网与任务清理；需要文件、图形、音频、数据库或特殊宿主的语言先定义额外接口。浏览器 Worker 不当作对抗恶意程序的完整安全边界。
4. 完成编辑器、档案、地图入口、版本/限制和不可用降级；预览或连接失败不能显示伪造成功。实现后运行 npm test 和 npm run build，并实际浏览器检查。
5. 记录本机、网页与生产各自核验状态；更新本清单及项目上下文。构建通过不等于已发布，生产上线另行授权与验证。

每个条目使用“资料待核 → 原型可复现 → 已接入本机页面 → 已核验生产”状态推进；不因下载了镜像就标完成。

## 全量逐项表（233 个，含标签与点）

表中“标签”指常显标签，“点”指默认微光点，不影响能否执行。B 组依据项目既有人工审查，不代表本轮重跑实现；C 组依据固定 Riju 配方，不代表当前上游下载地址、软件包或旧依赖仍可用；D 组只定位候选。配方命令为识别执行链的摘要，**不是可以直接复制用于生产的安装脚本**。所有未接入项仍需上节验收。

### A · 已接入（22）

| 名称 / ID | 地图 | 优先级 | 环境或构建链 | 依据 / 待办 |
| --- | --- | --- | --- | --- |
| C (`c`) | 标签 | 维护 | 私有远端 GCC / C11 | [当前执行能力](../../scripts/execution-capabilities.cjs) |
| C++ (`cpp`) | 标签 | 维护 | 私有远端 G++ / C++17 | [当前执行能力](../../scripts/execution-capabilities.cjs) |
| Go (`go`) | 标签 | 维护 | 私有远端 Go toolchain | [当前执行能力](../../scripts/execution-capabilities.cjs) |
| Java (`java`) | 标签 | 维护 | 私有远端 javac / release 17 | [当前执行能力](../../scripts/execution-capabilities.cjs) |
| JavaScript (`javascript`) | 标签 | 维护 | 浏览器原生 Worker | [当前执行能力](../../scripts/execution-capabilities.cjs) |
| Lua (`lua`) | 标签 | 维护 | Wasmoon / Lua 5.4.5 | [当前执行能力](../../scripts/execution-capabilities.cjs) |
| Python (`python`) | 标签 | 维护 | Pyodide；私有远端 CPython | [当前执行能力](../../scripts/execution-capabilities.cjs) |
| Ruby (`ruby`) | 标签 | 维护 | 私有远端 CRuby | [当前执行能力](../../scripts/execution-capabilities.cjs) |
| Rust (`rust`) | 标签 | 维护 | 私有远端 rustc / edition 2021 | [当前执行能力](../../scripts/execution-capabilities.cjs) |
| Scheme (`scheme`) | 标签 | 维护 | BiwaScheme 0.8.3 子集 | [当前执行能力](../../scripts/execution-capabilities.cjs) |
| TypeScript (`typescript`) | 标签 | P1 已核验 | TypeScript 5.9.3 严格类型检查 → Node.js 22.23.2 | [真实容器记录](../../data/audit/cli-runtime-checks.json)；[接入边界](../EXECUTOR.md)；生产已核验 |
| SQL (`sql`) | 标签 | P1 已核验 | SQLite 3.53.4 安全模式 / 独立内存库 | [真实容器记录](../../data/audit/cli-runtime-checks.json)；[接入边界](../EXECUTOR.md)；生产已核验 |
| Bash (`bash`) | 点 | P1 已核验 | GNU Bash 5.3.9 | [真实容器记录](../../data/audit/cli-runtime-checks.json)；[接入边界](../EXECUTOR.md)；生产已核验 |
| awk (`awk`) | 点 | P1 已核验 | GNU awk 5.3.2 | [真实容器记录](../../data/audit/cli-runtime-checks.json)；[接入边界](../EXECUTOR.md)；生产已核验 |
| sed (`sed`) | 点 | P1 已核验 | GNU sed 4.9 | [真实容器记录](../../data/audit/cli-runtime-checks.json)；[接入边界](../EXECUTOR.md)；生产已核验 |
| PHP (`php`) | 标签 | P1 已核验 | PHP 8.3.36 CLI | [真实容器记录](../../data/audit/cli-runtime-checks.json)；最小配置，禁用系统命令与网络函数；生产已核验 |
| Perl (`perl`) | 标签 | P1 已核验 | Perl 5.42.2 | [真实容器记录](../../data/audit/cli-runtime-checks.json)；仅预装核心模块，不安装 CPAN；生产已核验 |
| XSLT (`xslt`) | 标签 | P1 已核验 | libxslt 1.1.43 / libxml2 2.13.9 | [真实容器记录](../../data/audit/cli-runtime-checks.json)；XSLT 1.0，禁网、禁写出；生产已核验 |
| C# (`csharp`) | 标签 | P1 已核验 | .NET SDK 10.0.403 / Roslyn | [真实容器记录](../../data/audit/cli-runtime-checks.json)；预装参考程序集，不还原 NuGet；生产已核验 |
| Fortran (`fortran`) | 标签 | P1 已核验 | GNU Fortran (GCC) 14.3.0 | [真实容器记录](../../data/audit/cli-runtime-checks.json)；Fortran 2008 标准选项；生产已核验 |
| Pascal (`pascal`) | 点 | P1 已核验 | Free Pascal 3.2.2 / ObjFPC / 基础 RTL | [真实容器记录](../../data/audit/p1-runtime-checks.json)；[接入边界](../EXECUTOR.md)；生产已核验 |
| R (`r`) | 标签 | P1 已核验 | Rscript / R 4.2.2 Patched / 基础包与文本输出 | [真实容器记录](../../data/audit/p1-runtime-checks.json)；[接入边界](../EXECUTOR.md)；生产已核验 |

### B · 实现资料已核，待接入（37）

| 名称 / ID | 地图 | 优先级 | 环境或构建链 | 依据 / 待办 |
| --- | --- | --- | --- | --- |
| Ada (`ada`) | 标签 | P2-11 | GNAT | [已核资料](https://docs.adacore.com/live/wave/arm05/html/arm05/arm22-2-1.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/ada.yaml) |
| ALGOL 60 (`algol-60`) | 标签 | P2-1 | GNU MARST 2.8（ALGOL 60 到 C 的翻译器） | [已核资料](https://www.masswerk.at/algol60/modified_report.htm)；已有 MARST→C→Clang 本机样例；传名调用生成 C 的警告仍需处理。 |
| BCPL (`bcpl`) | 标签 | P3-19 | BCPL | [已核资料](https://www.cl.cam.ac.uk/~mr10/BCPL.html)；作者发行资料明确；需固定 Cintcode/源码和引导程序。 |
| Clojure (`clojure`) | 点 | P2-12 | Clojure JVM | [已核资料](https://clojure.org/reference/reader)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/clojure.yaml) |
| COBOL (`cobol`) | 标签 | P2-10 | GnuCOBOL | [已核资料](https://gnucobol.sourceforge.io/doc/gnucobol.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/cobol.yaml) |
| Common Lisp (`common-lisp`) | 点 | P2-2 | SBCL | [已核资料](https://www.lispworks.com/documentation/HyperSpec/Body/02_a.htm)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/commonlisp.yaml) |
| D (`d`) | 标签 | P3-4 | DMD | [已核资料](https://dlang.org/spec/lex.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/d.yaml) |
| Dart (`dart`) | 标签 | P3-8 | Dart SDK | [已核资料](https://dart.dev/language)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/dart.yaml) |
| Elixir (`elixir`) | 点 | P2-18 | Elixir / Erlang VM | [已核资料](https://hexdocs.pm/elixir/syntax-reference.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/elixir.yaml) |
| Erlang (`erlang`) | 点 | P2-17 | Erlang/OTP | [已核资料](https://www.erlang.org/doc/system/expressions.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/erlang.yaml) |
| F# (`f-sharp`) | 点 | P3-3 | F# / .NET | [已核资料](https://learn.microsoft.com/en-us/dotnet/fsharp/language-reference/)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/fsharp.yaml) |
| Forth (`forth`) | 标签 | P2-4 | Gforth | [已核资料](https://gforth.org/manual/Your-first-definition.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/forth.yaml) |
| GNU Octave (`octave`) | 点 | P3-10 | GNU Octave | [已核资料](https://docs.octave.org/latest/Statements.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/octave.yaml) |
| Groovy (`groovy`) | 标签 | P2-16 | Groovy / JVM | [已核资料](https://groovy-lang.org/syntax.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/groovy.yaml) |
| Haskell (`haskell`) | 标签 | P2-14 | GHC | [已核资料](https://www.haskell.org/onlinereport/haskell2010/haskellch2.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/haskell.yaml) |
| Julia (`julia`) | 标签 | P3-9 | Julia | [已核资料](https://docs.julialang.org/en/v1/manual/variables/)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/julia.yaml) |
| Korn shell (`korn-shell`) | 点 | P3-12 | AT&T historical ksh88/ksh93; separately tested installed ksh93u+ | [已核资料](https://www.usenix.org/legacy/publications/library/proceedings/vhll/full_papers/korn.ksh.a)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/ksh.yaml) |
| Kotlin (`kotlin`) | 标签 | P2-15 | Kotlin compiler | [已核资料](https://kotlinlang.org/docs/basic-syntax.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/kotlin.yaml) |
| Nim (`nim`) | 点 | P3-5 | Nim compiler | [已核资料](https://nim-lang.org/docs/manual.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/nim.yaml) |
| Oberon (`oberon`) | 点 | P3-20 | Oberon / Ceres 历史编译器 | [已核资料](https://people.inf.ethz.ch/wirth/Articles/Modula-Oberon-June.pdf)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/oberon.yaml)；历史证据与现代 OBNC 方言分开；Riju 提供 obnc 构建链。 |
| OCaml (`ocaml`) | 标签 | P2-13 | OCaml | [已核资料](https://ocaml.org/manual/5.3/lex.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/ocaml.yaml) |
| PostScript (`postscript`) | 点 | P3-18 | Adobe PostScript 历史解释器 | [已核资料](https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/postscript.yaml) |
| PowerShell (`powershell`) | 标签 | P3-11 | PowerShell | [已核资料](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_language_keywords)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/powershell.yaml) |
| Prolog (`prolog`) | 标签 | P2-3 | SWI-Prolog | [已核资料](https://www.swi-prolog.org/man/syntax.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/prolog.yaml) |
| Racket (`racket`) | 点 | P2-5 | Racket | [已核资料](https://docs.racket-lang.org/guide/syntax-overview.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/racket.yaml) |
| Scala (`scala`) | 标签 | P3-1 | Scala compiler / JVM | [已核资料](https://docs.scala-lang.org/scala3/reference/syntax.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/scala.yaml) |
| Smalltalk (`smalltalk`) | 标签 | P2-6 | GNU Smalltalk | [已核资料](https://www.gnu.org/software/smalltalk/manual/gst.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/smalltalk.yaml) |
| Standard ML (`standard-ml`) | 点 | P2-20 | Standard ML of New Jersey | [已核资料](https://www.smlnj.org/doc/interact.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/standardml.yaml) |
| Swift (`swift`) | 标签 | P3-7 | Swift compiler | [已核资料](https://raw.githubusercontent.com/swiftlang/swift-book/main/TSPL.docc/ReferenceManual/LexicalStructure.md)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/swift.yaml) |
| Tcl (`tcl`) | 点 | P2-19 | Tcl / tclsh | [已核资料](https://www.tcl-lang.org/man/tcl8.6/TclCmd/Tcl.htm)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/tcl.yaml) |
| tcsh (`tcsh`) | 点 | P3-13 | tcsh 6.21.00; official source releases | [已核资料](https://raw.githubusercontent.com/tcsh-org/tcsh/TCSH6_21_00/tcsh.man)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/tcsh.yaml) |
| Verilog (`verilog`) | 点 | P3-16 | Icarus Verilog | [已核资料](https://steveicarus.github.io/iverilog/usage/simulation.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/verilog.yaml)；Icarus Verilog 软件仿真，不是生成真实硬件。 |
| VHDL (`vhdl`) | 标签 | P3-17 | GHDL | [已核资料](https://ghdl.github.io/ghdl/quick_start/simulation/index.html)；GHDL 软件仿真，不是生成真实硬件。 |
| Visual Basic .NET (`visual-basic.net`) | 标签 | P3-2 | Visual Basic .NET / .NET SDK | [已核资料](https://learn.microsoft.com/en-us/dotnet/visual-basic/language-reference/) |
| WebAssembly (`wasm`) | 点 | P3-14 | WebAssembly / Wasmtime | [已核资料](https://webassembly.github.io/spec/core/text/index.html)；Wasmtime + WAT 工具；固定 WASI/宿主 API 子集。 |
| x86 Assembly (`x86-assembly`) | 点 | P3-15 | NASM | [已核资料](https://www.nasm.us/doc/nasm03.html)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/x86.yaml)；已有人工核实 NASM；ISA/位宽/ABI 与源码语法须固定。 |
| Zig (`zig`) | 标签 | P3-6 | Zig compiler | [已核资料](https://ziglang.org/documentation/master/)；[构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/zig.yaml) |

### C · 已有构建配方，待复现（126）

| 名称 / ID | 地图 | 优先级 | 环境或构建链 | 依据 / 待办 |
| --- | --- | --- | --- | --- |
| &gt;&lt;&gt; (`fishlang`) | 点 | P4 | fish-lang main.fish | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/fishlang.yaml)；待固定依赖并复现 |
| A+ (`aplus`) | 点 | P4 | rlwrap a+ main.a+ | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/aplus.yaml)；待固定依赖并复现 |
| ABC (`abc`) | 点 | P4 | abc "$PWD/main.abc" - | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/abc.yaml)；待固定依赖并复现 |
| Afnix (`afnix`) | 点 | P4 | LD_LIBRARY_PATH=/usr/lib/afnix axi main.als; LD_LIBRARY_PATH=/usr/lib/afnix axi | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/afnix.yaml)；待固定依赖并复现 |
| Aheui (`aheui`) | 点 | P4 | aheui main.aheui | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/aheui.yaml)；待固定依赖并复现 |
| Ante (`ante`) | 点 | P4 | ante main.an → ./main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/ante.yaml)；待固定依赖并复现 |
| APL (`apl`) | 标签 | P2-9 | apl -f main.apl | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/apl.yaml)；待固定依赖并复现 |
| AspectC++ (`aspectcpp`) | 点 | P4 | CPLUS_INCLUDE_PATH=/usr/include/c++/9 ag++ main.cpp -o main → ./main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/aspectcpp.yaml)；待固定依赖并复现 |
| AspectJ (`aspectj`) | 点 | P4 | ajc Main.aj → java Main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/aspectj.yaml)；待固定依赖并复现 |
| ATS (`ats`) | 点 | P4 | patscc main.dats -o main → ./main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/ats.yaml)；待固定依赖并复现 |
| basic calculator (`bc`) | 点 | P4 | bc main.bc | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/bc.yaml)；待固定依赖并复现 |
| Battlestar (`battlestar`) | 点 | P4 | bts main.bts | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/battlestar.yaml)；待固定依赖并复现 |
| BeanShell (`beanshell`) | 点 | P4 | CLASSPATH=/usr/share/java/jline.jar:/usr/share/java/bsh.jar java -Duser.home="$PWD" jline.ConsoleRunner bsh.Interpreter | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/beanshell.yaml)；待固定依赖并复现 |
| Beatnik (`beatnik`) | 点 | P4 | beatnik main.beatnik | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/beatnik.yaml)；待固定依赖并复现 |
| Befunge (`befunge`) | 点 | P4 | befunge main.be | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/befunge.yaml)；待固定依赖并复现 |
| Binary Lambda Calculus (`blc`) | 点 | P4 | cat main.blc &#124; binary-to-text &#124; tromp | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/blc.yaml)；待固定依赖并复现 |
| Boo (`boo`) | 点 | P4 | booc main.boo → mono main.exe; booish | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/boo.yaml)；待固定依赖并复现 |
| Brainfuck (`brainfuck`) | 点 | P4 | brainf main.bf | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/brainf.yaml)；待固定依赖并复现 |
| Bython (`bython`) | 点 | P4 | bython main.by | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/bython.yaml)；待固定依赖并复现 |
| cat (`cat`) | 点 | P4 | cat-lang main.cat | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/cat.yaml)；待固定依赖并复现 |
| Ceylon (`ceylon`) | 点 | P4 | PATH="/usr/lib/jvm/java-8-openjdk-amd64/bin:$PATH" ceylon run --compile=force default | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/ceylon.yaml)；待固定依赖并复现 |
| chef (`chef`) | 点 | P4 | chef main.chef | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/chef.yaml)；待固定依赖并复现 |
| CIL (`cil`) | 点 | P4 | ilasm main.il → mono main.exe | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/cil.yaml)；待固定依赖并复现 |
| Clean (`clean`) | 点 | P4 | clm main -o main → ./main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/clean.yaml)；待固定依赖并复现 |
| ClojureScript (`clojurescript`) | 点 | P4 | lumo -i main.cljs -r | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/clojurescript.yaml)；待固定依赖并复现 |
| Coconut (`coconut`) | 点 | P4 | coconut -i main.coco | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/coconut.yaml)；待固定依赖并复现 |
| CoffeeScript (`coffeescript`) | 点 | P4 | coffee -b -c main.coffee → node -e '   eval.apply(this, [require("fs").readFileSync("main.js", {encoding: "utf-8"})])   require("/opt/coffeescript/lib/node_modules/cof… | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/coffeescript.yaml)；待固定依赖并复现 |
| Crystal (`crystal`) | 点 | P4 | crystal main.cr | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/crystal.yaml)；待固定依赖并复现 |
| Curry (`curry`) | 点 | P4 | SWIPL=swipl pakcs :load main.curry :eval main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/curry.yaml)；待固定依赖并复现 |
| Dafny (`dafny`) | 点 | P4 | dafny main.dfy → mono main.exe | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/dafny.yaml)；待固定依赖并复现 |
| Dc (`dc`) | 点 | P4 | echo 'Reading from stdin...' &gt;&2; dc main.dc - | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/dc.yaml)；待固定依赖并复现 |
| Dhall (`dhall`) | 点 | P4 | cat main.dhall &#124; dhall-to-json &gt; main.json → cat main.json &#124; jq . | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/dhall.yaml)；待固定依赖并复现 |
| Dogescript (`dogescript`) | 点 | P4 | dogescript main.djs &#124; node; dogescript | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/dogescript.yaml)；待固定依赖并复现 |
| Dylan (`dylan`) | 点 | P4 | dylan-compiler -build main.lid && echo → _build/bin/main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/dylan.yaml)；待固定依赖并复现 |
| eC (`ec`) | 点 | P4 | make LD_LIBRARY_PATH=/usr/local/lib/ec → ./obj/release.linux/main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/ec.yaml)；待固定依赖并复现 |
| Elm (`elm`) | 点 | P4 | cp /opt/elm/elm.json elm.json &#124;&#124; exit    run-elm Main.elm   elm repl | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/elm.yaml)；待固定依赖并复现 |
| Elvish (`elvish`) | 点 | P4 | SHELL=/usr/bin/elvish HOME="$PWD" elvish | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/elvish.yaml)；待固定依赖并复现 |
| Emojicode (`emojicode`) | 点 | P4 | emojicodec main.emojic → ./main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/emojicode.yaml)；待固定依赖并复现 |
| Entropy (`entropy`) | 点 | P4 | mono /opt/entropy/entc.exe main.vge &#124; grep -Ev 'WARNING:&#124;Using default' &gt; main.cs   mcs -lib:/opt/entropy -r:Rottytooth.Esolang.Entropy main.cs → MONO_PATH=/opt/entrop… | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/entropy.yaml)；待固定依赖并复现；随机语义，验收使用范围/结构等条件，不固定伪造输出。 |
| Euphoria (`euphoria`) | 点 | P4 | exu main.exu | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/euphoria.yaml)；待固定依赖并复现 |
| Ezhil (`ezhil`) | 点 | P4 | ezhili main.n; ezhili | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/ezhil.yaml)；待固定依赖并复现 |
| Factor (`factor`) | 点 | P4 | HOME="$PWD" factor-lang | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/factor.yaml)；待固定依赖并复现 |
| False (`false`) | 点 | P4 | false-lang main.false | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/false.yaml)；待固定依赖并复现 |
| fish (`fish`) | 点 | P4 | SHELL=/usr/bin/fish fish -C "$(&lt; main.fish)" | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/fish.yaml)；待固定依赖并复现 |
| FLEX (`flex`) | 点 | P4 | lex -o main.c main.lex   clang main.c -o main → echo 'Reading from stdin, ctrl+D to end input...' &gt;&2   ./main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/flex.yaml)；待固定依赖并复现 |
| Gambas (`gambas`) | 点 | P4 | gbs3 main.gbs | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/gambas.yaml)；待固定依赖并复现 |
| GAP (`gap`) | 点 | P4 | gap main.gap | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/gap.yaml)；待固定依赖并复现 |
| GEL Genius (`genius-extension-language`) | 点 | P4 | HOME="$PWD" genius | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/gel.yaml)；待固定依赖并复现 |
| Gnuplot (`gnuplot`) | 点 | P4 | gnuplot main.gnuplot - | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/gnuplot.yaml)；待固定依赖并复现 |
| GolfScript (`golfscript`) | 点 | P4 | golfscript main.gs | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/golfscript.yaml)；待固定依赖并复现 |
| Hack (`hack`) | 点 | P4 | echo "Type 'r' at the debugger prompt to run the code" && hhvm -a main.hack | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/hack.yaml)；待固定依赖并复现 |
| Haxe (`haxe`) | 点 | P4 | haxe --main Main --js Main.js → node Main.js | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/haxe.yaml)；待固定依赖并复现 |
| hexagony (`hexagony`) | 点 | P4 | hexagony main.hxg | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/hexagony.yaml)；待固定依赖并复现 |
| HMMM (`hmmm`) | 点 | P4 | hmmm main.hmmm | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/hmmm.yaml)；待固定依赖并复现 |
| Hy (`hy`) | 点 | P4 | hy -i main.hy | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/hy.yaml)；待固定依赖并复现 |
| Icon (`icon`) | 点 | P4 | icont main.icn → ./main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/icon.yaml)；待固定依赖并复现 |
| Idris (`idris`) | 点 | P4 | mkdir -p .idris/repl; echo ':exec main' &gt; .idris/repl/init; idris2 Main.idr -x main; idris2 Main.idr | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/idris.yaml)；待固定依赖并复现；Riju 配方使用 Idris 2；先核地图记录的 Idris/Idris2 方言范围。 |
| INTERCAL (`intercal`) | 点 | P4 | ick -b main.i → ./main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/intercal.yaml)；待固定依赖并复现 |
| Io (`io`) | 点 | P4 | io -i Main.io | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/io.yaml)；待固定依赖并复现 |
| Ioke (`ioke`) | 点 | P4 | JAVA_OPTS="-Duser.home=$PWD" ioke main.ik; JAVA_OPTS="-Duser.home=$PWD" ioke | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/ioke.yaml)；待固定依赖并复现 |
| J (`j`) | 点 | P4 | ijconsole main.ijs | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/j.yaml)；待固定依赖并复现 |
| jq (`jq`) | 点 | P4 | echo 'Reading from stdin...' &gt;&2   while true; do       jq "$(&lt; main.jq)"   done | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/jq.yaml)；待固定依赖并复现 |
| JSFuck (`jsf`) | 点 | P4 | sed 's/[^[]()!+]//g' main.js &#124; node | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/jsf.yaml)；待固定依赖并复现；通过 JavaScript 引擎执行，保留六字符输入校验，不照搬过滤改写用户源码。 |
| Kalyn (`kalyn`) | 点 | P4 | kalyn → out-kalyn/Main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/kalyn.yaml)；待固定依赖并复现 |
| kitten (`kitten`) | 点 | P4 | kitten main.ktn; kitten | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/kitten.yaml)；待固定依赖并复现 |
| Lazy K (`lazy-k`) | 点 | P4 | lazyk -u main.lazy | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/lazyk.yaml)；待固定依赖并复现 |
| Less (`less`) | 点 | P4 | lessc main.less | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/less.yaml)；待固定依赖并复现 |
| Limbo (`limbo`) | 点 | P4 | limbo -o riju/main.dis riju/main.b → emu -r . riju/main.dis | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/limbo.yaml)；待固定依赖并复现 |
| Lisaac (`lisaac`) | 点 | P4 | lisaac -gcc -Wno-implicit-function-declaration main.li → ./main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/lisaac.yaml)；待固定依赖并复现 |
| LiveScript (`livescript`) | 点 | P4 | lsc -r ./main.ls | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/livescript.yaml)；待固定依赖并复现 |
| LLVM IR (`llvmir`) | 点 | P4 | clang -Wno-override-module main.ll -o main → ./main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/llvm.yaml)；待固定依赖并复现；固定 LLVM IR 版本、目标 triple 与 ABI。 |
| LOLCODE (`lolcode`) | 点 | P4 | lci main.lol | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/lolcode.yaml)；待固定依赖并复现 |
| M4 (`m4`) | 点 | P4 | echo 'Reading from stdin...' &gt;&2; m4 main.m4 - | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/m4.yaml)；待固定依赖并复现 |
| Malbolge (`malbolge`) | 点 | P4 | malbolge main.mb | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/malbolge.yaml)；待固定依赖并复现 |
| MiniZinc (`minizinc`) | 点 | P4 | minizinc --solver Gecode main.mzn | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/minizinc.yaml)；待固定依赖并复现 |
| Miranda (`miranda`) | 点 | P4 | echo "[ Type 'main' to run code ]"   rlwrap mira main.m | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/miranda.yaml)；待固定依赖并复现 |
| MUMPS (`mumps`) | 点 | P4 | gtm_dist=(/usr/lib/x86_64-linux-gnu/fis-gtm/V*_x86_64)   gtm_dist="${gtm_dist[@]}" "${gtm_dist[@]}/utf8/mumps" -r main main.m | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/mumps.yaml)；待固定依赖并复现 |
| Neko (`neko`) | 点 | P4 | nekoc main.neko → neko main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/neko.yaml)；待固定依赖并复现 |
| Nelua (`nelua`) | 点 | P4 | nelua main.nelua | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/nelua.yaml)；待固定依赖并复现 |
| Nickle (`nickle`) | 点 | P4 | nickle main.nickle; echo "Type 'load \"main.nickle\"' at the repl prompt to bring variables into scope" &gt;&2; nickle | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/nickle.yaml)；待固定依赖并复现 |
| Objective C++ (`objective-cpp`) | 点 | P4 | gcc $(gnustep-config --objc-flags) main.mm $(gnustep-config --base-libs) -o main → ./main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/objectivecpp.yaml)；待固定依赖并复现 |
| Objective-C (`objective-c`) | 标签 | P4 | gcc $(gnustep-config --objc-flags) main.m $(gnustep-config --base-libs) -o main → ./main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/objectivec.yaml)；待固定依赖并复现 |
| Odin (`odin`) | 点 | P4 | odin build main.odin → ./main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/odin.yaml)；待固定依赖并复现 |
| Omgrofl (`omgrofl`) | 点 | P4 | java -jar /opt/omgrofl/omgrofl.jar main.omgrofl | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/omgrofl.yaml)；待固定依赖并复现 |
| Ook (`ook`) | 点 | P4 | esco -q main.ook | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/ook.yaml)；待固定依赖并复现 |
| OpenSCAD (`openscad`) | 点 | P4 | openscad main.scad -o main.stl → cat main.stl | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/openscad.yaml)；待固定依赖并复现 |
| Oz (`oz`) | 点 | P4 | ozc -c main.oz → ozengine main.ozf | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/oz.yaml)；待固定依赖并复现 |
| PARI/GP (`pari-gp`) | 点 | P4 | gp main.gp | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/parigp.yaml)；待固定依赖并复现 |
| Parser 3 (`parser`) | 点 | P4 | parser3 main.p | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/parser3.yaml)；待固定依赖并复现 |
| PAWN (`pawn`) | 点 | P4 | pawncc main.pawn -i/opt/pawn/include → pawnrun main.amx | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/pawn.yaml)；待固定依赖并复现 |
| pikachu (`pikachu`) | 点 | P4 | pikalang main.pokeball | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/pikachu.yaml)；待固定依赖并复现 |
| Pike (`pike`) | 点 | P4 | pike main.pike; pike | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/pike.yaml)；待固定依赖并复现 |
| Promela (`promela`) | 点 | P4 | spin main.pml | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/promela.yaml)；待固定依赖并复现 |
| PSeInt (`pseint`) | 点 | P4 | pseint --nouser main.psc | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/pseint.yaml)；待固定依赖并复现 |
| Pug (`pug`) | 点 | P4 | pug main.pug → prettier --no-config main.html | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/pug.yaml)；待固定依赖并复现 |
| Q# (`q-sharp`) | 点 | P4 | dotnet run --project main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/qsharp.yaml)；待固定依赖并复现；Riju 是旧 .NET 3.x QDK 配方；应重核当前 Q# SDK/模拟器，不能直接照搬。 |
| Qalb (`qalb`) | 点 | P4 | qalb main.qalb | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/qalb.yaml)；待固定依赖并复现 |
| Rapira (`rapira`) | 点 | P4 | rapira main.rap | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/rapira.yaml)；待固定依赖并复现 |
| RATFOR (`ratfor`) | 点 | P4 | ratfor main.r -o main.f   gfortran main.f -o main → ./main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/ratfor.yaml)；待固定依赖并复现 |
| Rc (`rc`) | 点 | P4 | rc main.rc; rc | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/rc.yaml)；待固定依赖并复现 |
| Reason (`reason`) | 点 | P4 | bsc main.re &gt; main.js → NODE_PATH=/usr/lib/node_modules node main.js | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/reasonml.yaml)；待固定依赖并复现；Riju 使用旧 bsc/BuckleScript；须选择 Reason+OCaml 或明确的旧 JS 后端版本。 |
| REBOL (`rebol`) | 点 | P4 | rebol main.r; rebol | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/rebol.yaml)；待固定依赖并复现 |
| Red (`red`) | 点 | P4 | "$(which red)" main.red; "$(which red)" | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/red.yaml)；待固定依赖并复现 |
| Rexx (`rexx`) | 点 | P4 | rexx main.rexx | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/rexx.yaml)；待固定依赖并复现 |
| Sage (`sagemath`) | 点 | P4 | HOME="$PWD" sage | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/sagemath.yaml)；待固定依赖并复现 |
| Sass (`sass`) | 点 | P4 | sass main.sass | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/sass.yaml)；待固定依赖并复现 |
| Scilab (`scilab`) | 点 | P4 | scilab-cli -f main.sci | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/scilab.yaml)；待固定依赖并复现 |
| SCSS (`scss`) | 点 | P4 | sass main.scss | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/scss.yaml)；待固定依赖并复现 |
| SETL (`setl`) | 点 | P4 | setl main.setl | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/setl.yaml)；待固定依赖并复现 |
| Slick (`slick`) | 点 | P4 | slick main.sl; slick | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/slick.yaml)；待固定依赖并复现 |
| Squirrel (`squirrel`) | 点 | P4 | squirrel main.nut; squirrel | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/squirrel.yaml)；待固定依赖并复现 |
| Tabloid (`tabloid`) | 点 | P4 | tabloid main.tabloid | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/tabloid.yaml)；待固定依赖并复现 |
| TECO (`teco`) | 点 | P4 | cat main.txt &#124; teco-encode &gt; main.teco → mung main.teco | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/teco.yaml)；待固定依赖并复现 |
| Thue (`thue-programming-language`) | 点 | P4 | thue main.thue | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/thue.yaml)；待固定依赖并复现 |
| unison (`unison`) | 点 | P4 | unison -codebase . run.file main.u main   echo "Type 'load main.u' at the repl prompt to bring variables into scope."   unison -codebase . | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/unison.yaml)；待固定依赖并复现 |
| UNLAMBDA (`unlambda`) | 点 | P4 | unlambda-repl main.unl | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/unlambda.yaml)；待固定依赖并复现 |
| V (`v`) | 点 | P4 | v run main.v | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/v.yaml)；待固定依赖并复现 |
| Vala (`vala`) | 点 | P4 | valac main.vala → ./main | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/vala.yaml)；待固定依赖并复现 |
| Velato (`velato`) | 点 | P4 | asc2mid main.asc &gt; main.mid   mono /opt/velato/Vlt.exe /s main.mid → mono main.exe | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/velato.yaml)；待固定依赖并复现；MIDI 程序输入；需要输入转换或资产支持，不是普通文本 stdout 语言。 |
| Vim script (`vim-script`) | 点 | P4 | vim -c "$(&lt; main.vim)" | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/vimscript.yaml)；待固定依赖并复现 |
| Whitespace (`whitespace`) | 点 | P4 | whitespace main.ws | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/whitespace.yaml)；待固定依赖并复现 |
| YoptaScript (`yoptascript`) | 点 | P4 | yopta main.yopta | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/yoptascript.yaml)；待固定依赖并复现 |
| Yorick (`yorick`) | 点 | P4 | echo "Type '#include \"main.i\"' to run the code."   rlwrap yorick | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/yorick.yaml)；待固定依赖并复现 |
| Z shell (`z-shell`) | 点 | P4 | SHELL=/usr/bin/zsh HOME="$PWD" zsh | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/zsh.yaml)；待固定依赖并复现 |
| Zoem (`zoem`) | 点 | P4 | zoem -I main.azm; zoem | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/zoem.yaml)；待固定依赖并复现 |
| Zot (`zot`) | 点 | P4 | zot --file main.zot | [构建配方](https://github.com/radian-software/riju/blob/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs/zot.yaml)；待固定依赖并复现 |

### D · 实现候选明确，构建待核（24）

| 名称 / ID | 地图 | 优先级 | 环境或构建链 | 依据 / 待办 |
| --- | --- | --- | --- | --- |
| Boogie (`boogie`) | 点 | P4 | Boogie + SMT solver | [实现入口](https://boogie-docs.readthedocs.io/en/latest/)；验证器输出证明/反例，不冒充一般程序 stdout。 |
| Carbon (`carbon`) | 点 | P4 | Carbon compiler / explorer | [实现入口](https://github.com/carbon-language/carbon-lang)；实验语言；固定实现修订和支持的子集，不能仅凭 CE 收录保证完整执行。 |
| CWL (`common-workflow-language`) | 点 | P4 | cwltool | [实现入口](https://github.com/common-workflow-language/cwltool)；依赖工作流工具、输入文件；不能向用户暴露宿主 Docker 管理接口。 |
| E (`e`) | 点 | P4 | E / rune | [实现入口](http://erights.org/)；快照有命令名；待核发行包、JVM 和启动步骤。 |
| Fennel (`fennel`) | 点 | P4 | Fennel → Lua | [实现入口](https://fennel-lang.org/)；可复用 Lua 执行后端；需归档编译器与核对版本，本轮 setup 页抓取受阻。 |
| ink (`ink`) | 点 | P4 | inkle ink / inklecate + narrative runtime | [实现入口](https://github.com/inkle/ink)；Riju 的 ink 配方使用 thesephist/ink，是另一门同名语言；应选 inkle 官方编译器/播放器并支持叙事选项。 |
| Jakt (`jakt`) | 点 | P4 | Jakt → C++ → 原生 | [实现入口](https://github.com/SerenityOS/jakt)；固定引导编译器、C++ 工具链和语言版本。 |
| Janet (`janet`) | 点 | P4 | Janet / janet script.janet | [实现入口](https://janet-lang.org/)；官网明确脚本调用与 C 实现；待固定源码和目标镜像。 |
| Jolie (`jolie`) | 点 | P4 | Jolie / JVM | [实现入口](https://www.jolie-lang.org/)；核实无网络的最小服务示例与退出方式。 |
| Mercury (`mercury`) | 点 | P4 | Mercury compiler | [实现入口](https://www.mercurylang.org/)；不能把快照 mmi 名称直接当作完整构建链；安装页待核。 |
| MLIR (`mlir`) | 点 | P4 | LLVM MLIR tools + 选定 dialect / lowering | [实现入口](https://mlir.llvm.org/)；不存在适用于任意 dialect 的统一运行器；先定义可执行子集。 |
| MoonScript (`moonscript`) | 点 | P4 | moon / moonc → Lua | [实现入口](https://moonscript.org/)；官方明确安装与运行入口；固定 LPeg 等依赖再复用 Lua 后端。 |
| NewLisp (`newlisp`) | 点 | P4 | newLISP interpreter | [实现入口](http://www.newlisp.org/)；待核固定源码/发行包与平台兼容。 |
| Nextflow (`nextflow`) | 点 | P4 | Nextflow / JVM | [实现入口](https://github.com/nextflow-io/nextflow)；需离线依赖和任务目录；不默认允许联网拉容器或执行任意宿主命令。 |
| Parrot Assembly (`parrot-assembly`) | 点 | P4 | Parrot VM / PASM | [实现入口](https://github.com/parrot/parrot)；旧 VM 有源码；待核现代构建依赖和汇编输入支持。 |
| PicoLisp (`picolisp`) | 点 | P4 | PicoLisp / pil | [实现入口](https://picolisp.com/)；待核具体发行、启动参数与底层依赖。 |
| PIR (`parrot-internal-representation`) | 点 | P4 | Parrot VM / PIR | [实现入口](https://github.com/parrot/parrot)；与 PASM 共用 VM 但分别验证语法及装载。 |
| Pony (`pony`) | 点 | P4 | ponyc → 原生 | [实现入口](https://www.ponylang.io/)；官网有安装/源码构建入口；核实 LLVM 依赖和进程预算。 |
| Raku (`raku`) | 点 | P4 | Rakudo / raku | [实现入口](https://www.raku.org/)；待固定 Rakudo、NQP、MoarVM 组合。 |
| Rescript (`rescript`) | 点 | P4 | ReScript compiler → JavaScript | [实现入口](https://rescript-lang.org/)；官方有 npm 工具链；快照 ocaml 解释器字段不能直接运行 ReScript。 |
| SMT (`smt`) | 点 | P4 | 选定 SMT-LIB 版本 + Z3 / cvc5 等求解器 | [实现入口](https://smtlib.cs.uiowa.edu/language.shtml)；返回 sat/unsat/model；不同 logic 与 solver 能力需单列。 |
| Solidity (`solidity`) | 点 | P4 | solc + 固定本地 EVM | [实现入口](https://github.com/ethereum/solidity)；编译 ABI/bytecode 不等于合约已执行；无真实资产，使用本地临时状态。 |
| SuperCollider (`supercollider`) | 点 | P4 | sclang；音频合成另需 scsynth | [实现入口](https://supercollider.github.io/)；先做无声语言计算；音频和设备访问另评估。 |
| Terra (`terra`) | 点 | P4 | Terra + 匹配 LLVM / LuaJIT | [实现入口](https://terralang.org/)；普通 lua 不能替代 Terra；固定 LLVM 和目标架构。 |

### E · 先明确方言、宿主或历史版本（20）

| 名称 / ID | 地图 | 优先级 | 环境或构建链 | 依据 / 待办 |
| --- | --- | --- | --- | --- |
| Algol (`algol`) | 点 | 条件专题 | 须选 ALGOL 60 / ALGOL 68；现有 Riju 配方是 a68g（ALGOL 68） | 不能把家族 1958 年条目当作已复现 ALGOL 68；ALGOL 60 另有独立节点。 |
| Applescript (`applescript`) | 点 | 条件专题 | macOS / osascript | 实现明确；需要专门 macOS 执行主机，不进入当前 Linux 容器首批。 |
| Assembly language (`assembly-language`) | 标签 | 条件专题 | 先选 ISA、汇编器语法、位宽与 ABI；优先复用独立 x86 节点 | 家族总称没有唯一运行时，不能直接分配一个 Assembly 容器。 |
| B (`b`) | 标签 | 条件专题 | Bell Labs 历史 B 编译器；后续查原始工具链或明确命名的复现实现 | 历史手册证实实现存在，尚无本项目固定的现代复现链。 |
| BASIC (`basic`) | 标签 | P2* | FreeBASIC（已有人工核实）；Riju 使用 bwbasic | 可以先做明确标注方言的 BASIC 实验；不代表 1964 年 Dartmouth BASIC。 |
| Batchfile (`batch`) | 点 | 条件专题 | Windows cmd.exe；Riju 使用 Wine cmd | 先选原生 Windows 或 Wine 兼容子集；不保证 Windows API 与命令兼容。 |
| C shell (`c-shell`) | 点 | 条件专题 | 2BSD C shell 历史源码；现代演示可另选明确标注的兼容实现 | 本机 /bin/csh 是 tcsh，不作为原始 csh 执行证明。 |
| Linden Scripting Language (`lsl`) | 点 | 条件专题 | Second Life 宿主；OpenSimulator LSL 子集候选 | 依赖事件、对象和世界 API；单个 lsl 命令名不足以证明独立执行。 |
| Lisp (`lisp`) | 标签 | 条件专题 | 原始 LISP / IBM 704 历史实现；现代教学先用独立 Common Lisp 或 Scheme 节点 | 现代 SBCL 不代替 1958/1960 年历史 LISP 实现。 |
| MATLAB (`matlab`) | 标签 | 条件专题 | MathWorks MATLAB | 实现明确但需许可和对应宿主；GNU Octave 是独立节点，不能冒充 MATLAB。 |
| Modula-2 (`modula-2`) | 点 | 条件专题 | 历史 Lilith 编译器已有资料；现代 GNU Modula-2 为待核构建候选 | 需确认具体语言模式、标准库和版本，不能以现代编译代替 Lilith 重现。 |
| Nu (`nu`) | 点 | 条件专题 | programming-nu/nu / nush，依赖 Objective-C runtime 与 Foundation | 有源码与构建说明；需验证老依赖在目标平台可编译，不与 Nushell 混淆。 |
| PL/SQL (`pl-sql`) | 标签 | 条件专题 | Oracle Database PL/SQL | 需数据库发行版本、许可、隔离 schema 和会话清理；PostgreSQL PL/pgSQL 不能替代。 |
| sh (`sh`) | 点 | 条件专题 | Unix V7 Bourne shell 源码及历史宿主；现代 POSIX shell 应另标 | Riju 的 posh 不能作为 V7 sh 的原样执行证据。 |
| Simula (`simula`) | 标签 | 条件专题 | Simula I / Simula 67 历史实现；先选版本并研究可复现发行 | 历史存在性有依据，但尚未核定本馆的源码、宿主和引导链。 |
| SNOBOL (`snobol`) | 标签 | P2* | 先选 SNOBOL4 / CSNOBOL4；Riju 命令 snobol4 | 可搭现代 SNOBOL4 方言，但不能宣称运行 1962 年初始 SNOBOL。 |
| VBA (`vba`) | 点 | 条件专题 | Microsoft Office VBA / Visual Basic Editor | 依赖 Office 宿主及文档对象模型，不等同于 VB.NET。 |
| VBScript (`vbscript`) | 标签 | 条件专题 | Windows Script Host / cscript.exe | 需确认所选 Windows 版本功能可用；不在浏览器直接运行。 |
| Visual Basic (`visual-basic`) | 标签 | 条件专题 | 经典 Visual Basic / VB6 历史开发与运行环境 | 快照 Riju 和 Compiler Explorer 线索对应 .NET 风格工具链，不能用来证明 VB6。 |
| Wolfram Language (`wolfram`) | 点 | 条件专题 | Wolfram 官方引擎；Mathics 仅为兼容实现候选 | Riju 使用 Mathics；须标注兼容子集，官方环境另核许可与部署。 |

### F · 当前资料不足以构建目标环境（4）

| 名称 / ID | 地图 | 优先级 | 环境或构建链 | 依据 / 待办 |
| --- | --- | --- | --- | --- |
| FLOW-MATIC (`flow-matic`) | 点 | 研究 | 暂未形成对应目标的可复现构建链 | 见上方“当前资料不足” |
| GRASS (`grass`) | 点 | 研究 | 暂未形成对应目标的可复现构建链 | 见上方“当前资料不足” |
| SLANG (`slang`) | 点 | 研究 | 暂未形成对应目标的可复现构建链 | 见上方“当前资料不足” |
| Text Executive Programming Language (`text-executive-programming-language`) | 点 | 研究 | 暂未形成对应目标的可复现构建链 | 见上方“当前资料不足” |

## 来源、复查与维护

- 点位集合：[map-eligible-ids.json](../../data/audit/map-eligible-ids.json)；标签选择：[label-selection.json](../../data/audit/label-selection.json)；原始快照：[pldb.json](../../data/raw/pldb.json)。
- 已核实现及历史边界：[reviews.json](../../data/audit/reviews.json)；逐项本机样例状态：[catalogue.csv](catalogue.csv)。旧 [RUNTIME_FEASIBILITY.md](RUNTIME_FEASIBILITY.md) 含早期“Rust 尚未接入”等历史结论，当前能力以源码与 EXECUTOR.md 为准。
- 本轮只读核对 Riju 固定修订 [`ace9df7cd8f186b869af14d721e055864ed8f3e4`](https://github.com/radian-software/riju/tree/ace9df7cd8f186b869af14d721e055864ed8f3e4/langs) 中的安装、编译、运行配置。未执行下载的配方；不将它们作为网站构建依赖。配置常含未固定的包版本、动态下载或废弃依赖，须在对应原型阶段重新固定。
- 下载的该修订源码归档 SHA-256：`adc907ad933b5394f2bcdd6cda6f9a109c738c205dcf7643c60b85dfd561af3f`。表中保留固定修订链接和执行链摘要，本文本身不依赖临时下载文件。
- 后续若落实一门语言，在本文件对应行更新状态、固定版本和核验记录；不要把这次盘点当作对原始快照或线上运行状态的修改。

最初的盘点轮仅修改文档；后续经用户明确指令，已完成两批共十门的固定工具链准备、源码接入和临时环境核验。未修改馆藏身份或历史关系，未提交、推送或部署。
