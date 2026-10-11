# 身份别名批次 7：兼容实现与 XML/HTML 派生格式

日期：2026-10-11

本批处理五个会把兼容实现或派生格式误作同一语言的别名：

- GNU Bash 手册说明 Bash 大体兼容 `sh`，但相对 `sh` 有功能改进。
  - URL：`https://www.gnu.org/software/bash/manual/bash.html`
  - SHA-256：`78d0eefbe60cfe7345ffdafede7294f055b04e53bd520360ff699b24f81e2b4b`
- RSS 2.0 规范称 RSS 是 XML 方言。
  - URL：`https://www.rssboard.org/rss-specification`
  - SHA-256：`1610f254e9312593a67f6a58e7e7978b0d10c7cd247ec6d2382d1c6fd55079c9`
- WSDL 2.0 规范称 WSDL 是描述 Web 服务的 XML 语言/格式。
  - URL：`https://www.w3.org/TR/wsdl/`
  - SHA-256：`f6379b0a686acc25e4665fa7509fd232fbbc1fc042b99a7d8f4ef6ce822d5390`
- XHTML 1.0 是 HTML 4 在 XML 1.0 上的重构，并有独立 XML 文档约束。
  - URL：`https://www.w3.org/TR/xhtml1/`
  - SHA-256：`42468bf357babdcbb440538bff0ebf05386e25eed7bc56cd6f2976df88450c6d`
- Flex 官方手册将 Flex 标为 `lex replacement`，且说明 Lex 兼容有例外。
  - URL：`https://raw.githubusercontent.com/westes/flex/master/doc/flex.texi`
  - SHA-256：`dce164daabff167ee883c8c00bbb8c567edbaca104c68d75ead25cc464bc5593`

从等价搜索别名中排除：`Bash → sh`、`XML → RSS`、`XML → WSDL`、`HTML → XHTML`、`Lex → Flex`。这些判断不否定兼容、派生或替代关系；它们只阻止把独立记录解析为同一身份。
