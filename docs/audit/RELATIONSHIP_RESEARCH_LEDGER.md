# 关系研究台账

这份台账记录已经处理过的关系问题，避免后续批次在没有新触发条件时重复搜索同一批来源。它与逐条关系状态不同：关系状态说明当前数据有什么证据，台账说明某个研究问题已经走到哪一步。

## 状态含义

- `verified`：找到合格原文，关系已补入并限定了证据范围。
- `closed-no-qualifying-source`：在记录的批次范围内已经核查，但没有足以升级关系的原文；保留为待核/缺口，不重复做同一轮搜索。
- `blocked`：来源、版本或端点身份受阻，不能解释为“没有历史关系”。有新来源时优先重开。

只有出现台账中的 `reopenWhen` 条件，才重新研究已收口项目。机器可读的完整记录见 [relationship-research-ledger.json](../../data/audit/relationship-research-ledger.json)。

## 已核实

| 关系 | 批次 | 结论 |
| --- | --- | --- |
| Java → JavaScript | Batch 13 | Java-like 语法外观与平台定位的局部设计参照 |
| Scheme → JavaScript | Batch 13 | Scheme-ish 一等函数的局部设计影响 |
| JavaScript → Dart | Batch 14 | 浏览器/JavaScript 兼容和语法取舍的局部影响 |
| Python → Cython | Batch 16 | Cython 官方明确称其为 Python 超集 |
| C2 → C3 | Batch 16 | C3 官方 README 明确称 C2 为设计灵感 |
| APL → BQN | Batch 17 | BQN 官方说明保留并重做 APL 传统中的核心思想 |
| JavaScript → JSON | Batch 17 | JSON 官方明确称其基于 JavaScript 标准的一个子集 |
| C → C3 | Batch 17 | C3 官方 README 明确说保留并现代化 C 的语法与语义 |
| C → Zig | Batch 32 | 作者明确以“more pragmatic than C”为目标并逐项说明 C 对照设计，但不称继承/超集 |
| Sass → Less | Batch 34 | Less 官方明确称最初受 Sass 启发并选择更接近 CSS 的语法 |
| Ruby → Crystal | Batch 36 | Crystal 官方明确称语法受 Ruby 启发，且兼容不是目标 |
| Erlang → Elixir | Batch 37 | Elixir 官方明确说明运行在 Erlang VM 上；仅生态宿主关系 |
| C、C++、Fortran、Java、MATLAB → Chapel | Batch 38 | Chapel 官方概述将五者列为主要语言设计影响；不表示兼容、运行时或继承 |
| C#、CLU、ML、Modula、Scala → Chapel | Batch 39 | Chapel 官方概述将五者列为主要语言设计影响；不表示兼容、运行时或继承 |
| ALGOL 60 → ALGOL W | Batch 31 | Stanford 归档实现报告明确以 Wirth/Hoare ALGOL 改造工作为编译器基础 |
| Lisp → Common Lisp | Batch 22 | 作者明确称 Common Lisp 是 Lisp 的新方言 |
| MacLisp → Common Lisp | Batch 22 | 作者明确称 Common Lisp 是 MacLisp 的后继 |
| Scheme → Common Lisp | Batch 22 | 作者明确写受 Scheme 有限度影响 |
| Interlisp → Common Lisp | Batch 22 | 作者明确写受 Interlisp 有限度影响 |
| Miranda → Haskell | Batch 23 | Haskell 设计者历史论文明确称设计受 Miranda 强烈影响 |

### 批次 25：F# 的 C# 设计输入与 Python 候选核查

| 关系 | 批次 | 结论 |
| --- | --- | --- |
| C# → F# | Batch 25 | 作者论文明确列出 C# 1.0 对象/属性/事件、C# 3.0 LINQ、C# 7.0 Span |
| Python → F# | Batch 25 | 作者论文未写 Python 是 F# 设计输入；Python 只影响 C# 4.0 dynamic，保留为不补线 |
| F# → TypeScript | Batch 26 | 作者论文明确称 TypeScript 直接受 F# 影响，并指出起源者来自 F# 团队 |
| Lisp → Clojure | Batch 27 | Clojure 官方明确称其为 Lisp 家族成员并承继 code-as-data/宏系统 |
| Standard ML → Alice | Batch 28 | Alice 官方手册明确称其基于 Standard ML 并列出扩展 |

### 批次 29：Haskell 报告的非地图前驱

| 关系 | 批次 | 结论 |
| --- | --- | --- |
| ISWIM → Haskell | Batch 29 | 官方报告列为 particularly influential forerunner |
| FP → Haskell | Batch 29 | 官方报告列为 particularly influential forerunner |
| ML → Haskell | Batch 29 | 官方报告列为 particularly influential forerunner |
| Hope → Haskell | Batch 29 | 官方报告列为 particularly influential forerunner |
| Gofer → Haskell | Batch 29 | 官方报告列为 particularly influential forerunner |
| Sisal → Haskell | Batch 29 | 官方报告列为 particularly influential forerunner |

