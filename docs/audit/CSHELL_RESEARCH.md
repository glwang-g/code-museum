# C shell 与 tcsh 的证据边界

2026-10-04 阅读 TUHS 的2BSD档案后，已将三条原始资料纳入 C shell 历史一手审查，并补录作者 William Joy；原始馆藏字段保持不变。C shell 已通过语法与历史实现证据取得主图资格。另以官方固定版本手册和项目官网核查 tcsh，两者独立保存。

## csh.u 原始手册

- URL：https://www.tuhs.org/cgi-bin/utree.pl?file=2BSD/man/csh.u
- 读取时间：2026-10-04T12:53:40.185572+00:00
- HTTP：200
- 完整 HTML 响应 SHA-256：`c0233ba44ae3ef40120e2bb9171dc2e77af18dc02cd7a83ec367cd92f6848c25`

头部 `.TH CSH UCB 2/24/79 UCB`；名称说明“a shell (command interpreter) with C-like syntax”。正文定义词法、管道、历史替换、表达式及控制语法；表达式节说明若干运算符与 C 相似且有相同优先级，并明确字符串/数值差异。1979-02-24 是此手册版本日期，不替换馆藏1978。

## William Joy 的 An introduction to the C shell

- URL：https://www.tuhs.org/cgi-bin/utree.pl?file=2BSD/doc/csh
- 读取时间：2026-10-04T12:53:40.355196+00:00
- HTTP：200
- 完整 HTML 响应 SHA-256：`66da20f0978f3ed5c554b612b1ce832fb8349ac27ce66dfd1a3c5c3824215853`

署名 William Joy、UC Berkeley，说明可执行脚本与交互命令。有 while(expression)/end 和 switch/case/breaksw/endsw 的具体语法。Abstract 将历史机制比作 INTERLISP redo；单凭相似描述暂不录入 Interlisp→C shell。感谢 Michael Ubell 的输入词结构历史机制原型及 Eric Allman 的反馈，不将贡献者背景当语言继承。

## 2BSD/src/csh/sh.c 原始实现

- URL：https://www.tuhs.org/cgi-bin/utree.pl?file=2BSD/src/csh/sh.c
- 读取时间：2026-10-04T12:56:46.936723+00:00
- HTTP：200
- 完整 HTML 响应 SHA-256：`05b386e5b1b60bd05f0870ad79dd24bd46e657647bd817d62bb1d10a494718b4`

头部标注 C Shell、Bill Joy, UC Berkeley、October 1978，另有1979版权行。main 初始化变量、解析脚本/命令参数并调用 process(setintr)。源码身份与手册相符；未编译或执行原始实现。现代 /bin/csh 可能是 tcsh，不能直接当成此二进制。

## tcsh 的独立证据与扩展关系

- 官方标签手册：https://raw.githubusercontent.com/tcsh-org/tcsh/TCSH6_21_00/tcsh.man
- 读取时间：2026-10-04T13:03:11.612120+00:00，HTTP 200。
- 完整响应 SHA-256：`6bc1b05e6da45ca0beba8fd466791ea13b5b54a23c1033da4f2d9f8779630a31`。
- 项目官网：https://www.tcsh.org/ ，读取时间2026-10-04T13:01:41.817198+00:00，HTTP 200，SHA-256 `33b65096123a0ca7f386f271445079d67ad287a16655fa29f7128abe91338f79`。

6.21.00 手册 DESCRIPTION 明确称 tcsh 为 Berkeley UNIX C shell 的兼容增强版本，说明命令行编辑、可编程补全、拼写纠正、历史机制及脚本执行。具体定义 foreach/name/(wordlist)/end。用 `(+)` 标记多数 csh 实现（特别是4.4BSD csh）没有的增强功能。官网提供发行源码与开发仓库入口。

据此录入 C shell→tcsh 的 `supersetOf` 扩展关系，限定为手册的兼容声明；尚未独立执行所有历史版本的兼容性测试。既有 C shell→Bash/Korn 的功能借鉴关系分别来自 GNU 手册和 Korn 作者论文，随 C shell 入图可见。

本机 `/bin/csh` 和 `/bin/tcsh` 指向同一文件，版本输出均为 `tcsh 6.21.00 (Astron) 2019-05-08`。已独立执行两份原创 tcsh 程序，输出55与Lisp，并拒绝未配对引号；详见 [tcsh 核验](TCSH_RUNTIME.md)。这不是1978年原始 C shell 的运行证明，也不覆盖完整历史兼容性。网页仍仅 JavaScript/Python 可运行，两个 shell 均不显示运行图标。

## 后续待核

补 tcsh 重定向、历史替换及历史 BSD 版本兼容差异。不导入未经论证的 HOPL C shell→Bourne 关系，不以 C 源码实现或 Interlisp 类比直接新增继承。

## C 的具体语法输入

William Joy 原始介绍 §3.5 Expressions 明确说明 C 算术运算及其优先级在 Shell 中可用，说明 `==`/`!=` 用于字符串比较；§3.7 Other control structures 给出以 C 为参照的 while/switch 具体形式，强调 `breaksw` 与 `break` 的区别，并说明 C 式标签。2BSD csh.u 的 Expressions 节列出运算符、优先级和字符串/数值差异。

据此补入 C→C shell 的 `influencedBy` 局部设计关系，来源仍是上述已保存响应哈希的原始介绍。这里的证据是作者说明的具体语法参照，不是解释器用C编写、名称含C或仅有泛泛相似。没有标为C的严格超集、后继或C源码兼容。
