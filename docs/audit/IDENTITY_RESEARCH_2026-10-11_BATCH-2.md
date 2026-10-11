# 身份别名批次 2

日期：2026-10-11

本批继续只处理有明确语义边界的 GitHub Linguist 别名，不修改 PLDB 原始快照。

| 记录 | 排除别名 | 核读结论 | 来源与读取哈希 |
| --- | --- | --- | --- |
| Starlark (`starlark`) | `bazel` | Bazel 官方说明 BUILD 文件使用 Starlark 求值；Bazel 是构建工具，Starlark 是配置/规则语言。工具名不能作为语言等价别名。 | `https://bazel.build/concepts/build-files`；SHA-256 `cd88482bc19b9445d534533fa6a2e423cdbe1ae622fbcd27aa9944d6677a4635` |
| PHP (`php`) | `inc` | PHP 官方说明 include 是 PHP 语言构造，用于包含和求值文件；`inc` 是文件名/包含约定，不足以把独立 INC 记录合并到 PHP。 | `https://www.php.net/manual/en/function.include.php`；SHA-256 `193e42a011ae4b1f8418a65d452f9ac9329923dabdfdf890f1595208b12075fc` |

当前身份问题仍为 124 行：80 行同名、35 行未处理的别名等于其他记录名、8 行已明确处理的误别名、1 行校订名称重叠。INC 自身身份与 TS/TypeScript 等含糊碰撞继续保留待核。
