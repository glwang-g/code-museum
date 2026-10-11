# 关系研究批次 22：Common Lisp 的直接上游

日期：2026-10-11

核读 Guy L. Steele Jr.《Common Lisp the Language》第 2 版第 1 章，固定 HTML 页面：

- URL：`https://www.cs.cmu.edu/Groups/AI/html/cltl/clm/node5.html`
- 完整响应 SHA-256：`d3265cc9788d2cdf996b6ef1773671f28d074f4c5cc381c1c6cbc6612e8420c2`
- 原文：“Common Lisp is a new dialect of Lisp, a successor to MacLisp, influenced strongly by Zetalisp and to some extent by Scheme and Interlisp.”

录入四条关系：

1. `lisp → common-lisp`，`influencedBy`：Common Lisp 是 Lisp 的新方言；不声称对所有早期 Lisp 方言超集。
2. `maclisp → common-lisp`，`successorOf`：作者明确称 Common Lisp 是 MacLisp 的后继；不把多方标准化简化成单线版本。
3. `scheme → common-lisp`，`influencedBy`：明确写“to some extent”，限定为局部设计输入。
4. `interlisp → common-lisp`，`influencedBy`：同样是有限度的影响。

Zetalisp 在原文中写明受到强烈影响，但当前固定 PLDB 快照没有对应馆藏端点；本批不造 ID、不建外挂节点，保留为后续馆藏/关系待办。

本批只改变关系证据和地图可见设计层，不增加运行时，不修改原始 PLDB 快照。
