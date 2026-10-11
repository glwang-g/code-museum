# 身份别名批次 1

日期：2026-10-11

本批只处理会与常显语言发生名称碰撞的 GitHub Linguist 别名，不修改 PLDB 原始快照，不把实现、方言或代际差异升级为关系线。

| 记录 | 排除别名 | 核读结论 | 来源与读取哈希 |
| --- | --- | --- | --- |
| Perl (`perl`) | `cperl` | 同一快照存在独立 `cperl` 记录；cperl 页面把它描述为带类、类型和编译器的 perl5 变体。可研究实现/派生关系，但不能作为 Perl 的等价名称。 | `https://perl11.github.io/cperl/`；SHA-256 `7ed8cbe116bbc1ccc81bb6f86bf96102662c401eb04b2f53b0bc25ebd549898b` |
| Ruby (`ruby`) | `jruby` | JRuby 官方说明它是运行在 JVM 上的 Ruby 实现。实现身份应走实现/生态表述，不把 JRuby 的 GitHub 名称解析成 Ruby 本身。 | `https://www.jruby.org/`；SHA-256 `e1272983a03559176afbc7a1782977f3c61c4592ea27922d796d5cd8f4f6f07b` |
| Common Lisp (`common-lisp`) | `lisp` | Common Lisp the Language 说明 Common Lisp 是具体的 Lisp 标准与实现平台；馆藏另有独立 Lisp 历史记录。家族节点与标准语言不得按别名合并。 | `https://www.cs.cmu.edu/Groups/AI/html/cltl/clm/node2.html`；SHA-256 `dbbeef0933d99166494b530c81211e5ab66ffcd60ab7acf753665577ca0c07e2` |
| Visual Basic .NET (`visual-basic.net`) | `visual basic` | Microsoft 将 Visual Basic 6.0 旧文档与 Visual Basic .NET 文档分开维护；馆藏同时有 legacy Visual Basic 与 VB.NET 记录。泛称不能直接解析为 .NET。 | `https://learn.microsoft.com/en-us/previous-versions/visualstudio/visual-basic-6/visual-basic-6.0-documentation`；SHA-256 `bae669d57e24e84a52385852ecf924bfa09cca90c839d3352ec7db5eabe5b06e` |

`INC`/PHP 与 `TS`/TypeScript 仍保留为待核：当前独立记录来源不足，不能仅凭名称重合判断它们是独立语言还是缩写/文件类型。它们没有在本批被自动合并。

审计规则同步调整：人工声明的误别名不再与原始 `alias-equals-other-name` 重复计数，而是各保留一条带理由的 `curated-false-alias`。当前身份问题仍为 124 行，其中 6 行是已明确处理的误别名，118 行仍待核。
