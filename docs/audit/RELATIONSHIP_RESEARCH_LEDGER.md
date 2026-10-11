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

## 当前范围内不补线

| 项目 | 批次 | 原因 |
| --- | --- | --- |
| 泛称 Assembly | Batch 15 | 不是单一历史语言；需先确定具体方言和设计事件 |
| XSLT | Batch 14 | 参考文献不等于设计影响声明 |
| Python → Mojo | Batch 16 | 当前官方材料只支持兼容/互操作说明 |
| C++ → Chapel | Batch 16 | 未取得 C++ 作为具体设计来源的官方原文 |
| TypeScript → AssemblyScript | Batch 17 | 官方只说明 TypeScript-like 与相似性，未取得设计来源声明 |
| ALGOL 60 → Modula | Batch 17 | Wirth 家族连续性不足以证明直接设计边，本批未取得具体输入声明 |
| ALGOL 60 → Oberon | Batch 17 | 未把中间 Modula 历史折算成直接边，本批未取得直接输入声明 |
| SQL → SEQUEL 2 | Batch 17 | IBM 论文身份可定位，但本批未取得稳定可读且直接支持该端点的原文 |

## 来源受阻

| 项目 | 批次 | 阻塞 |
| --- | --- | --- |
| JavaScript → Objective-J | Batch 16 | Objective-J/Cappuccino 官方入口本批无法稳定回溯 |

不要把“当前不补线”理解为历史上不存在关系；也不要把 `blocked` 当成否定结论。新的固定版本、作者材料或官方历史记录出现后，再按台账条件重开。
