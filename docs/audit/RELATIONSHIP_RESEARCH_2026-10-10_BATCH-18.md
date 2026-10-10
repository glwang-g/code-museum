# 关系证据续核批次 18（2026-10-10）

按本轮 Top 5 的第 1/3 项核查 Self → JavaScript 与 Haskell → Curry。两条边已存在于固定快照，本批为它们补入限定论证与匹配原文；不新增推测关系，不改变语言起源年代，不接入新运行时。

## Self → JavaScript：原型对象设计输入

来源为 JavaScript 设计者 Brendan Eich 的作者文章 [Popularity](https://brendaneich.com/2008/04/popularity/)（2008-04-03）。正文关于主要设计材料的段落明确说明选择了 Self 式原型，并注明单一原型的限定。

2026-10-10 实际重新获取 HTTP 200，完整响应字节 SHA-256 为 `d12b80a087f711e80a9479fd641d9bd8c1cae40db7fe4a7dfd6082903ff9de23`，与 JavaScript 审查记录中 2026-10-09 保存的来源相同。因此复用已有摘录、读取时间和哈希，没有把重复读取算作新增来源。

关系保持 `influencedBy`，限定为原型对象机制的设计输入。它不证明 JavaScript 采用 Self 全部对象语义、是其严格后继/超集或与 Self 源码兼容。本批不单独升级 Self 的语法、实现或地图资格；这条关系在档案中可读，尚无地图内连线。

## Haskell → Curry：字段标签与单子式 I/O

来源为 Michael Hanus 主编的 [Curry 0.9.0 报告固定版本](https://www.curry-lang.org/docs/report/versions/report_2016_01_13.pdf)，封面日期 2016-01-13。

- §5.5：印刷第 28 页（PDF 第 29 页），脚注 10 明确采用 Haskell 的字段标签描述。
- §7：印刷第 37 页（PDF 第 38 页），明确使用 Haskell 的单子式 I/O，并要求 I/O 不处于允许非确定性搜索的程序部分。

已将固定 PDF 的封面及上述两页渲染为图片并实际核读。固定版本 HTTP 200，完整 PDF 响应字节 SHA-256 为 `e449c7657c92f33bf6f1f81bfa179f5ff96cf669590209f62b00061069c99240`，实际读取时间、两段短摘录和定位信息保存于 Curry 审查记录。

同时检查了官方版本目录和教程。教程仅称语法相似，不能单独升级关系；报告的具体采用说明才是本批依据。滚动 `curry-report.pdf` 与固定版本封面/相关段落相同，但完整字节哈希不同；关系只绑定固定版本哈希。

关系保持 `influencedBy`，限定为该版本明确记录的字段标签与 I/O 设计输入，不概括成整个类型系统或求值语义承继。字段构造/导出规则及求值机制仍有差异，不能据此声明 Curry 是 Haskell 严格超集或所有程序源码兼容；KiCS2 的 Haskell 后端也不是本条设计边的理由。

新建 Curry 审查记录仅保存关系证据，身份状态仍为 `unreviewed`；不把本轮核读升级为完整语法与实现核实，不宣称实测过 Curry。Haskell 与 Curry 原有地图资格保留，其既有地图连线由字段待核提升为附有论证与出处。

## 数据结果

- 总关系仍为 428 条：421 条设计/历史、7 条生态关系。
- 匹配原文摘录 104 条，字段待核 324 条。
- 审查记录 90 条，已阅读来源 201 条；语法与实现已核语言仍为 60 条。
- 地图仍为 233 个节点；常显设计层缺口仍 3 个，年代警告仍 5 项。

完整论证、来源哈希和研究闭环记录见 `data/relationship-overrides.json`、`data/audit/reviews.json`、`data/audit/relationship-research-ledger.json`。研究缺口报告已重新生成，保留所有未解决事项。

## 核验与发布边界

`npm run audit`、`npm run relations:audit`、`npm test`（54/54）及离线构建通过。学习导览的负向测试改用受控缺证据样例，避免把现在已补证的 Self→JavaScript 固定当作未核关系；缺口报告测试的闭环数量按当前台账核对。

实际隔离 Chrome 的 16 个定向场景通过：两条关系 × 两种尺寸（1440/390）× 明暗主题 × 时间长河/关系谱系。检查鼠标打开依据和两端档案往返、原文摘录/哈希/固定 URL、证据分层、Haskell→Curry 的地图线，以及 Self→JavaScript 仅档案记录的边界。宽窄屏证据面板和地图截图已实际查看；最终输入与被服务文件 SHA 已核对一致。报告见 `data/audit/relationship-batch18-browser-checks.json`。

本轮没有重跑完整浏览器回归、全量地图遍历或生产执行；没有提交、推送或部署。原文 PDF 和页面抓取只用于本轮核读，构建仅依赖仓库内的摘录、哈希与固定数据，不依赖临时文件或在线下载。