Id 在报告中被列为前驱，但当前 PLDB 快照没有对应端点，保留为馆藏/关系待办。

### 批次 24：Haskell 报告序言列出的地图可见前驱

| 关系 | 批次 | 结论 |
| --- | --- | --- |
| Lisp → Haskell | Batch 24 | 官方报告列为 particularly influential forerunner |
| Common Lisp → Haskell | Batch 24 | 官方报告列为 particularly influential forerunner |
| Scheme → Haskell | Batch 24 | 官方报告列为 particularly influential forerunner |
| APL → Haskell | Batch 24 | 官方报告列为 particularly influential forerunner |
| Standard ML → Haskell | Batch 24 | 官方报告列为 particularly influential forerunner |
| Clean → Haskell | Batch 24 | 官方报告列为 particularly influential forerunner |

### 批次 40：优先级 top20 逐条核实

| 关系 | 批次 | 结论 |
| --- | --- | --- |
| Python → Civet | Batch 40 | Civet 官方 Design Philosophy 灵感列表含 Python |
| Python → Cobrust | Batch 40 | README 自述采用 Python 人体工学取向 |
| Rust → Cobrust | Batch 40 | README 自述采用 Rust 语义取向 |
| Python → Flare | Batch 40 | Flare 官方项目概述的设计灵感列表含 Python |
| C++ → Flare | Batch 40 | Flare 官方项目概述的设计灵感列表含 C++ |
| C++ → HLA | Batch 40 | 作者称语法“very similar to … C/C++”，标准库“modeled after … C, C++” |
| Python → Please | Batch 40 | README 称构建语言可“resembles python” |
| C → Tick C | Batch 40 | MIT PDOS 页称“`C is an extension of ANSI C” |

### 批次 41：优先级 top20 逐条核实

| 关系 | 批次 | 结论 |
| --- | --- | --- |
| Go → Jule | Batch 41 | 官方手册自述 heavily influenced by Go |
| Rust → Alumina | Batch 41 | 官方文档自述 heavily inspired by Rust |
| Rust → Cairo | Batch 41 | 官方站点定位为 The Rust-inspired language |
| Java → Flare | Batch 41 | 官方项目概述把 Java 列为灵感语言 |
| C# → Nemerle | Batch 41 | 官方 About 页列 Influenced by: C# |
| Python → Shrubbery | Batch 41 | 官方设计说明称缩进语法 informed by Python |
| C → SDLang | Batch 41 | 官方称语法 inspired by the C family of languages |
| C++ → SDLang | Batch 41 | 同上，C 系包含 C++ |
| Java → SDLang | Batch 41 | 同上，C 系包含 Java |
| Ruby → Civet | Batch 41 | Civet 官方 Design Philosophy 灵感列表含 Ruby |
| Perl → Civet | Batch 41 | Civet 官方 Design Philosophy 灵感列表含 Perl |
| Ada → HLA | Batch 41 | HLA 作者列举的语法借鉴语言包含 Ada |
| Swift → Mojo | Batch 41 | 官方愿景称 draws on lessons from … Swift |
| Lua → Buzz | Batch 41 | 官方教程称 Fiber inspired by Lua coroutines |

### 批次 42：优先级 top20 逐条核实

| 关系 | 批次 | 结论 |
| --- | --- | --- |
| C# → SDLang | Batch 42 | 官方称语法 inspired by the C family of languages，C 系含 C# |
| Perl → Flare | Batch 42 | 官方项目概述把 Perl 列为灵感语言 |
| MATLAB → Simit | Batch 42 | 官方语言页称 supports the MATLAB syntax for declaring matrix literals |
| Objective-C → cooC | Batch 42 | cooC 论文摘要称 cooC is a superset of Objective-C |
| Relational Model → SQL | Batch 42 | IBM Redbook 称 SQL 访问语法基于 Codd 关系模型 |
| Ada → Spark | Batch 42 | SPARK LRM 称 SPARK is based on Ada |
| Haskell → Civet | Batch 42 | Civet 官方 Design Philosophy 灵感列表含 Haskell |
| Prolog → CLPR | Batch 42 | SWI-Prolog 文档称普通 Prolog 为 CLP 的特例 |

## 当前范围内不补线

| 项目 | 批次 | 原因 |
| --- | --- | --- |
| 泛称 Assembly | Batch 15 | 不是单一历史语言；需先确定具体方言和设计事件 |
| XSLT | Batch 33 | W3C 1997 XSL 提案明确称 XSL 基于 DSSSL；因馆藏无 DSSSL 端点而受阻，不造 ID |
| Python → Mojo | Batch 16 | 当前官方材料只支持兼容/互操作说明 |
| TypeScript → AssemblyScript | Batch 17 | 官方只说明 TypeScript-like 与相似性，未取得设计来源声明 |
| ALGOL 60 → Modula | Batch 17 | Wirth 家族连续性不足以证明直接设计边，本批未取得具体输入声明 |
| ALGOL 60 → Oberon | Batch 17 | 未把中间 Modula 历史折算成直接边，本批未取得直接输入声明 |
| SQL → SEQUEL 2 | Batch 17 | IBM 论文身份可定位，但本批未取得稳定可读且直接支持该端点的原文 |
| C/C++ → C# | Batch 35 | 官方规范只说明熟悉 C/C++ 的可移植性，没有明确设计来源 |
| Python → Chapel | Batch 40 | 官方概述列出的主要影响不含 Python |
| Python → Morloc | Batch 40 | 只讲跨语言互操作，未声明 Python 为设计来源 |
| Python → Speedie | Batch 40 | 只比较表达力并注明一处借用语法，非整体设计来源 |
| C++ → Jule | Batch 40 | C/C++ 仅作为一等互操作目标与编译目标 |
| C++ → Speedie | Batch 40 | 只比较性能并注明 C 库集成，非设计来源 |
| C++ → wa | Batch 40 | 只讲面向 WebAssembly 的设计目标，未声明 C++ 设计来源 |
| Rust → Jule | Batch 40 | “similar to Rust”为相似性比较，非声明的设计来源 |
| Rust → MLscript | Batch 40 | 未声明 Rust 为设计来源 |
| C → Jule | Batch 40 | 同 C++ → Jule，仅互操作 |
| C → Mojo | Batch 40 | 官方材料列举 Swift/C++/Rust/Zig，未列 C |
| C → Speedie | Batch 40 | 仅注明 C 库集成与性能比较，非整体设计来源 |
| C → Wa | Batch 41 | 只讲面向 WebAssembly 的设计目标，未声明 C 设计来源 |
| Go → Wa | Batch 41 | 只讲面向 WebAssembly 的设计目标，未声明 Go 设计来源 |
| JavaScript → Amber | Batch 41 | 只讲编译到 Bash，未声明 JavaScript 设计来源 |
| JavaScript → Speedie | Batch 41 | 仅作反面比较，非设计来源 |
| Python → Particles | Batch 41 | 极简索引页，未声明任何设计来源 |
| C++ → Particles | Batch 41 | 极简索引页，未声明任何设计来源 |
| C# → Particles | Batch 41 | 极简索引页，未声明任何设计来源 |
| Python → Scroll | Batch 41 | 面向科学写作，未列设计来源 |
| JavaScript → Scroll | Batch 41 | 面向科学写作，未列设计来源 |
| Ada → Chapel | Batch 41 | 官方概述 primary influence 列表不含 Ada |
| SQL → Lil | Batch 41 | 只把 SQL 作为查询语法相似，列 APL/J/K/Q 为向量影响 |
| Lua → Lil | Batch 41 | 未把 Lua 列为影响 |
| SQL → TQL | Batch 41 | 只与 SQL 对照，未声明 SQL 设计影响 |
| Lua → Speedie | Batch 41 | 未把 Lua 列为设计影响 |

| R → Particles | Batch 42 | 极简索引页，未声明任何设计来源 |
| SQL → Particles | Batch 42 | 极简索引页，未声明任何设计来源 |
| Fortran → Particles | Batch 42 | 极简索引页，未声明任何设计来源 |
| Fortran → BALGOL | Batch 42 | 说明为 Algol-58 方言，编译器取向由 FORTRAN 转向 Algol-58 |
| Fortran → EXPLOR | Batch 42 | 标题即 A FORTRAN-Coded Version，FORTRAN 为实现语言 |
| OCaml → MLscript | Batch 42 | 只说某论文用 OCaml 语法解析器，非整体设计来源 |
| Visual Basic → Speedie | Batch 42 | 未把 Visual Basic 列为设计来源 |
| SQL → SQUARE | Batch 42 | SQUARE(1973) 早于 SEQUEL/SQL，记录方向与史实相反 |
| Prolog → Gaea | Batch 42 | 作者论文只称 logic programming / Prolog-like，未声明超集 |
| Prolog → Progol | Batch 42 | 只称允许 Prolog 程序作背景知识，未声明语言超集 |

## 来源受阻

| 项目 | 批次 | 阻塞 |
| --- | --- | --- |
| JavaScript → Objective-J | Batch 16 | Objective-J/Cappuccino 官方入口本批无法稳定回溯 |
| C++ → Real-Time Concurrent C (supersetOf) | Batch 40 | 作者论文称 “parallel superset of C (and of C++)”，但出版商屏蔽/限流，未取得可哈希一手副本 |
| Java → Deesel (supersetOf) | Batch 41 | Deesel 官方站失效，nearly a superset of Java 只见百科二手描述，未取得可哈希一手原文 |
| PHP → Slash | Batch 41 | slash-lang.org 域名过期或停用，未取得可哈希一手来源 |
| Ruby → Slash | Batch 42 | slash-lang.org 域名过期或停用，未取得可哈希一手来源 |
| Perl → Slash | Batch 42 | 同 Ruby → Slash，共用同一失效端点 |

不要把“当前不补线”理解为历史上不存在关系；也不要把 `blocked` 当成否定结论。新的固定版本、作者材料或官方历史记录出现后，再按台账条件重开。
