# 关系研究批次 33：XSLT 的 DSSSL 证据与端点阻塞

日期：2026-10-11

重开 XSLT 缺口。核读 W3C 1997 年 XSL 提案：

- URL：`https://www.w3.org/TR/NOTE-XSL-970910`
- 完整响应 SHA-256：`12c7be987d6635e24f4b116aec00fc32a0d5314909f728f5e9350575f6717d20`
- 原文：“XSL is based on DSSSL. XSL is a stylesheet language designed for the Web community. It provides functionality beyond CSS.”

结论：这不是旧的“参考文献不足”，而是一项明确的作者/工作组设计来源声明。当前阻塞点是固定 PLDB 快照没有 DSSSL 端点，关系校验不能凭空新增 ID。

因此：

- 不把 XSLT 缺口继续写成 “closed-no-qualifying-source”；
- 将 `xslt|design-layer-gap` 改为 `blocked`，记录合格原文和重开条件；
- 只有在引入 DSSSL 策展记录或受支持的外部端点机制后，才录入 `dsssl → xslt`；
- 不将 CSS、XML 或 XPath 的互操作/定位关系冒充 DSSSL 设计继承。
