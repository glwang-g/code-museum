# 关系证据续核批次 17（2026-10-10）

本批继续处理全量扫描后选出的 8 条高展示价值候选。目标是逐条寻找官方页面、作者材料、规范或固定历史论文；没有达到直接证据标准的项目保留待核或收口，不把语法相似、家族连续性和来源字段当作关系证明。

## 补入的关系

### APL → BQN

BQN 官方首页（`https://mlochbaum.github.io/BQN/`，2026-10-09 抓取，完整响应 SHA-256：`9a9c6123a187d840693a4777a8311e37f84da68ff43796cabf895bf519f80c09`）说明 BQN 旨在去除 APL 传统中不规则和负担较重的部分，同时保留 APL/ APL\\360 的核心思想。

补入 `influencedBy`，限定为 APL 传统与数组编程思想的设计输入，不表示 BQN 是 APL 的源码兼容超集。

### JavaScript → JSON

JSON 官方介绍页（`https://www.json.org/json-en.html`，2026-10-09 抓取，完整响应 SHA-256：`7cd9c0dbe49b4ea39c06f67c9899aab876e78f03871c2939fb0071b5db897253`）明确写道 JSON 基于 JavaScript Programming Language Standard 的一个子集。

补入 `influencedBy`，限定为数据表示语法/设计的直接取材，不表示 JSON 可执行 JavaScript 或共享 JavaScript 运行时。

### C → C3

C3 官方编译器仓库 README（固定 raw URL，2026-10-09 抓取，完整响应 SHA-256：`4424ba16217513218bc1c4ffdcd4c144a1e9cfbfb48a21c1cc3cee9b14603f88`）称 C3 是“evolution, not a revolution”，保留熟悉的 C 语法与语义并进行现代化，目标清单也写明“Evolve C”。

补入 `influencedBy`，限定为 C 对 C3 的设计输入，不宣称严格超集、源码兼容或仅因 C ABI 兼容而建立关系。该来源同时支持此前已补的 C2 → C3，但两个端点分别保留。

## 本批核过但不补线

- **TypeScript → AssemblyScript**：AssemblyScript 官方首页称其为 “A TypeScript-like language for WebAssembly”，并称与 TypeScript 的相似性降低学习成本。这证明定位和相似性，不足以证明 TypeScript 是具体设计来源。
- **ALGOL 60 → ALGOL W**：确认了 ALGOL W 的历史端点，但本批没有取得稳定、可直接引用的 ALGOL W/ALGOL-X 一手设计说明；不以 Wikipedia 摘要替代。
- **ALGOL 60 → Modula**：Wirth 家族连续性和后续语言关系不能自动折算为 ALGOL 60 的直接设计边；本批未取得具体输入声明。
- **ALGOL 60 → Oberon**：官方 Oberon 规范可说明 Oberon 自身，但不能单独证明 ALGOL 60 是直接设计来源；不把中间 Modula 历史压成一条直边。
- **SQL → SEQUEL 2**：已确认 IBM SEQUEL 2 论文身份，但本批未取得稳定可读、且直接支持 SQL 端点的原始论文副本；不把 PLDB 字段升级为证据。

本批共新增 3 条有原文摘录的关系，5 条按台账收口为“本批无合格来源”。完整来源、摘要与响应哈希见 `data/audit/reviews.json`；关系字段与限定结论见 `data/relationship-overrides.json` 和研究台账。
