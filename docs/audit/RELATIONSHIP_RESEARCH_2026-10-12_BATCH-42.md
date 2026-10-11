# 关系研究批次 42：优先级 top20 逐条核实

日期：2026-10-12

依据 [relationship-research-priorities.json](../../data/audit/relationship-research-priorities.json) 排出的 top20（分数 97–115）逐条核实。本批不新增关系边：8 条既有字段待核关系取得合格原文、升级为已存摘录，10 条收口为无合格原文，2 条受阻。所有新增来源均保存完整响应字节 SHA-256 与原文摘录，未修改 PLDB 原始快照。

## 一、已核实并补入摘录（8 条）

| 关系 | 来源 | 结论 |
| --- | --- | --- |
| C# → SDLang | `sdlang.org` | 官方称语法 “inspired by the C family of languages (C/C++, C#, D, Java, …)”，C 系包含 C# |
| Perl → Flare | Flare prog-overview（Wayback `id_`） | 官方项目概述把 Perl 列为灵感语言 |
| MATLAB → Simit | `simit-lang.org/language` | 官方语言页称 “supports the MATLAB syntax for declaring matrix literals” |
| Objective-C → cooC（supersetOf） | Tenon objective-c 文献页（Wayback `id_`） | cooC 论文摘要称 “cooC is a superset of Objective-C” |
| Relational Model → SQL | IBM Redbooks `sg245511.pdf` | 称 SQL 访问语法 “based on a relational theory, … documented in The Relational Model for Database Management by E. F. Codd” |
| Ada → Spark | SPARK 2014 Reference Manual（docs.adacore.com） | 手册导言称 “SPARK is based on Ada, both subsetting the language … and also extending the system of contracts” |
| Haskell → Civet | `civet.dev/philosophy` | 官方 Design Philosophy 灵感列表含 Haskell |
| Prolog → CLPR（supersetOf） | `swi-prolog.org/pldoc` clp 章 | 称 “Plain Prolog can thus be regarded as a special case of CLP” |

以上八条只记录作者列举/自述的**整体设计取向、语法借用或形式包容**；不推断源码兼容、运行时、ABI、工具链或生态继承。Flare 与 Civet 复用批次 41 已审来源的同一字节版本；SDLang 边与批次 41 的 C/C++/Java → SDLang 边共用同一份 `sdlang.org` 首页字节。

## 二、收口为无合格原文（10 条）

| 关系 | 已读来源 | 为何不补线 |
| --- | --- | --- |
| R → Particles | Particles 项目页 | 极简索引页，未声明任何设计来源 |
| SQL → Particles | Particles 项目页 | 同上 |
| Fortran → Particles | Particles 项目页 | 同上 |
| Fortran → BALGOL | BALGOL 历史说明（Datatron blog） | 说明为 “an early dialect of the Algol-58 language”，编译器取向 “shifted from FORTRAN to Algol-58”，FORTRAN 非其设计来源 |
| Fortran → EXPLOR | MINI-EXPLOR 说明 | 标题即 “A FORTRAN-Coded Version of the EXPLOR Language”，FORTRAN 是实现语言，非设计来源 |
| OCaml → MLscript | MLscript README | 只说某论文 “used v1 with an OCaml-syntax parser”，为论文实现细节，非整体设计来源 |
| Visual Basic → Speedie | Speedie README | 未把 Visual Basic 列为设计来源 |
| SQL → SQUARE | IBM Research SQUARE 条目（1973） | SQUARE 早于 SEQUEL/SQL；所读 IBM 条目未称 SQUARE 受 SQL 影响，记录方向与史实相反 |
| Prolog → Gaea（supersetOf） | Gaea 作者 ICMAS-96 论文 | 只称 “Gaea is a logic programming language … Prolog-like backward chain reasoning”，未声明超集 |
| Prolog → Progol（supersetOf） | Progol 官方页 | 只称 “allows arbitrary Prolog programs as background knowledge”，未声明 Progol 是 Prolog 语言的超集 |

