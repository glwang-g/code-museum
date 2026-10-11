# 关系研究批次 38：Chapel 的主要语言设计影响

日期：2026-10-11

核读 Chapel 官方论文《Brief Overview of Chapel》：

- URL：`https://chapel-lang.org/papers/BriefOverviewChapel.pdf`
- 完整 PDF 响应 SHA-256：`036a9c522596fda0e9adba155358e3f7b16446558c4de234cf7cf150636e404e`
- 原文：“Chapel’s primary influences include C, Modula, Fortran, C++, Java, C#, CLU, Scala, ML, Perl, Matlab.”

据此记录五条 `influencedBy` 设计关系：`C → Chapel`、`C++ → Chapel`、`Fortran → Chapel`、`Java → Chapel`、`Matlab → Chapel`。其中 C++ 原在 Batch 16 因缺少直接原文而不补线；本次以 Chapel 官方论文的直接表述重开并核实。

这五条都只表示论文作者列出的语言设计影响，不表示 Chapel 与这些语言具有 ABI/API、运行时、源码兼容、后继或超集关系。
