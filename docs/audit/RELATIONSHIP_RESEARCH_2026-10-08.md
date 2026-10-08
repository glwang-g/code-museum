# 2026-10-08 常显语言关系研究

## 范围

盘点全部50个常显标签的既有上下游、地图外关系、生态层与证据缺口；自动检查全量426条规范化关系。逐项结果见 [关系状态](RELATIONSHIP_STATUS.md)。盘点不等于重新阅读每条引用，也不声称找到全部历史关系。已有关系中50条保存了匹配引用的已阅读摘录，39条仍缺摘录，336条仅字段记录；另1条直接设计依据待补。

## 本次直接阅读

- Scala 设计者 Martin Odersky 等《An Overview of the Scala Programming Language》Second Edition, LAMP-REPORT-2006-001，PDF第1页引言。明确采纳Java与C#的大量语法和类型系统，且明确不是Java超集。该页用PDFKit提取并渲染视觉核读；Java→Scala改用此依据，新增C#→Scala。
- Rust Reference《Influences》。复核既有C++、OCaml、Haskell、Erlang、Scheme、C#、Ruby七条影响并保存原文摘录；新增Swift的optional bindings输入。清单包含语言演进及已移除元素，不是首版特性清单。Swift→Rust触发馆藏初始年份警告，警告保留并注明事件区别。
- Microsoft C#规范Introduction。当前设计目标明确强调C/C++程序员迁移；未从该页获得Java设计输入的直接论证。旧引用中的读者熟悉度即使存在，也不能独立证明设计影响。Java→C#仍保留但明确待补证，不自动称为后继。
- Dart官方LaTeX规范源码。核读Introduction与相关名称出现位置，未发现明确的设计影响论证；JavaScript编译细节不作为JavaScript→Dart设计关系依据。该源码为滚动版本，不冒充固定发布标准。

四份成功读取的URL、读取时间、标题、摘录和完整响应SHA-256加入 [语言审查记录](../../data/audit/reviews.json)。源码构建只依赖此受版本管理的输入，不依赖临时下载。Scala旧Java教程URL本次TLS握手超时，未计作已阅读证据。

## 仍需研究

汇编总称须区分具体指令集和方言；Dart需设计者原文；XSLT的DSSSL文献引用不能单独确立设计影响；Zig已有C ABI生态关系，设计层仍需独立论证。其余语言的字段关系和只有引用的关系也保持待核。没有缺线的语言不等于关系全部核实。

人工复核决定在 [decisions](../../data/audit/relationship-decisions.json)，自动生成报告绑定原始快照、审查、人工关系、标签清单及决定的哈希。SHA-256用于标识读取版本，不能替代史实判断。
