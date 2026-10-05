# 地图节点关系复核

本页基于固定 PLDB 快照和当前人工关系。运行 `npm run audit` 可重生成 [地图节点逐项表](map-lineage-review.csv)和 [50 个常显标签逐项表](label-lineage-review.csv)。表中区分地图上游、下游、地图外连线及证据层级。`no-map-link` 只表示当前地图两端之间没有已收录连线，不能解释为没有历史关系。

## 全图盘点

当前节点数量、连线参与情况和仍无设计层地图内连线的常显标签，见[自动生成的当前状态](MAP_STATUS.md)。它与逐项 CSV 由同一次 `npm run audit` 生成，避免人工名单在补关系后继续列出已经解决的节点。

实现与生态关系另见[独立关系输入](../../data/ecosystem-relations.json)及规范化关系中的实现／兼容边；它们不参与设计层谱系深度计算。

## 本轮补充的关系

除已有的 BCPL → B → C、C → Objective-C、C/C++ → Java、Java → Scala/Groovy/C#、Objective-C → Swift，以及 Ruby 设计者列举的 Perl、Smalltalk、Eiffel、Ada、Lisp 影响，本轮为常显标签补充了 19 条带出处的关系。逐条来源、关系类型、原文说明和来源哈希见 [关系清单](relationship-review.csv)及 [人工关系输入](../../data/relationship-overrides.json)。

主要新增：Go 官方 FAQ 说明 C 家族语法和 Pascal、Modula、Oberon 的设计输入；PHP 官方历史说明早期 Perl 风格语法和 C 风格结构；Oracle 把 PL/SQL 定义为 SQL 的过程式扩展；Python 作者确认 ABC 的影响；Julia 设计者列举多门语言作为设计目标参照；Microsoft 提供 Visual Basic 6 到 VB.NET 的升级资料；R 手册称 R 是 S 的另一种实现；Octave 官方说明与 MATLAB 基本兼容；F# 设计者论文说明 OCaml 的影响。这些分别记录为影响、后继、实现或兼容关系，不混称为严格继承。

