# 身份别名批次 6：产品、格式与基础语言的名称冲突

日期：2026-10-11

本批处理五个“别名恰好是另一条记录名称”的冲突；均保留独立身份，不把产品、格式或相关系统合并为语言别名：

- Apache HTTP Server 官方文档说明服务器由文本配置文件和 directives 配置；`ApacheConf` 是独立配置语法记录。
  - URL：`https://httpd.apache.org/docs/current/en/getting-started.html`
  - SHA-256：`aee3eb01b0ee79c2f4c431a811ad7b5e0c6c691c4d1d7f4dd3a5481aaa274426`
- GNU Emacs Lisp 手册明确区分 Emacs 文本编辑器与 Emacs Lisp 编程语言。
  - URL：`https://www.gnu.org/software/emacs/manual/html_node/elisp/Introduction.html`
  - SHA-256：`448a50dc60941c680bcc7245e5ecb1d1ee3f60cadef72b123edde91cb4552b0f`
- RFC 7946 将 GeoJSON 定义为基于 JSON 的地理空间数据交换格式。
  - URL：`https://www.rfc-editor.org/rfc/rfc7946.html`
  - SHA-256：`14a199832db53142aca3a64394418ca4a14951dbd188d253424cc53d3c3a733f`
- LaTeX Project 的官方文档分别指向 LaTeX 与 TeX 及相关资料；本批只做身份消歧，不在此推断具体实现关系。
  - URL：`https://www.latex-project.org/help/documentation/`
  - SHA-256：`6b42102760bfd8fafa11ebc9d5f57d16a72838145472f0c6cafa6798d5ea0406`
- NixOS 手册定义 NixOS 为基于 Nix 包管理系统的 Linux 发行版。
  - URL：`https://nixos.org/manual/nixos/stable/`
  - SHA-256：`aacdf5ec7d2f7b425ec736aa74bbdfa53c81b8fee62d4fd5e3bf560212788aea`

从等价搜索别名中分别排除：`apacheconf`、`emacs-lisp`、`json`、`tex`、`nix`。这只阻止误合并；其间真实的配置、实现、格式或家族关系仍需按独立证据另行研究。
