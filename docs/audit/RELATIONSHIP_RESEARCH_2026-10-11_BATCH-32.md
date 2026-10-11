# 关系研究批次 32：Zig 对 C 的设计对照与回应

日期：2026-10-11

此前 Zig 缺口只因 C ABI、工具链和“更好的 C”定位而被判为不足。本批重新核读 Andrew Kelley 的 2016 年作者介绍：

- URL：`https://andrewkelley.me/post/intro-to-zig.html`
- 完整响应 SHA-256：`3f657aefb1859f485b5bd3c31a7100d0fd98cd1df72e796c7629adb5ffbf11dc`
- 原文：“my goal is to create a new programming language that is more pragmatic than C.”
- 同文明确逐项讨论：runtime performance 要 equivalent to or better than C；debug/release undefined behavior 策略；用 error type 代替异常/堆栈展开；替代 libc；避免传统预处理器。

新增 `c → zig`，类型 `influencedBy`，标签“以 C 为设计对照与目标”。这是作者明确的设计回应/参照，不等于 Zig 继承 C、是 C 超集、源码兼容或把 C ABI 互操作当成语言血缘。

Zig 常显设计层缺口由此关闭；地图仍保留 C/Zig 的独立实现/生态关系。
