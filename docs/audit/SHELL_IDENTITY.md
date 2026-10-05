# Unix shell 馆藏身份与年代待核

## 当前处理

固定馆藏同时保留 `sh` 与 `bourne-shell`。主图 `sh` 展示校订为 Bourne shell (sh)，1979 年明确标为 Unix V7 发布事件；原始 sh/1971 与 bourne-shell/1977 均未改写。不能因两条名称重叠就画成继承，也未将两条 ID 静默合并。自动身份审计将这组列为 `corrected-name-overlap`。

## 2026-10-04 读取 HOPL 单条记录

HOPL 是目录与研究线索。此次仅阅读馆藏引用的两个公开条目，未复制全站语言名册，也不以其目录关系替代设计史一手论证。

### HOPL 568 / sh:001

- URL：https://hopl.info/showlanguage.prx?exp=568
- 读取时间：2026-10-04T12:32:16.550938+00:00
- HTTP：200
- 完整 HTML 响应 SHA-256：`28507b4cac5c02fe3787926aa7f5506b790de76c3ad303975b16ac457244d65e`

页面列出 sh，说明 Command language for UNIX / Shellish，作者 Steve Bourne，同时标记 Designed 1971、Published 1971。参考文献却明确列 Bourne 的1978年 Bell System Technical Journal 57(6)，页1971–1990，以及1978年 An Introduction to the UNIX Shell。这些标记内部存在年代疑点；不能断言1971来自哪次设计，或仅凭书目页码推定其错误原因。

### HOPL 3931 / bou002

- URL：https://hopl.info/showlanguage.prx?exp=3931
- 读取时间：2026-10-04T12:32:16.110407+00:00
- HTTP：200
- 完整 HTML 响应 SHA-256：`fa64289bb36dc332773f1d1033f4abe287c5ad7e971f710719f4bcac6366fe49`

页面列出 Bourne shell，说明由 Steven Bourne 编写，标记 Designed 1978，与固定 PLDB 的1977不同。资源说明指出它出现在 Unix Seventh Edition。目录关系中有 csh→Bourne 的 Evolution of 和 Bourne→bash 的 Derivation of，未在此次取得独立论证，不能自动补入。

## 结论和下一步

两个 HOPL 条目都指向 Bourne/Unix shell 语境，存在名称与年份重叠。当前证据支持身份疑点，尚不足以证明两个目录编号各自覆盖的全部范围。应补读 Bourne 1978年论文与原始手册，分别标明早期 Unix shell、Bourne 的设计/首次实现/发表及 V7 发布；随后再决定目录去重或明确范围。原始记录仍须可查。

主图的 Bourne→Bash 关系使用 GNU Bash 5.3 官方手册的明确设计输入说明，Bourne→PowerShell 使用 Snover 作者设计宣言；没有采用这里未论证的 HOPL csh→Bourne 关系。Bash 手册比较附录采用 SVR4.2 作传统 Bourne 参照，不能说每个比较细节都是 Unix V7 的语义。

## 原论文核读补证（2026-10-04）

[The UNIX Shell 原论文](https://www.tuhs.org/Archive/Documentation/Papers/BSTJ/bstj57-6-1971.pdf) 的PDF第1页明确印刷 July–August 1978，署名 S. R. Bourne，稿件收于1978年1月30日；底部1971是页码。第2页续引言明确部分设计来自原始Unix shell及PWB/Unix shell；Cambridge和CTSS则表述为相似。第19页列出运算符和保留字，第20页列出 Thompson、Mashey 的参考文献。

完整PDF响应 SHA-256：`8f4dc793431e2188c507c0dc4e6c3379d1b17250c4eadf0553b3ad86c75d967f`，读取时间2026-10-04T12:42:20.918497+00:00，HTTP200，四个相关页已渲染并视觉核读。这个核验确认论文身份、出版事件与页码，仍不能证明 HOPL 的1971日期错误原因，或两个目录编号的全部范围。原论文和两个 HOPL 页面已进入 sh 的人工审查来源，因此现计入审查已读来源数量。

馆藏目前没有明确的 Thompson shell/PWB shell 独立端点，暂不把这些输入连接到含糊的 sh、操作系统或假造记录；也不将 ALGOL68/PL/I 调用类比与 Multics 名称起源写成已证设计继承。
