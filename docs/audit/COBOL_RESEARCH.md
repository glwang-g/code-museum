# COBOL 与 FLOW-MATIC 早期来源核查

2026-10-04 读取 Bitsavers 的原始扫描件并渲染核读。这两份资料已纳入人工审查：FLOW-MATIC取得历史一手语言资格，COBOL保留现代GnuCOBOL的语法实现审查并附加早期设计来源，新增FLOW-MATIC→COBOL设计资料输入关系。完整URL、响应哈希、范围和摘录保存于审查记录；临时PDF不参与构建。

## 1960 COBOL 初始规格报告

- URL：https://bitsavers.org/pdf/codasyl/COBOL_Report_Apr60.pdf
- 读取时间：2026-10-04T13:25:10.504054+00:00，HTTP 200。
- 完整PDF响应SHA-256：`3f45f870ee8de1ff177282b7ffd900fc6b154e11a9ca72e25b3c7fea63483ed6`。
- 文件6,843,924字节，140页，无可提取文本层；以渲染图像核读。

已核读PDF第3、4、5、12、13、14、18页：标题为 COBOL — Initial Specifications for a Common Business Oriented Language。前言区分1959年12月17日报告与1960年1月7–8日批准，不应把报告版本日期当作取代馆藏1959年的依据。

打印I-2页（PDF13）Attribution明确写出：Ideas and information were drawn from many sources; in particular, from FLOW-MATIC、IBM Commercial Translator 和 AIMACO。I-3页（PDF14）说明借用了1958年FLOW-MATIC Programming System及1959年IBM Commercial Translator资料；I-7页（PDF18）记录作者授权使用。它们支持特定设计资料输入，不证明严格超集或全部源码兼容，也没有在这些页中支持FACT影响。

IBM Commercial Translator需要与馆藏COMTRAN身份独立对照；AIMACO需确认准确端点，不造ID。报告没有在这里具体分配各项设计特性，后续关系文案不能擅自填成某一关键字的唯一来源。

## 1958 FLOW-MATIC 编程手册

- URL：https://bitsavers.org/pdf/univac/flow-matic/U1518_FLOW-MATIC_Programming_System_1958.pdf
- 读取时间：2026-10-04T13:25:33.113240+00:00，HTTP 200。
- 完整PDF响应SHA-256：`5e1a1c5990d882cba98b01aaf8e4b1d809acba2633e6e18d8915395c8b72c5df`。
- 文件9,367,413字节。

已核读PDF第3–6、10、36–43、92–94、101、120–121页：1958版权；Preface说明面向UNIVAC的英语式输入自动翻译成具体指令；目录列出程序书写、编译过程和操作说明。打印27–34页（PDF36–43）含完整库存处理流程图、编号与序列规则、标点/词名规则及18操作的完整文本程序；打印83–85页（PDF92–94）给出Translator、Selector、Allocator、Processor四阶段到Running Program的流程及生成机器码磁带的文字说明；打印92页（PDF101）定义COMPARE、JUMP、MOVE、READ-ITEM等操作的行为；打印112页（PDF121）定义编译器/库/源代码磁带位置及启动步骤。

这些具体语法规则和历史编译操作说明支持历史一手语言资格，1958手册版本不替换馆藏1955年。没有下载、编译或执行历史二进制；它不是现代可执行环境证明。未增加网页运行图标。

## 后续

1. 对照COMTRAN/AIMACO准确馆藏身份后，再录入分别有依据的输入关系；当前仅FLOW-MATIC关系已经落实。
2. 继续查找可合法复现的历史编译器或模拟环境，历史实现证据与实际执行结果分开记录。
3. 对照不同版本的具体功能输入，不把资料整体借鉴擅自分配为每个关键字的唯一来源。

## IBM Commercial Translator 身份线索（未纳入正式审查）

已发现并下载：https://bitsavers.org/pdf/ibm/7090/F28-8043_CommercialTranslatorGenInfMan_Ju60.pdf 。读取时间2026-10-04T13:36:22.651286+00:00，HTTP200，完整PDF响应SHA-256 `dcc2b702f76f776bdd536ed4174581dc6c067ca4e54024c2294d64d0024e45ef`，8,547,314字节、124页，扫描件没有文本层。

视觉核读PDF2–4：题名为IBM Commercial Translator General Information Manual，1960版权。第2页明确标注Major Revision (June 1960)，文号F28-8043是原F28-8013的重大修订版；F28-8013正是COBOL初始报告引用的1959文号。这个连续性支持继续核查身份与版本，但目前还需独立确认馆藏COMTRAN缩写端点，以及实际正文语法和实现范围。目录列出的语法章节不单独作为已核结论。

不可把1960修订版的每项特性倒推为1959年COBOL设计输入；关系依据应保留COBOL原始报告对早期资料的声明与确切版号。
