# 地图常显标签的选择依据

地图节点由语言证据筛选决定，常显文字只决定阅读密度。固定选择输入见 [label-selection.json](../../data/audit/label-selection.json)；更换榜单时须人工核对名称、方言、地图身份和来源，不在构建时联网下载。

当前 230 个地图节点中，50 个常显名称：39 个来自 [TIOBE Index 2026 年 9 月官方前 50 名](https://www.tiobe.com/tiobe-index/)且已纳入本地图，10 个为有来源的历史叙事节点，另有 Groovy 用于阅读已核的 Java → Groovy 关系。其余 180 个是可点击的点。TIOBE 排名不证明编程语言身份，也不决定是否保留在馆藏。

TIOBE 前 50 名中的 11 个目前未映射为地图标签：Delphi/Object Pascal、Scratch、SAS、Caml、GML、ABAP、Transact-SQL、X++、LabVIEW、Ladder Logic、(Visual) FoxPro。`null` 表示本轮未建立已入图的准确对应，不等于它不是语言。尤其 Caml 与 OCaml、VBScript 与 Visual Basic、FoxPro 与 Visual Basic 都不能直接当作同一个地图节点。TIOBE 将当前 “Visual Basic” 解释为 VB.NET，本项目对应 `visual-basic.net`；“Classic Visual Basic” 对应 `visual-basic`。

## 历史参照的口径

TIOBE 同页的 **Very Long Term History** 给出部分语言在 1986、1991、1996 等年份的 12 个月平均名次。它可以回答“当时哪些被该指标捕捉到的语言较受关注”：例如表中 Ada 在 1986 年为第 2，Lisp 为第 3，合并口径的 `(Visual) Basic` 为第 5。TIOBE 说明 2001 年以前的数据按 Usenet 讨论量回溯计算。因此这些名次是特定代理指标，不是当年使用人数、市场份额或跨历史时期统一的流行度。`(Visual) Basic` 的合并口径也不能归为单独 BASIC 方言。

该长期表只覆盖选定语言；Simula、BCPL、B 等没有可比排名，不能因为缺席就判断它们不重要。为使谱系可读，另外选了 ALGOL 60、APL、BASIC、B、BCPL、Simula、Smalltalk、Scheme、Forth、SNOBOL 十个节点。每个选择的理由与来源写在固定输入中。它们代表可回溯的历史叙事位置，**不是历史热度前十名**。Lisp 已出现在 TIOBE 当前前 50 名，也有 1986 年历史名次，因此无需重复计入历史锚点。

跨年代历史热度尚没有覆盖本馆全部语言、口径一致、可核查的单一榜单。以后若加入其他指标，应分别记录时间范围、统计单位、语言/方言合并方式与原始出处，再逐条关联地图 ID；不能把搜索次数、讨论次数、代码仓库文件数和实际使用人数混成一个“热度”。

2026-10-03 已核 VBScript 的微软语法与宿主资料，地图身份对应准确，因此将已有 2026 年 9 月榜单第 37 名映射为 `vbscript` 常显标签；此次未修改排名或更新榜单月份。VBA 未在该前 50 名中，仍显示为点。

2026-10-04 核实 ALGOL 60 的正式语法和 GNU MARST 2.8 实现后，以 `algol-60` 接替 `algol` 家族总称作为历史锚点；不把 ALGOL 60 的既有关系转接至家族条目。家族条目仍保留在地图及全馆，显示为点；具体 ALGOL 60 显示名称。标签总数仍为50 个，榜单月份及39 个榜单映射未变。