每条在台账中都带 `reopenWhen`：只有当对应官方/一手材料明确把该语言列为整体设计来源，或明确声明超集/扩展关系（而非互操作、相似性、比较或实现语言）时才重开。`SQL → SQUARE` 另注明：若一手材料支持 SQL 影响 SQUARE，或将该边更正为 SQUARE → SQL 并给出合格来源，才重开。

## 三、受阻（2 条）

| 关系 | 阻塞 |
| --- | --- |
| Ruby → Slash | `slash-lang.org` 域名过期或停用，归档页只显示域名通告，未取得可哈希一手来源 |
| Perl → Slash | 同上，与 `ruby → slash` 共用同一失效端点 |

`reopenWhen`：取得 Slash 语言项目官方站、文档或论文的可哈希一手副本。

## 四、来源与哈希

| 来源 | SHA-256 |
| --- | --- |
| `sdlang.org`（首页，复用批次 41 字节） | `019a1fd61be699e14055f7ea059bf1c445e956ef3dd70521eac780a95e247ae3` |
| Flare prog-overview（Wayback `id_`，复用批次 40/41 字节） | `d4b27d4bf5fa98c832414df0c0fa62a120d2da6983bf5fc05505f2691ab19a19` |
| `civet.dev/philosophy`（复用批次 41 字节） | `418f1458baef50eb18e4046606fce81de92f8b8551dd9b2db2f5a4e745e411fb` |
| `simit-lang.org/language` | `3b942d2d3eb75d015906160fd3bc2e98fdae9ab3483b6cda72228a5b657b0428` |
| Tenon objective-c 文献页（Wayback `id_`，解码后哈希） | `0436c517572411370ed9d83d30e7507a27791b66ce1f337c6a41bee8efd1f2e9` |
| IBM Redbooks `sg245511.pdf` | `5b81c2bff2d0e04ed08b17fc2dbdcfc33535e616ae0c63063a5a0f38cac1d78f` |
| SPARK 2014 Reference Manual（introduction.html） | `8a8d947af573ef4f2df258cdec016f01f7aa742bca20e8a7afdfba4e5c10b64c` |
| `swi-prolog.org/pldoc` clp 章 | `98cc78f512530f5bba222fc07f15025556be7a250915c56bc1aaeffc10707bf6` |
| Gaea ICMAS-96 论文（`cdn.aaai.org/ICMAS/1996/ICMAS96-030.pdf`） | `a24e47e6bfe62186dc6d352b6f9b79f687f772904aaf380b60af7c8ff3645beb` |
| BALGOL 历史说明（Datatron blog） | `f77d6ef0aa50ae0cfb1c6e6da07128477d667981f48f30aa5ed8cdb5a36b5786` |
| MINI-EXPLOR 说明 | `392d74b4365914da1caa7d9b0878132e4eca2d974f4c628e2e161d01c410cd38` |
| MLscript README（raw.githubusercontent.com） | `4fd26f7207c109a7fe0545ad69c316554749a5b421bacfe8c64f2e26ce63695c` |
| IBM Research SQUARE 条目 | `dcfccc7406d203b54af15d73aa693387e12dd5430b7a27c6bfd53c97062fec69` |
| Progol 官方页（doc.ic.ac.uk） | `25d2edddc354afc7fb0f57c3508f16484b8d24495389ee19be327325b8ee2d2b` |

Flare 与 Tenon 官方入口不可稳定回溯，故以 Wayback `id_`（返回原样归档字节、稳定可复现）作为可哈希来源；其余为可直接访问的一手页面或官方论文 PDF。收口用的 Particles/Speedie/Slash 来源沿用既有审查记录。

## 五、批次后计数

- 关系总数 461（与批次 41 相同，本批不增删边）：已存摘录 178（+8）、字段待核 280（−8）、仅有引用 3；设计 451、实现与生态 10。
- 研究台账 135 条（verified 82 / closed 44 / blocked 9）。
- 研究候选由 253 条降为 233 条；排除项 47 条（closed 41 / blocked 6）。
- 人工审查 128 条；已读来源 252 条（来源条目 254）。
- 身份总线索 126、未决 94、已明确处理 32；地图节点 233、常显设计缺口 2（Assembly/XSLT）、年代审查线索 6。
