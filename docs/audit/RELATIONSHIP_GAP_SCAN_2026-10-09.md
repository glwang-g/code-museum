# 关系待补字段全量扫描（2026-10-09）

## 扫描结论

本次扫描覆盖当前关系审计中全部 329 条 `field-only` 记录。它们不是 329 条已经被本项目确认的历史关系，而是馆藏关系字段已有值、但尚未保存本项目自己的论证或原文摘录。

| 项目 | 数量 |
| --- | ---: |
| 待补关系字段 | 329 |
| `influencedBy` | 279 |
| `supersetOf` | 50 |
| 触及 50 个常显标签 | 123 |
| 触及 233 个地图节点 | 164 |
| 带年代警告 | 4 |
| 只有“缺少关系论证” | 325 |
| 同时有年代警告 | 4 |

329 条的来源字段全部是 `github.com/breck7/pldb` 下的 PLDB 概念页。这些页面可以作为线索入口，但不能单独作为设计影响、超集或历史承继的原文证据；本扫描没有把它们升级为已核关系。

当前没有发现“已有引用但只缺摘录”的待补关系；现有审计中的 99 条 `excerpt-recorded` 已与这 329 条分开。JavaScript → Objective-J、Python → Mojo、C++ → Chapel 等已经在关系研究台账中处理过的项目，不因这次扫描重新打开。

## 分布

待补字段集中在少数上游和少数新语言目标：

| 上游 | 条数 | 主要目标 |
| --- | ---: | --- |
| Python | 12 | Chapel、Civet、Mojo、Morloc、Particles、Scroll、Speedie 等 |
| C++ | 9 | Chapel、Flare、HLA、Jule、Particles、SDLang、Speedie 等 |
| APL | 7 | BQN、Futhark、Goal、Klong、Particles、U 等 |
| C | 7 | C3、Jule、Mojo、SDLang、Speedie、Tick-C、WA |
| Haskell | 7 | Civet、Curry、Flare、MLScript、Morloc、Particles、ScrapScript |
| Lisp | 7 | AutoLISP、Axio、Cosmicos、Kamby、Nemerle、Particles、Scroll |
| Rust | 6 | Alumina、Cairo、Cobrust、Jule、MLScript、MoonBit |

按目标聚合，`Particles` 24 条、`Scroll` 16 条、`Speedie` 12 条、`Civet` 11 条、`SDLang` 与 `Flare` 各 9 条、`Chapel` 8 条、`Mojo` 7 条。它们更像来源字段的集中写入，不能因为同一目标出现多次就视为交叉印证。

## 处理优先级

1. **先处理 50 条 `supersetOf`**：超集是强主张，优先寻找语言作者、规范或官方文档中明确的“superset/subset/extends”措辞；找不到就降级为待核或关闭，不以语法相似替代证明。
2. **再处理触及常显标签的 123 条**：优先选择容易找到官方一手资料、且能改善访客理解的关系。每条单独保存 URL、读取时间、原文摘录、哈希和限定结论。
3. **对 4 条年代警告先核事件口径**：区分设计、首次实现、首次发布和具体版本；年代不能只按 PLDB 字段覆盖。
4. **其余 206 条作为低优先级字段线索**：没有一手来源时继续保留 `field-only`，不为了减少数字而补泛化说明。

## 下一批建议

下一轮不重复已收口项目，建议从以下 5～10 条开始查官方一手资料：

- APL → BQN：先查 BQN 官方历史/设计说明。
- TypeScript → AssemblyScript：先查 AssemblyScript 官方定位和版本文档，确认是语法/类型借鉴还是仅兼容工具链。
- JavaScript → JSON：查 JSON 原始规范或作者资料，限定为语法/设计参照，不扩大为继承。
- C → C3：查 C3 官方设计说明，区分设计灵感和源码兼容。
- ALGOL 60 → ALGOL W：查 Wirth 或 ALGOL W 的原始报告，先解决版本和事件口径。
- ALGOL 60 → Modula：查 Modula 原始报告或作者资料，不把 ALGOL 家族泛称当作直接端点。
- ALGOL 60 → Oberon：查 Oberon 官方报告/作者资料，单独确认具体输入。
- SQL → SEQUEL-2：先核具体版本与命名身份，再决定是否能形成历史关系。

这些只是研究候选，不是已确认关系。研究完成后应更新关系覆盖、原文摘录和研究台账，再重新运行关系审计；没有合格来源的项目继续保留待核。

机器统计仍以 [关系状态](RELATIONSHIP_STATUS.md)、[研究待办 JSON](../../data/audit/research-gap-report.json) 和 [关系研究台账](RELATIONSHIP_RESEARCH_LEDGER.md) 为准。本文件是本次扫描的分组结论，不替代逐条证据。