本次又依据 [Rust Reference 的影响清单](https://doc.rust-lang.org/reference/influences.html)补充 C++、OCaml、Haskell、Erlang、Scheme、C#、Ruby → Rust 七条具体设计影响。Python 与 C/C++ 的 CPython 扩展接口、与 Java 的 Jython 平台实现、与 Rust 的 PyO3 互操作，以及 Rust 与 C 的 FFI，分别保存于 [生态关系输入](../../data/ecosystem-relations.json)。这些线只表示所注明的实现或工具；不能由平台共存推断语言继承。

根据微软刊载的 [BASIC 历史概述](https://techcommunity.microsoft.com/blog/smallbasic/a-brief-history-of-basic/336312)补入 BASIC → Visual Basic；该文改编自教学书籍，属于明确的二手史料，不能当作设计者一手回忆。微软 [VBA 文档](https://learn.microsoft.com/en-us/office/vba/language/concepts/getting-started/64-bit-visual-basic-for-applications-overview)将 VBA 定义为 Office 随附的 Visual Basic 版本；[VBScript 文档](https://learn.microsoft.com/en-us/windows/win32/com/translating-to-vbscript)明确称 VBScript 是 VBA 子集。两条后续关系已进入完整馆藏档案；2026-10-03 补核微软语言参考、具体循环语法及宿主运行说明后，VBA 与 VBScript 已加入地图，两段关系可见；不推断各宿主的源码完全兼容。VBScript 正在弃用，来源身份核实不表示推荐用于新项目，详见[人工审查记录](../../data/audit/reviews.json)。

## 后续关系核实

[当前缺口名单](MAP_STATUS.md)只表示当前输入没有设计层地图内连线。优先按[常显标签逐项表](label-lineage-review.csv)核对版本身份、地图外端点、原始文献与关系类型，再查其余地图节点。

- Algol 家族节点与具体 ALGOL 60 记录需要先核实对应，不能直接转接 Pascal。
- 地图外关系两端需分别核实身份与地图资格；不能为凑图而替换成名称相近的地图节点。
- 汇编是语言类别，应按具体指令集和方言研究，不自动把所有高级语言挂在一个汇编节点下。
- 平台接口和互操作不构成设计继承。Java 的 MATLAB API 不能作为 Java → MATLAB 的影响依据；Java/Kotlin 互操作也不能直接证明后继关系。

自动语句扫描只提供待核候选。已补的 Kotlin、Lua 设计关系见下文；后续缺口数量及只有来源字段级依据的关系数量以自动状态和逐项表为准。

## 2026-10-03：Kotlin 与 Lua 的设计来源

[Kotlin 官方 FAQ](https://kotlinlang.org/docs/faq.html)《Is Kotlin hard?》明确列出 Java、C#、JavaScript、Scala、Groovy 的设计启发，五条均以 `influencedBy` 录入。它们不表示 Kotlin 是对应语言的超集或源码兼容版本；JVM 互操作不是这些边的证据。

Lua 三位作者的 [The Evolution of Lua](https://www.lua.org/doc/hopl.pdf)（HOPL III, 2007）PDF 第 2 页明确说明 Scheme 对匿名函数、完整词法作用域的启发；第 5 页说明 Modula 的控制结构语法、CLU 的多重赋值和多返回值、C++ 的局部声明位置、SNOBOL 与 awk 的关联数组。六条按具体设计影响录入。相关两页已提取并实际查看，审查记录保留原文摘录、读取时间和整个 PDF 响应字节哈希；哈希口径见记录的 `hashScope`。

CLU 与 Modula 目前不在地图证据名单，因此只在完整档案中出现。论文写的是 Modula，未指定 Modula-2，不能自动换成后者；提到其他语言作为比较或宿主接口，也不自动成为设计影响边。本次未核实 Lua 所有历史来源，亦未增加网页运行环境。

## 2026-10-04：Zig 与 C 的实现互操作

[Zig 官方 Overview](https://ziglang.org/learn/overview/)说明 `@cImport` 可直接导入 C 类型、变量、函数与简单宏，`export` 可导出 C ABI 接口供 C 等语言调用。已在生态层新增 C/Zig 双向互操作，保留原文摘录、读取时间及响应哈希；不据此推断 Zig 是 C 的超集或设计后继。

本轮还读取 PowerShell 语言规范 3.0 导言与 Dart 官方 Overview：前者说明语法和关键词类似 C#，后者说明 JavaScript/WebAssembly 编译目标。语法对照和编译目标均不足以单独证明设计继承，本轮未添加对应设计关系，审查备注已说明。Zig 仍列在设计层缺口名单中，生态关联不冒充填补设计来源。

## 2026-10-04：ALGOL 家族与 ALGOL 60 版本

新增 ALGOL 60 语法与实现审查：1963 Revised Report 和1976 Modified Report 使用 N. Landsteiner 的 HTML 转录镜像，保留出处、摘录与响应哈希；GNU MARST 2.8 的官方发行包 README 明确实现1976 Modified Report 的 Level 0 硬件表示并翻译至 C。归档包哈希按完整压缩响应字节计算，摘录注明来自 README/INSTALL。初次审查仅核实文档；随后在临时目录编译 MARST 并完成三份原创程序及错误语法核验，见 [本机核验说明](ALGOL60_RUNTIME.md)。传名调用的生成 C 有求值顺序警告，结果不证明跨平台符合性，也未接入页面运行时。

具体 `algol-60` 节点加入地图，接替 `algol` 家族总称作为历史常显标签。家族仍在全量馆藏和地图中，未合并条目或迁移关系端点。ALGOL 60 对 Pascal、Simula、Oberon 的既有字段级记录现在可见；这些边没有因节点入图就自动升级为一手史料已核关系。当前数量及证据等级见[自动状态](MAP_STATUS.md)。

### ALGOL 60 的两条关系补证（2026-10-04）

复读 Dahl《The Birth of Object Orientation: the Simula Languages》PDF第2–3页，明确 Simula I 以 ALGOL 60 为基础，沿用块结构并加入模拟机制，Simula 67 随后概括与改进。将 ALGOL 60→Simula 既有影响边补为作者原文依据；旧编译器的兼容描述不扩大到全部 Simula 版本。

读取 Wirth《Good Ideas, Through the Looking Glass》（ETH 作者目录，Computer 2006年1月）印刷第63页 / PDF第8页，原文说明 Pascal 等后来的语言用引用参数替代 ALGOL 传名参数。将 ALGOL 60→Pascal 既有影响边补为“参数机制的设计回应”，不声称严格超集或源码兼容。两份相关页面均渲染核读，来源记录保存完整PDF响应哈希及摘录；未将不成功的 PascalHistory.pdf 地址当作证据。

总关系数仍为393；附论证关系增至57，字段级待核降至336。ALGOL 60→Oberon 等其余关系保持待核，不能因同一流派或作者而自动升级。

### Pascal / Modula-2 / Oberon（2026-10-04）

读取 ETH 作者目录的 Wirth《Modula-2 and Oberon》HOPL-3 投稿稿（2006年6月修订），第2–3、10、13、16页已渲染核读。Pascal→Modula-2 按作者“genuine successor”和“new version”记为后继，不表示超集；Mesa 模块及分离编译、早期 Modula monitor 到模块的设计输入各自保留。Modula-2→Oberon 记为简化与类型扩展的设计影响，不以“编译器用某语言编写”单独推导血缘。Pascal→Mesa 为 Wirth 的回顾，非 Mesa 作者直接声明。

Modula-2 与 Oberon 保存模块/类型语法及历史编译器的作者叙述，标为历史一手资料；本轮未重现执行，不显示网页运行图标。Modula-2 加入地图，Mesa/Modula 的语法与实现仍须继续核实，保留档案入口。Modula-2 快照1978年、报告1979年分别涉及不同事件，Oberon 的1986年语言定义与同名系统1989年发布分开，不自动替换来源年代。新增5 条关系后共398 条，附论证62 条，字段级待核336 条；新来源每条审查各自存档，已阅读来源137 条不代表独立文献有137 份。

### BASIC 的初学者语言设计参照（2026-10-04）

TIME 的 Harry McCracken 2014年报道引用 Kurtz 对 Fortran/ALGOL 简化子集尝试及其失败的回顾，随后叙述重新设计易理解语法的目标。加入 fortran/algol→basic 两条“设计参照与回应”影响边；这不是成功子集、源码兼容或严格后继声明。报道未指定版号，不换成 FORTRAN II 或 ALGOL 60。依据是记者报道中的设计者采访，保存响应哈希和原文。

Bitsavers 的1964年10月1日 Dartmouth BASIC 手册第3、9、18、20个PDF页分别核读标题、完整程序、循环与DTSS宿主，补为历史语法入口，未把现代 FreeBASIC 的样例通过算作初版重现。Dartmouth basicfifty 地址本次TLS失败，CHM basic-at-50 返回403，未将它们算作已阅读证据。PDF本身为扫描件，文本抽取为空、Vision OCR失败后采用渲染视觉核读；摘录只覆盖明确列出的页。当前关系400 条，64 条附论证、336 条字段级待核。


## 2026-10-04 Forth 与 PostScript 的设计输入

核读 Moore《Forth: The Early Years》作者仓库中的 HTML 镜像（1991年稿、1999年前言）：前言明确该稿未被 HOPL II 接受，不能冒充正式会议论文。作者明确称仿效 APL 运算符，描述 Forth 前身 CURVE 的冒号格式来自 Algol 标签，并将早期 DO/CONTINUE 词名说成向 Fortran 致意。分别补入 APL→Forth、Algol→Forth、Fortran→Forth 三条局部影响关系；不以编写实现所用语言推定继承，也不把未指定的 Algol 替换成 ALGOL 60。APL 采纳时间不能据回忆章节标题锁定1958年。

Adobe《PostScript Language Reference》第三版（1999）第23页明确描述 Forth 后缀语法，以及 Lisp 程序作为数据与执行状态控制输入；第850页索引明确列 Forth 为 PostScript influence。对应补入 Forth→PostScript 和 Lisp→PostScript。视觉核读 PDF 第19、37、38、864页，保存完整响应 SHA-256、URL、读取时间及摘录。第24页解释对象执行、栈和字典查找，支持历史一手语言审查；本轮未执行 PostScript 或接入网页运行。馆藏1982年设计时代与手册所称1985年引入不是同一事件，保留范围说明。

本次新增五条附论证关系：规范化关系405条，其中69条附论证、336条字段级待核；231个地图节点中175个暂无设计层可见线，50个常显标签中8个暂无该层线。完整状态仍以 [自动审计](MAP_STATUS.md) 为准。

25项默认测试、离线审计及构建通过；20项实际 Chrome 检查覆盖两种尺寸、两种地图与双关系层共1,152个选中/恢复案例，新关系宽窄屏截图已查看。浏览器记录见 [核验记录](../../data/audit/browser-runtime-checks.json)。


## 2026-10-04 Prolog 与 Erlang 的历史演进

Armstrong《Making reliable distributed systems in the presence of software errors》（2003年博士论文）§1.1 印刷第3–5页 / PDF第15–17页已提取、渲染并视觉核读。1986年开始向 Prolog 加入并发进程实验；1987年 Erlang 原型嵌入 Prolog、没有独立语法。1989年 JAM 参考 WAM，借用模式匹配编译技术，但移除回溯，增加并发进程、消息传递与故障检测。1990年形成独立语法，1991年 JAM 替代 Prolog 实现。来源 URL、读取时间、完整PDF响应哈希和摘录保存在 Erlang 审查记录。

补入 Prolog→Erlang“早期并发扩展与演进”影响关系；不是当代超集、源码兼容或仅凭实现用某语言编写推断的关系。Strand 交叉编译、C 实现及 PLEX 产品对照不能据这几页自动写作设计继承。各年代是不同研发事件，不替换馆藏年份。本机未发现 erl/erlc/escript/swipl，未安装工具、重现历史实现或接入网页运行。

当前406条规范化关系，其中70条附论证、336条字段级待核；231个地图节点中174个暂无设计层线，50个常显标签中7个暂无该层线。全量馆藏入口与证据筛选规则保持一致，缺口数量不代表其余关系已全部找全。

本次25项默认测试、审计及构建通过；21项实际 Chrome 检查含 Prolog↔Erlang 前后导航、当前双层地图1,156个选中/恢复案例。宽窄屏截图已查看，核验输入和被服务文件哈希与当前版本一致。


## 2026-10-04 Ada 与 VHDL 的语法和语义输入

[GHDL 官方 About](https://ghdl.github.io/ghdl/about.html)明确说“VHDL derives most of its syntax and semantics from Ada”，随后说明 VHDL 面向硬件、采用事件驱动的高度并发模型，并区分仿真执行和综合成网表。补入 Ada→VHDL“语法与语义的设计基础”影响边，来源层级明确为实现项目说明，不是原始设计者论文；不表示超集、源码兼容或自动生成硬件。记录保存 URL、读取时间、响应哈希和摘录。

文档中的1983年研发与1987年首个标准是不同事件，不更改馆藏年代。本机未发现 GHDL 或 gnatmake，未安装、执行仿真或综合，未增加网页运行语言。尝试的工作组 HistoryOfVHDL 地址返回500、eda.org FAQ返回404，未算作已阅读来源；VASG 新首页和 UMBC 简明语法表均无本次关系的直接论证，未用它们补强影响边。

当前407条规范化关系，其中71条附论证、336条字段级待核；231个地图节点中173个暂无设计层连线，50个常显标签中6个暂无该层连线。尚需继续寻找原始设计说明及具体机制。

25项默认测试、审计及构建通过；22项实际 Chrome 检查和1,160个双层地图选中/恢复案例通过。新关系的键盘预览、Ada/VHDL 详情前后导航和宽窄屏截图已检查，来源层级及未接入在线执行的说明保持可见。


## 2026-10-04 PowerShell 的历史线索与 C# 扩展接口

核读 Snover 作者站点的《Monad Manifesto》版本1.2，PDF第1、12、15页已渲染查看：第1页脚注明确它是更新过的长期设计愿景，不是 PowerShell V1.0 的精确实现说明；第12页提到 POSIX shell 模型起点与 C# 迁移目标，第15页明确 Bourne Shell 语法和控制结构输入。原始无浏览器标头请求返回406，普通浏览器标头的公开请求返回200；保存实际PDF响应哈希、URL和摘录。微软博客地址403未算已阅读证据。

馆藏 `sh` 目前把1971年与作者 Stephen Bourne 放在同一记录，又有 Bash/sh 别名冲突队列。不能把这个未经解决的条目直接等同于宣言中的具体 Bourne Shell，也不能替换成 Bash 连线。后续应读取 Bourne 原始论文与手册，区分 Thompson shell、Bourne shell、POSIX shell 和当前 `/bin/sh` 实现。C# 迁移目标不自动证明已实现语法继承，莱布尼茨的哲学术语也不能冒充函数式语言关系；设计层保持待核。

微软 Add-Type（PowerShell7.6）文档明确 C# 默认源码编译、会话内 .NET 类型和方法调用，补入 C#→PowerShell `extensionInterface`，显示于独立实现与生态层。这是具体接口，不只是共同运行在 .NET；不表示继承、源码兼容或网页编译。来源 URL、哈希、时间和摘录保存在 PowerShell 审查记录。本机没有 pwsh/powershell，未安装、执行该接口或增加网页运行时。

已阅读来源145条，独立生态关系7条；规范化设计/历史关系仍407条，地图设计层缺口不因生态接口被计为填补。当前全图状态以 [自动审计](MAP_STATUS.md) 为准。

25项测试、离线审计与构建通过；22项实际 Chrome 检查扩展至 PowerShell 生态层，双层地图1,164个选中/恢复案例通过。新关系宽窄屏截图已查看，独立接口类型、无继承箭头、真实来源入口与无网页运行标识已核，记录哈希与当前版本一致。后续已取得 Unix V7 的 TUHS 原始 sh.1 与 Mascheck 的 Bourne V7 手册转录入口，尚未将其加入语言审查或纠正 sh 记录。
