# 关系研究批次 41：优先级 top20 逐条核实

日期：2026-10-11

依据 [relationship-research-priorities.json](../../data/audit/relationship-research-priorities.json) 排出的 top20（分数 105–115）逐条核实。本批 14 条既有字段待核关系取得合格原文、升级为已存摘录（关系边总数不变，仅证据等级变化），14 条收口为无可 qualifying 原文，2 条受阻。所有来源均为可哈希的已读响应，SHA-256 记录在审查记录中。

## 一、已核实并补入摘录（14 条）

| 关系 | 来源 | 结论 |
| --- | --- | --- |
| Go → Jule | `manual.jule.dev/the-mission.html` | 官方手册自述“heavily influenced by Go” |
| Rust → Alumina | `docs.alumina-lang.net` | 官方文档自述“heavily inspired by Rust, but…” |
| Rust → Cairo | `cairo-lang.org` | 官方站点定位为“The Rust-inspired language” |
| Java → Flare | Flare prog-overview（Wayback `id_`） | 官方设计说明把 Java 列为灵感语言 |
| C# → Nemerle | Nemerle About（Wayback `id_`） | 官方 About 页列“Influenced by: C#” |
| Python → Shrubbery | `docs.racket-lang.org/shrubbery/Design_Considerations.html` | 官方设计说明称缩进语法“informed by Python” |
| C → SDLang | `sdlang.org` | 官方称语法“inspired by the C family of languages” |
| C++ → SDLang | `sdlang.org` | 同上，C 系包含 C++ |
| Java → SDLang | `sdlang.org` | 同上，C 系包含 Java |
| Ruby → Civet | `civet.dev/philosophy` | 官方 Design Philosophy 灵感列表含 Ruby |
| Perl → Civet | `civet.dev/philosophy` | 官方 Design Philosophy 灵感列表含 Perl |
| Ada → HLA | HLA Reference Manual | 作者列举的语法借鉴语言包含 Ada |
| Swift → Mojo | `mojolang.org/docs/vision/` | 官方愿景称“draws on lessons from…Swift” |
| Lua → Buzz | `buzz-lang.dev/main/guide/fibers.html` | 官方教程称 Fiber“inspired by Lua coroutines” |

以上十四条只记录作者列举/自述的**整体设计取向或语法借鉴定性**；不推断源码兼容、运行时、ABI、工具链或生态继承。Flare 与 HLA 来源复用批次 40 已审来源的同一字节版本。

## 二、收口为无可 qualifying 原文（14 条）

| 关系 | 已读来源 | 为何不补线 |
| --- | --- | --- |
| C → Wa | wa-lang README | 只讲面向 WebAssembly 的设计目标，未声明 C 设计来源 |
| Go → Wa | wa-lang README | 同上，未声明 Go 设计来源 |
| JavaScript → Amber | Amber README/docs | 只讲编译到 Bash，未声明 JavaScript 设计来源 |
| JavaScript → Speedie | Speedie README | 仅作反面比较（“Doesn't infantilise you like Javascript…”），非设计来源 |
| Python → Particles | Particles 项目页 | 极简索引页，未声明任何设计来源 |
| C++ → Particles | Particles 项目页 | 同上 |
| C# → Particles | Particles 项目页 | 同上 |
| Python → Scroll | Scroll 站点 | 面向科学写作，未列设计来源；PLDB 列表混入相关记号/技术 |
| JavaScript → Scroll | Scroll 站点 | 同上 |
| Ada → Chapel | Chapel 官方概述论文 | primary influence 列表（C/Modula/Fortran/C++/Java/C#/CLU/Scala/ML/Perl/Matlab）不含 Ada |
| SQL → Lil | Lil 文档 | 只把 SQL 作为“查询语法相似”，列 APL/J/K/Q 为向量影响 |
| Lua → Lil | Lil 文档 | 未把 Lua 列为影响 |
| SQL → TQL | TQL 站点 | 只与 SQL 对照（纯文本 vs 二进制），未声明 SQL 设计影响 |
| Lua → Speedie | Speedie 文档 | 未把 Lua 列为设计影响 |

每条在台账中都带 `reopenWhen`：只有当对应官方材料明确把该语言列为整体设计来源（而非互操作/相似性/比较）时才重开。

## 三、受阻（2 条）

| 关系 | 阻塞 |
| --- | --- |
| Java → Deesel (supersetOf) | Deesel 官方站已失效，Wayback 快照只剩域名待售页，“nearly a superset of Java”只见于百科二手描述，未取得可哈希一手原文 |
| PHP → Slash | `slash-lang.org` 域名过期或停用，归档页只显示域名通告，未取得可哈希一手来源 |

`reopenWhen`：取得明确陈述 Deesel/G 与 Java 超集关系、或 Slash 项目官方文档/论文的可哈希一手副本。

## 四、来源与哈希

| 来源 | SHA-256 |
| --- | --- |
| `manual.jule.dev/the-mission.html` | `50899e34bbd9bdfbea498efc790be0ee74ce884905ef7150825a0c72aebad5b5` |
| `docs.alumina-lang.net`（首页） | `bc9fef2ffb9bc51b7fb3b0d29f9c19154d421307d4b1b480862384a57892bbbb` |
| `cairo-lang.org`（首页） | `16fa6ab7086d00bc97dde815a62cbe874c76d074487db3214a769e4e915c055e` |
| Flare prog-overview（Wayback `id_`，解码后哈希） | `d4b27d4bf5fa98c832414df0c0fa62a120d2da6983bf5fc05505f2691ab19a19` |
| Nemerle About（Wayback `id_`，解码后哈希） | `c86b545290fb1c4919d9456d4c7ce5f642407a0b16e6da24bbfe655dd6430bce` |
| Shrubbery Design Considerations | `680a1be2d7c2a2a9bdacc9640829cf39d4df6978d98f176d1e345b8a8f65c813` |
| `sdlang.org`（首页） | `019a1fd61be699e14055f7ea059bf1c445e956ef3dd70521eac780a95e247ae3` |
| `civet.dev/philosophy` | `418f1458baef50eb18e4046606fce81de92f8b8551dd9b2db2f5a4e745e411fb` |
| HLA Reference Manual（plantation-productions.com 单页 HTML） | `6033ff9690068de510e942907b9266a29eb8c53888740d9099ad20ed137ff884` |
| `mojolang.org/docs/vision/` | `fca76b7c1b6d321a96e6257e7597b7ccf26feafb02d7c03b447c7b5262f782e9` |
| `buzz-lang.dev/main/guide/fibers.html` | `1dfe99937e32b6bd334dfa5fb184634dee948fe53ebe5875cb8c44dbd4dea2ff` |

Flare 与 Nemerle 官方站已不可稳定回溯，故以 Wayback `id_`（返回原样归档字节、稳定可复现）作为可哈希来源；其余为可直接访问的一手页面。

## 五、批次后计数

- 关系总数 461（与批次 40 相同）：已存摘录 170（+14）、字段待核 288（−14）、仅有引用 3；设计 451、实现与生态 10。
- 研究台账 115 条（verified 74 / closed 34 / blocked 7）。
- 研究候选由 283 条降为 253 条；排除项 35 条（closed 31 / blocked 4）。
- 人工审查 117 条；已读来源 241 条（来源条目 243）。
