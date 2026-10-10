# 关系证据续核批次 19（2026-10-10）

按本轮 Top 5 第 2/4 项核查 λ 演算 → Lisp 与 LLVM IR → MLIR。两条都是快照已有关系，本批补证并限定范围；不新增运行时或改变年代、地图资格。

## λ 演算 → Lisp：记法与函数表示

核读 McCarthy 1960 原论文作者站 HTML 的 [Functions and Forms](https://www-formal.stanford.edu/jmc/recursive/node2.html)：函数与形式的区分及函数表示明确引用 Church 的 λ 记法。完整 HTTP 响应字节 SHA-256 为 `c87b0751784f123cf94f6152f9c6bdabe136b1c5a6e3408ba684aca4486abb64`。数学图片 alt 中的记法在保存短摘录时规范化为 λ。

同时核读作者回顾 [LISP prehistory](https://www-formal.stanford.edu/jmc/history/lisp/node2.html) 条目 c：为把函数作为参数而采用 Church 记法，但未尝试实现 Church 更一般的函数定义机制，并区分条件表达式与高阶泛函。完整响应字节 SHA-256 为 `5d4fc93d94ae023b0a33832f9fe8c70e60216637bfe7e6df2ec963f8e6253d10`。

关系保持 `influencedBy`，只支持理论记法与函数表示的设计输入，不证明 Lisp 实现完整 λ 演算、β 归约语义或源码兼容。两份来源加入已有 Lisp 历史一手审查；不改变其原有身份结论，不把理论上游当成可运行的祖先语言。λ 演算当前无地图资格，本条由档案追溯。

## LLVM IR → MLIR：底层 IR 与操作设计

核读官方 Gitiles 的 [MLIR Rationale 固定修订](https://llvm.googlesource.com/llvm-project/mlir/+/577ef051fb56335dc453ff368802ed832c05766a/docs/Rationale.md)，修订为 `577ef051fb56335dc453ff368802ed832c05766a`。完整 HTML 响应字节 SHA-256 为 `c4aaf822ba1056c809a8ab8afa81014451a8901b70e9a2fc1068ac91f3e9ef8c`，不是 Markdown 文件哈希。

- Introduction and Motivation 明确说明底层构造借鉴 LLVM 与 Swift 的 IR，结合多面体抽象表示循环与张量。
- Integer signedness semantics 与 Splitting floating point vs integer operations 给出旧 standard dialect 的整数符号语义与浮点/整数操作拆分和 LLVM 设计的联系。
- Block Arguments vs PHI nodes 明确保留差异；不能把 MLIR block arguments 归为 LLVM PHI 的直接继承。

关系保持 `influencedBy`，限定为固定修订明确记录的底层设计输入。旧 standard dialect 描述不代表全部现行 dialect；也不证明兼容超集。同属 LLVM 项目或可降级到 LLVM dialect 不是本条依据。新增 MLIR 审查仅保存关系证据，身份仍 `unreviewed`，没有独立语法、实现或运行核验；既有地图线提升为附有论证与出处。

## 数据与核验

428 条关系保持：421 条设计/历史，7 条生态；106 条匹配摘录、322 条字段待核。91 条审查、204 份已读来源；地图 233 节点、语法实现已核 60、历史一手 11、常显设计层缺口 3、年代警告 5 均保持。研究台账现有 22 条闭环、1 条未解决项；未解决项保留。

`npm run audit`、`npm run relations:audit`、缺口报告重生成、`npm test`（54/54）及离线构建通过。

实际隔离 Chrome 的 16 个定向场景通过：两条关系 × 1440/390 尺寸 × 明暗主题 × 时间长河/关系谱系。检查鼠标打开依据、两端档案往返、摘录/固定 URL/哈希、证据分层、LLVM IR→MLIR 地图线和 λ 演算→Lisp 仅档案记录的边界。代表性宽窄屏截图已实际查看；报告输入与构建文件哈希核对一致。报告见 `data/audit/relationship-batch19-browser-checks.json`。

没有重跑完整浏览器回归、全量地图遍历或生产执行；没有提交、推送或部署。抓取页面只用于核读，构建依赖仓库内的摘录、哈希与数据，不依赖临时文件或在线下载。
