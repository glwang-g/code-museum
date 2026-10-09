# 2026-10-09 关系证据续核

继续优先核对常显标签的已有关系引用。本轮保存22份重新阅读的原文响应：Python FAQ/扩展接口、Go FAQ、Julia设计者文章、Ruby About、Java规范、D Overview、Groovy Java差异、Ritchie C历史、Alan Kay Smalltalk历史、PHP历史、Scheme官网、Oracle PL/SQL、VBA/VBScript/VB.NET、微软平台BASIC概述、Octave、Rust FFI、Jython、PyO3，以及F#设计者论文。URL、重定向、读取时间、标题、人工摘录与完整响应哈希保存在 `data/audit/reviews.json`。

- **新增 Modula-3 → Python**：Guido在Python官方FAQ的自述明确将异常的语法与语义归于Modula-3。这是具体设计影响，不是严格超集；Modula-3当前不满足地图筛选，关系仍可从Python档案/MCP查到。
- **BCPL → B → C**：Ritchie明确称B为C的parent、BCPL为grandparent，并描述B对BCPL的简化。B→C的ACM DOI本轮403，改引用可以实际读取的作者电子重印；Bell Labs旧URL重定向到Nokia保存页。保留设计影响类型，不推断完全源码兼容。
- **OCaml → F#**：Don Syme《The Early History of F#》，HOPL 2020，第7节、PDF第18页，明确称Caml-Light/OCaml是主要设计输入，同时明确从未完全兼容OCaml。PDFKit提取并渲染页面人工核读；记录哈希覆盖PDF原始字节。
- **各语言关系口径**：Go来自C家族的语法及Pascal/Modula/Oberon的声明/包；Julia六条既有边是设计目标参照；Ruby五条为创造者融合语言特性；C/C++与Python、Java/Jython、Rust/PyO3、Rust/C仍属于实现/生态层。
- **引用版本变化**：PL/SQL `/23/`重定向到`/26/`，PyO3首页重定向到0.29.3；均记录真实最终URL，不冒充旧版本。BASIC文章是微软平台上的二手历史概述，VB6→VB.NET的支持说明证明迁移路径，证据强度不提升为设计者原始规范。

当前427条关系（420条规范化设计/历史、7条生态），89条论证与匹配摘录已存、1条只有引用仍缺摘录、336条仅来源字段、1条直接设计依据待补；5项年代警告保留。84条语言审查记录、188条已阅读来源；已核语法/实现仍60条，不因补关系摘录增加语言核实数量。

## 留下的缺口

- **Objective-C → Swift**：当前Swift About成功返回，但已无旧论证所指命名参数段落；不把无关新正文计作支持性摘录。旧引用继续缺摘录，后续需固定历史页面或设计者论文。本轮成功响应SHA-256为`d2e2394142e53d10ff3ccf0e955a24380672d3a3c12367cb00c87cef1b85942b`，最终URL仍为`https://www.swift.org/about/`。
- **Java → C#**：继续待直接设计依据；没有因语法相似或本轮新增运行时而改成已核继承。
- **Assembly、Dart、XSLT、Zig**：常显设计层缺口仍四个；前轮研究未找到足以支持新增设计边的原文。汇编总称、编译目标、参考文献和C ABI本身仍不推出设计继承。

这次消除了原39条引用缺摘录中的38条，不是完成336条来源字段的人工史料审查，也不宣称233个地图节点或5,155条馆藏已经无遗漏。
