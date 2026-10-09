# Code Museum MCP 第一版

只读 MCP，支持 stdio 和私有 HTTPS Streamable HTTP JSON，Python 3 标准库实现，没有 SDK/npm/pip 依赖。查询与网页使用同一次离线构建的馆藏、关系盘点、审查原文与运行能力清单；启动时核对四份输入的 SHA-256。它不执行代码、不下载运行时，也没有写入工具。stdio不读取令牌；HTTPS使用独立只读Bearer。

## 本机接入

先执行 `npm run build`，再启动 `npm run mcp`。MCP 客户端配置示例（把工作目录替换成自己的路径）：

```json
{
  "mcpServers": {
    "code-museum": {
      "command": "python3",
      "args": ["/Users/wangguanglei/work/code-museum/server/mcp.py", "--data", "/Users/wangguanglei/work/code-museum/dist/data"]
    }
  }
}
```

## 服务端接入

随现有站点 release 上传 `server/mcp.py` 和构建数据。通过已有 SSH 连接启动 stdio，无需新增常驻账户、开放端口或配置公开 HTTP API：

```json
{
  "mcpServers": {
    "code-museum": {
      "command": "ssh",
      "args": ["-T", "xshow", "python3", "/var/www/code-museum/current/server/mcp.py", "--data", "/var/www/code-museum/current/dist/data"]
    }
  }
}
```

SSH 使用本机既有身份；客户端连接结束时进程退出。查询能力为只读，SSH 账户本身的权限仍取决于现有服务器配置。SSH stdio 不需要HTTP凭据。一次连接加载当前 release 的固定数据，更新发布后重新连接即可读取新版本。

## 查询工具

| 工具 | 参数 | 用途 |
| --- | --- | --- |
| `search_languages` | `query`，可选 `category/offset/limit` | 全量馆藏名称、ID、别名与轻微拼写匹配；保留 C++/C# 区别 |
| `get_language` | `id` | 档案、身份审查、原文摘录、URL、读取时间、响应哈希 |
| `get_lineage` | `id`，可选 `direction/layer/depth/offset/limit` | 前序/后序，设计/生态层，最多三层，保留每条关系证据状态 |
| `get_relationship` | `key`（示例见下文） | 精确关系论证、出处、摘录及待核事项 |
| `get_execution_capabilities` | 可选 `id` | 固定运行时、版本、默认位置、下载/令牌要求、预算 |

关系 key 示例：`b|c|influencedBy`。

资源 `museum://coverage` 返回覆盖范围、关系状态数量、固定快照与输入哈希。单页最多50条；请求行最多64 KiB。支持协议协商 `2025-11-25`、`2025-06-18`、`2025-03-26`、`2024-11-05`。

运行能力只报告**配置**，明确返回 `liveAvailabilityChecked: false`；不证明服务已连通、令牌有效或浏览器已同意下载。尚未接入的语言返回空能力列表。没有审查不等于不是语言，缺关系不等于没有上游，保存摘录也不等于全部史实已核。馆藏入口仍保留全部5,155条记录。

`npm test` 核验真实 stdio 协商、五个查询工具、资源、C++/C#区别、坏参数/执行工具/路径注入拒绝、输入哈希拒绝与超长请求恢复。


## 私有 HTTPS 接入

已实现的服务路径为 `https://codemuseum.freexlib.com/mcp`；需要管理员安装新版执行服务与Nginx配置后才生效，静态Actions发布不升级后端。传输为无会话的Streamable HTTP JSON：仅POST，Accept需要允许application/json，通知成功返回空202；GET/DELETE返回405。没有SSE推送、OAuth发现/授权流程或匿名查询。支持2025-11-25、2025-06-18、2025-03-26；后续请求带协商版本的MCP-Protocol-Version。请求最多64KiB，不接受JSON-RPC批量请求。

支持手动Bearer的客户端配置示意（字段名依客户端而定，替换本机私有占位符，不提交真实凭据）：

```json
{
  "mcpServers": {
    "code-museum": {
      "url": "https://codemuseum.freexlib.com/mcp",
      "headers": { "Authorization": "Bearer <READ_ONLY_MCP_TOKEN>" }
    }
  }
}
```

只读令牌为执行密钥作为HMAC-SHA256密钥、固定用途字节`code-museum-readonly-mcp-v1`作为消息的十六进制结果（`server/mcp_http.py:readonly_token`）。管理员可在SSH终端读取root-only配置并在本机私有客户端设置中保存派生值；避免粘贴到仓库、日志或截图。无需新增服务端secret文件，轮换执行令牌也会使旧只读令牌失效。派生值不能反推出执行密钥；只读凭据不能用于执行API，执行令牌也不能直接用于MCP。只读令牌不限制某个馆藏子集，获授权持有者可以查询全馆只读数据。

HTTP与现有执行器共用进程、线程上限、账号及Docker健康启动条件，不是独立高可用查询服务。当前release链接或manifest变化时重新加载并校验四份数据；加载失败返回503，不回退旧数据。release内文件按不可变部署管理，缓存不会逐请求重读所有输入。来源范围、配置能力与史料限制仍适用上文。
