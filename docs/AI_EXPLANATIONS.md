# 按需代码讲解

已随 `61c2a11` 正式部署，[Actions 42756298917](https://github.com/glwang-g/code-museum/actions/runs/42756298917)成功。113项默认回归、公开Git离线构建、正式模型讲解Chrome12项和原有讲解Chrome17项通过；部署与回退证据见 [发布记录](../data/audit/ai-explanations-deployment.json)。

实验台支持馆内固定讲解和当前代码的模型讲解。点击“讲解当前代码”才向同源 `POST /api/explanations` 提交语言标识和编辑器里的完整代码；打开页面、输入、导入、恢复草稿、切换语言或显示/隐藏讲解均不调用模型。标准输入、运行结果和其他草稿不随讲解请求发送。讲解不执行代码，真实运行仍使用原有运行环境。

模型固定为 `deepseek-flash`，显式设置 `thinking.type=disabled`、`stream=false`、`max_tokens=2400` 和 JSON 输出；不用工具、不自动重试模型请求。返回的目的、标准输入用途及1至8段行号讲解经后端和前端校验，使用纯文本显示。行号必须落在本次完整源码范围内。模型可能解释错误，不能冒充真实调试轨迹。

## 请求、缓存和限额

- 每次最多24KiB UTF-8源码、400行，HTTP正文最多32KiB；超限明确提示，不截断代码。提供方响应最多64KiB，模型请求超时30秒。
- 当前页面最多保留16份讲解；相同语言和完全相同代码直接复用，不发送新请求。修改后可再次点击；上一请求完成前按钮禁用。编辑期间完成的旧讲解只进入它对应代码的缓存，不覆盖新代码，恢复到相同代码时可复用。
- 后端缓存最多64份、有效1小时，键包含模型、提示版本、语言和完整代码的摘要；相同在途请求合并，最多2次模型并发。源码不写入数据库或访问日志，缓存仅在内存中；服务重启会清空缓存。
- 默认每天最多100次新模型尝试、每来源地址每天最多20次。SQLite原子记账，重启保留限额；失败请求也计数，因为无法保证提供方没有消耗。缓存命中、合并等待和未被接纳的请求不额外计数。按UTC日重置；Nginx另有每地址每分钟6次入口限流。第6个执行会话的原有规则继续独立工作。
- 数据库仅保留当日计数及使用服务器密钥、日期和来源地址计算的HMAC，不保存原始地址、代码、标准输入、输出或密钥。完整代码在点击后发送给DeepSeek处理；提供方的数据处理边界以其服务条款为准。

## 本机预览

复制 `deploy/deepseek.env.example` 到项目根目录 `.env.deepseek.local`，填好 `DEEPSEEK_API_KEY`，设置文件权限0600。该路径由Git忽略；不要将真实密钥写进示例文件。接口默认 `https://api.deepseek.com`，模型 `deepseek-flash`。

```sh
npm run build
npm run lab:ai-preview
```

默认打开 `http://127.0.0.1:4173/#lab`，只有Python后端读取密钥。退出预览会停止该后端；本机计数位于被忽略的 `tmp/deepseek/usage.sqlite3`。普通 `npm run preview` 不加载密钥，未接后端时明确显示讲解服务未接入。网页构建离线完成，不需要模型或在线下载。

## 部署和回退

独立服务 `code-museum-explanation.service` 运行于 xshow 的回环4185，用户 `code-museum-explanation` 无Docker组或系统特权。代码固定安装在 `/opt/code-museum-explanation/`，私有环境在 `/etc/code-museum-explanation/private.env`（root:root0600，由systemd读取）；计数在 `/var/lib/code-museum-explanation/usage.sqlite3`。普通静态发布仅附带后端源码供审核，不安装或自动升级该受保护服务，不影响双节点执行器。

首次安装使用 `deploy/install-explanation.py`：准备仅包含后端源码、systemd单元和两个Nginx片段的审查包，以逐文件SHA-256清单固定，清单摘要及当前Nginx主站摘要作为显式前提；通过SSH标准输入传入私有环境，不将其放在上传包、命令参数或临时文件中。安装器拒绝覆盖已有安装或已改变的网站配置，先备份主站到root0700的 `/var/backups/code-museum-explanation/<UTC>/`，仅在现有留言片段之后增加模型片段引用，通过 `nginx -t`、独立服务健康检查后reload Nginx。失败时停止新服务、恢复主站并移除本次新增配置；计数状态和服务账户保留供排查。

审核包路径须包含 `server/explanations.py`、`deploy/code-museum-explanation.service`、`deploy/nginx-explanation.conf`、`deploy/nginx-explanation-rate.conf`；`manifest.json` 是路径到SHA-256的JSON映射。安装命令为：

```sh
sudo python3 install-explanation.py --bundle /path/to/reviewed-bundle \
  --manifest-sha256 <reviewed-manifest-hash> --site-sha256 <reviewed-site-hash>
```

私有环境经标准输入提供，不能直接粘贴在shell命令中。回退时先恢复上个静态release，再 `systemctl disable --now code-museum-explanation.service`；将审查备份中的 `nginx-site` 恢复至 `/etc/nginx/sites-enabled/code-museum`，移除新增Nginx片段并执行 `nginx -t`、reload。保留私有环境和计数库，不删除双节点网关、worker或隧道配置。后续升级需要另行审查新源码及替换操作；首次安装器不会覆盖现有服务。

## 验收

`npm test` 包含无需外网/密钥的模型适配器、并发合并、持久限额、行号、同源HTTP和前端状态回归。`npm run lab:ai-browser` 使用本机配置和真实Chrome，**会为固定公开测试代码请求真实模型**；`-- --production` 验收正式HTTPS入口。两者均验证打开/编辑不请求、显式点击、重复点击、改写期间的晚到结果、页面缓存、刷新后的服务端缓存、真实JavaScript输出及1440/900/680/390明暗布局。报告不记录密钥、用户草稿或模型原始响应；截图留在忽略的 `tmp/ai-explanations/`。

接口依据：[DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)、[JSON输出](https://api-docs.deepseek.com/guides/json_mode/)。
