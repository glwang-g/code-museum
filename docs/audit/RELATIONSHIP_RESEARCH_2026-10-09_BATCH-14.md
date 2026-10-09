# 关系证据续核批次 14（2026-10-09）

本批研究 XSLT 与 Dart。结论是 Dart 补入一条有明确边界的设计影响；XSLT 继续待核。

## Dart

固定的 Dart 官方语言规范提交 `675b500505b9ffeb80fbb507f1911e393e400cd9` 在 rationale 中明确说明：字符串表示考虑浏览器与 JavaScript 兼容，异常子句语法设计为向上兼容既有 JavaScript 程序。由此补入 **JavaScript → Dart**，关系类型为 `influencedBy`，范围限于浏览器兼容和语法取舍，不表示 Dart 是 JavaScript 的后继、超集或转译产物。

完整响应 SHA-256：`01726188b9069ccd1458ffe480f6eab6aa26beb6500355d7a35ed0310dc0531e`。原文记录在 `data/audit/reviews.json`，关系解释在 `data/relationship-overrides.json`。

## XSLT

W3C XSLT 1.0 Recommendation（1999）明确 XSLT 的转换语言目标，并在参考文献中列出 CSS2 与 DSSSL；但该规范没有把这些条目表述为 XSLT 的设计影响，也没有足以支持一条具体历史继承边的作者/工作组论证。因此本批不新增 XSLT 关系，避免把参考文献或共同的 stylesheet 领域误标成设计继承。

剩余设计层缺口为 Assembly、XSLT、Zig。Dart 的 JavaScript 兼容性已单独记录，不能再把“编译到 JavaScript”作为一般继承证据。
