# Dart 语言证据记录

本条目整理现有人工审查中的 Dart 语言与实现来源，作为一个独立的语言证据入口。它不新增 Dart 的历史关系，也不把编译目标当作语言继承证据。

## 已核来源

- 语法入口：[Introduction to Dart](https://dart.dev/language)，HTTP 200，读取时间 `2026-09-24T07:33:09.393458+00:00`，完整响应解码文本 SHA-256：`8f61ad1dd960027a8adc1180d59de451c2cef5aa1c0bc464a722060437cc04ee`。审查记录标题为 `Introduction to Dart`，用于说明官方语言文档入口与语言结构范围。
- 实现入口：[dart run](https://dart.dev/tools/dart-run)，HTTP 200，读取时间 `2026-09-24T07:33:09.594568+00:00`，完整响应解码文本 SHA-256：`4100f834b7496e8028cee523a8b888d40c88689936505c0ed62ed3781ccca08b`。用于说明 Dart SDK 的命令行运行入口；不等于馆内已接入 Dart 实际运行时。
- 编译目标说明：[Dart overview](https://dart.dev/overview)，HTTP 200，读取时间 `2026-10-04T00:42:39.048227+00:00`，完整响应解码文本 SHA-256：`03276dcc442ced519827e1d1ee331ded919ebdaa5055efb33f376530985a79d0`。来源说明 Dart 可面向 JavaScript 或 WebAssembly 编译；这只记录编译目标，不推出 JavaScript→Dart 设计关系。
- 规范源码：[Dart Programming Language Specification](https://raw.githubusercontent.com/dart-lang/language/main/specification/dartLangSpec.tex)，HTTP 200，读取时间 `2026-10-08T01:53:53.464961+00:00`，完整 UTF-8 LaTeX 响应 SHA-256：`01726188b9069ccd1458ffe480f6eab6aa26beb6500355d7a35ed0310dc0531e`。核读 Introduction 及相关名称出现位置，未发现明确的设计影响论证；这是滚动源码，不冒充固定版本标准。

## 边界

当前馆藏将 Dart 标记为已具备语法与实现来源的语言证据，但网页没有 Dart 执行入口。Dart 的 JavaScript/WebAssembly 编译目标属于实现范围说明，不自动成为历史关系。若要新增关系，仍需设计者或规范中的明确输入声明。

上述来源、读取时间、状态和摘录已保存在 `data/audit/reviews.json` 的 `dart` 记录中；本文件是面向审查者的导航，不替代原始审查数据。
