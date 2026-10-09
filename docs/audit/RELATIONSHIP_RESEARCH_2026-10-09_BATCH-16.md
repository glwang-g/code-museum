# 关系证据续核批次 16（2026-10-09）

本批从高展示价值、已有明确关系字段的候选中核查 Python/Cython、C2/C3、Python/Mojo、C++/Chapel 和 JavaScript/Objective-J。最终补入两条有官方原文支持的关系，后三条继续待核。

## 补入的关系

### Python → Cython

Cython 官方 About 页面（`https://cython.org/`，2026-10-09，完整响应 SHA-256：`6e268e8d41870a17f3cced3093de02dcbd324cec1dd9949eb76f8510518d0aac`）明确称 Cython 是 Python 的超集，并具体说明增加调用 C/C++ 函数、声明 C/C++ 类型的能力。

关系保留为 `supersetOf`，范围仅限语言层扩展；不表示任意 Python 程序、宿主 API 或第三方包都能无修改通过。

### C2 → C3

C3 官方编译器仓库 README（固定 raw URL，2026-10-09，完整响应 SHA-256：`4424ba16217513218bc1c4ffdcd4c144a1e9cfbfb48a21c1cc3cee9b14603f88`）明确写道 C3 的灵感来自 C2，目标是在不另造一门完全不同语言的情况下迭代 C2。

由此补入 `C2 → C3` `influencedBy`。这不把 C ABI 兼容、C 风格语法或“演进 C”的产品定位另算成 `C → C3` 设计继承。

## 保留待核的候选

- **Python → Mojo**：Mojo 官方页面说明 Python 互操作、逐步扩展 Python 代码和兼容 Python 特性，但本批未找到把这些兼容/互操作说明表述为明确设计继承的原文；不升级 `influencedBy` 或 `supersetOf`。
- **C++ → Chapel**：Chapel 官方 README/语言页面确认其面向大规模并行计算，但本批未取得 C++ 是具体设计来源的明确表述；不因共同的系统语言定位补线。
- **JavaScript → Objective-J**：现有来源字段把 Objective-J 记为 JavaScript 的超集，但其官方入口本批无法稳定取得可回溯的一手原文；不以 Wikipedia 摘要替代官方证据。

本批只升级两条关系；其余候选继续显示为待核。完整输入和摘录见 `data/relationship-overrides.json` 与 `data/audit/reviews.json`。
