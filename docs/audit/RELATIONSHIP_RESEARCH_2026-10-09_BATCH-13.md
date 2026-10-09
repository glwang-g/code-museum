# 关系证据续核批次 13（2026-10-09）

本批只处理当前常显标签中 JavaScript 的两条待核关系。核读 Brendan Eich 的作者回顾文章，并保存完整 HTTP 响应 SHA-256；没有使用语法相似性、同一运行平台或语言名称作为关系依据。

## 新增范围受限的关系

| 关系 | 处理 | 支持边界 |
| --- | --- | --- |
| Java → JavaScript | Brendan Eich 明确回顾 Netscape 管理层要求新语言必须“look like Java”，并说明 Java 作为脚本语言伙伴的定位及部分 Java 影响 | 只表示语法外观与平台定位上的设计参照，不表示后继、超集或实现兼容 |
| Scheme → JavaScript | Eich 明确写出选择“Scheme-ish first-class functions”作为 JavaScript 的主要组成部分之一 | 只表示一等函数设计影响，不表示 JavaScript 是 Scheme 方言或整体继承 Scheme |

来源：<https://brendaneich.com/2008/04/popularity/>，读取时间 `2026-10-09T14:51:12+00:00`，完整响应 SHA-256 为 `d12b80a087f711e80a9479fd641d9bd8c1cae40db7fe4a7dfd6082903ff9de23`。原文摘录、来源字段与关系解释分别保存在 `data/audit/reviews.json` 和 `data/relationship-overrides.json`。

本批不处理 Assembly、Dart、XSLT、Zig 的设计层缺口；这些缺口仍待找到合格来源，不因编译目标、ABI 或工具链关系自动补线。
