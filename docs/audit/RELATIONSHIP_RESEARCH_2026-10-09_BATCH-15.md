# 关系证据续核批次 15（2026-10-09）

本批核查 Zig 与 Assembly 的设计层缺口。结论是两者都不新增设计关系；已有的 C/Zig 互操作继续保留在生态层。

## Zig

读取 Zig 官方 [Overview](https://ziglang.org/learn/overview/)（2026-10-09，完整 HTTP 响应 SHA-256：`1cbcc5322bc4f10e060a9545434b4e0859f7690eb794d19a1d13549411a01565`）。页面明确说明：

- `@cImport` 可导入 C 类型、变量、函数和简单宏；`export` 可导出 C ABI，供其他语言调用；这属于互操作和工具链边界。
- 页面把“Zig 是更好的 C 编译器”放在交叉编译、libc 和工具链能力的说明中；这是定位/工程能力，不是 Zig 设计者对 C 语言语法或语义继承的具体历史说明。
- 页面以 C++、D、Rust、Go 的运算符重载、异常或隐式控制流作对照，随后说明 Zig 的控制流取舍；对照本身不足以证明这些语言是 Zig 的设计来源。

因此不新增 `C → Zig` 设计关系，也不把已有 `C → Zig` `interop` 生态边升级为设计继承。当前 Zig 的设计层缺口仍保留。

## Assembly

“Assembly language” 是泛称，不是可直接当作单一历史祖先的具体方言。读取 [NASM 3.02 introduction](https://www.nasm.us/doc/nasm01.html)（2026-10-09，完整 HTTP 响应 SHA-256：`e12f0faf492b981e5ec3276ae5be297e35a848c48d23a9adea0dfcc6bacb9b02`）只确认 NASM 是面向 80x86/x86-64 的汇编器，其语法接近 Intel Software Developer Manual，并不提供“Assembly language”作为整体影响某门高级语言的设计史证据。

本批不把 NASM、Intel 指令集或机器码接口替换成泛称 Assembly 节点的历史关系端点，也不因某语言能生成汇编或调用 ABI 而补设计边。后续若继续研究，应先选择具体指令集/方言和明确的设计事件。

## 收口

本批没有新增关系输入；C/Zig 互操作、`x86-assembly` 的语法审查及泛汇编节点边界均保持原状。常显设计层缺口仍为 Assembly、XSLT、Zig；缺口不表示没有其他历史关系。
