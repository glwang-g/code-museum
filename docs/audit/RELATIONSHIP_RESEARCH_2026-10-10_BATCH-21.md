# 批次21：TypeScript/Civet 与 Java/Pizza（2026-10-10）

核读 Civet 官方 Comparison to JavaScript/TypeScript：兼容目标是99%，存在有意差异；单参数箭头函数需括号、函数隐式返回等改变语法或行为。纠正原快照 TypeScript→Civet 的 supersetOf 为 influencedBy（replacesType 保留原分类），限定为语法基础与兼容取舍，不宣称严格超集。来源 https://civet.dev/comparison，完整响应 SHA-256 e18ffb230d928be1b609125bd5651804b13b3f1bd9b419fbc956383e1b7b70f8；读取时间与短摘录、定位存入既有 Civet 审查。

核读作者 Philip Wadler 的 GJ, Pizza, and Java 页面中 Pizza into Java（POPL 1997）摘要；明确严格超集，增加参数多态、高阶函数及代数数据类型，并翻译为 Java、编译到 JVM。既有 Java→Pizza supersetOf 补证，限定1997年文献描述，不认证现代 Java 兼容或历史编译器实跑。来源 https://homepages.inf.ed.ac.uk/wadler/topics/gj.html，完整响应 SHA-256 3490b79ef55ae53459d3307788d8c843ff169520ee10aee8855d32e45fa720f8。Pizza 新审查身份仍 unreviewed，仅关系证据。

428条关系保持，110条有摘录、318条字段待核；93条审查208份来源，地图233、语法实现60、历史一手11、常显缺口3、年代警告5不变。原始快照不修改，不新增运行时。

已有5条关系的引用响应与已读响应哈希不同，本轮保持两个实际记录，增加结构化 evidenceVersion、来源定位和可展开版本差异说明。没有凭哈希差异撤销历史关系，也没有把不同版本的哈希改写成一致。抓取仅用于核读，离线构建依赖仓库内固定记录。
