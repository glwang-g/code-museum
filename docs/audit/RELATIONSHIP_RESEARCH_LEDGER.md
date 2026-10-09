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

## 当前范围内不补线

| 项目 | 批次 | 原因 |
| --- | --- | --- |
| 泛称 Assembly | Batch 15 | 不是单一历史语言；需先确定具体方言和设计事件 |
| XSLT | Batch 14 | 参考文献不等于设计影响声明 |
| Zig 设计边 | Batch 15 | C ABI/工具链说明不等于 C 语言设计继承 |
| Python → Mojo | Batch 16 | 当前官方材料只支持兼容/互操作说明 |
| C++ → Chapel | Batch 16 | 未取得 C++ 作为具体设计来源的官方原文 |
| TypeScript → AssemblyScript | Batch 17 | 官方只说明 TypeScript-like 与相似性，未取得设计来源声明 |
| ALGOL 60 → ALGOL W | Batch 17 | 本批未取得稳定、可直接引用的 ALGOL W/ALGOL-X 一手设计说明 |
| ALGOL 60 → Modula | Batch 17 | Wirth 家族连续性不足以证明直接设计边，本批未取得具体输入声明 |
| ALGOL 60 → Oberon | Batch 17 | 未把中间 Modula 历史折算成直接边，本批未取得直接输入声明 |
| SQL → SEQUEL 2 | Batch 17 | IBM 论文身份可定位，但本批未取得稳定可读且直接支持该端点的原文 |

## 来源受阻

| 项目 | 批次 | 阻塞 |
| --- | --- | --- |
| JavaScript → Objective-J | Batch 16 | Objective-J/Cappuccino 官方入口本批无法稳定回溯 |

不要把“当前不补线”理解为历史上不存在关系；也不要把 `blocked` 当成否定结论。新的固定版本、作者材料或官方历史记录出现后，再按台账条件重开。
