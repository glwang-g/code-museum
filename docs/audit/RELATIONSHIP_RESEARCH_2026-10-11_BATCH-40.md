# 关系研究批次 40：优先级 top20 逐条核实

日期：2026-10-11

依据 [relationship-research-priorities.json](../../data/audit/relationship-research-priorities.json) 排出的 top20（分数 136–159）逐条核实。本批 8 条取得合格原文并补线，11 条收口为无可qualifying原文，1 条受阻。所有来源均为可哈希的已读响应，SHA-256 记录在审查记录中。

## 一、已核实并补线（8 条）

| 关系 | 来源 | 结论 |
| --- | --- | --- |
| Python → Civet | `https://civet.dev/philosophy` | 官方 Design Philosophy 灵感列表含 Python |
| Python → Cobrust | Cobrust README | 自述采用 Python 人体工学（缩进、推导式等） |
| Rust → Cobrust | Cobrust README | 自述采用 Rust 语义（所有权、Result、无 GIL 等） |
| Python → Flare | Flare prog-overview | 官方设计灵感列表含 Python |
| C++ → Flare | Flare prog-overview | 官方设计灵感列表含 C++ |
| C++ → HLA | HLA Reference Manual | 作者称语法“very similar to … C/C++”且标准库“modeled after … C, C++” |
| Python → Please | please README | 构建语言可“drop into an imperative language that resembles python” |
| C → Tick C (supersetOf) | MIT PDOS Tick C 页 | “`C is an extension of ANSI C” |

以上八条只记录作者列举/自述的**整体设计取向或扩展定性**；不推断源码兼容、运行时、ABI、工具链或生态继承。

## 二、收口为无可qualifying原文（11 条）

| 关系 | 已读来源 | 为何不补线 |
| --- | --- | --- |
| Python → Chapel | Chapel 官方概述论文 | 论文列出的主要影响（C/Modula/Fortran/C++/Java/C#/CLU/Scala/ML/Perl/Matlab）不含 Python |
| Python → Morloc | Morloc README/docs | 只讲跨语言互操作，未声明 Python 为设计来源 |
| Python → Speedie | Speedie 文档 | 只与 Python 比较表达力并注明一处借用语法，非整体设计来源 |
| C++ → Jule | Jule mission | C/C++ 仅作为一等互操作目标与编译目标，非整体设计来源 |
| C++ → Speedie | Speedie 文档 | 只与惯用 C++ 比较性能并注明 C 库集成，非设计来源 |
| C++ → wa | wa-lang README | 只讲面向 WebAssembly 的设计目标，未声明 C++ 设计来源 |
| Rust → Jule | Jule mission | “immutable-by-default model, similar to Rust”是相似性比较；Jule 自述非函数式 |
| Rust → MLscript | MLscript README | 以类型推断/可靠性/模式匹配定位，未声明 Rust 设计来源 |
| C → Jule | Jule mission | 同 C++ → Jule，仅互操作 |
| C → Mojo | Modular 官方材料 | 列举 Swift/C++/Rust/Zig 等经验，未列 C 为设计影响 |
| C → Speedie | Speedie 文档 | 仅注明 C 库集成与性能比较，非整体设计来源 |

每条在台账中都带 `reopenWhen`：只有当对应官方材料明确把该语言列为整体设计来源（而非互操作/相似性/比较）时才重开。

## 三、受阻（1 条）

| 关系 | 阻塞 |
| --- | --- |
| C++ → Real-Time Concurrent C (supersetOf) | 作者论文摘要/正文明确称 “Concurrent C (C++) is a parallel superset of C (C++)”，但 Springer/citeseerx/Semantic Scholar 的一手全文均被出版商屏蔽或限流，未能取得可哈希副本存入审查记录；不计为否定结论 |

`reopenWhen`：取得明确陈述 Real-Time Concurrent C 与 C++ 超集关系的一手可哈希副本（论文 PDF 或摘要页）。

## 四、来源与哈希

| 来源 | SHA-256 |
| --- | --- |
| `civet.dev/philosophy` | `418f1458baef50eb18e4046606fce81de92f8b8551dd9b2db2f5a4e745e411fb` |
| Cobrust README（raw.githubusercontent.com，main 分支） | `61f33661f0b5250e9355294b5841336735b9034a808abf9626ed2feec2b35fb9` |
| Flare prog-overview（Wayback `id_` 原样快照，解码后哈希） | `d4b27d4bf5fa98c832414df0c0fa62a120d2da6983bf5fc05505f2691ab19a19` |
| HLA Reference Manual（plantation-productions.com 单页 HTML） | `6033ff9690068de510e942907b9266a29eb8c53888740d9099ad20ed137ff884` |
| please README（raw.githubusercontent.com，master 分支） | `0a9016272334a30824fbcfb099b1fceb39ad315f87b78271e9af5858d9c3bc9b` |
| MIT PDOS Tick C 页（index.html） | `77e9cb902a11dc193417796c5fff38c163678d5df8a925ce245838736ed2a9f3` |

Flare 官方站现被 Cloudflare 拦截，故以 Wayback `id_`（返回原样归档字节、稳定可复现）作为可哈希来源；其余为可直接访问的一手页面。

## 五、批次后计数

- 关系总数 461：已存摘录 156、字段待核 302、仅有引用 3；设计 451、实现与生态 10。
- 研究台账 85 条（verified 60 / closed 20 / blocked 5）。
- 研究候选由 303 条降为 283 条；排除项 19 条（closed 17 / blocked 2）。
