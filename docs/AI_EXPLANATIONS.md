# 按需代码检查、讲解与纠错

检查与纠错已随 `b6fe3f6` 正式部署，[Actions 42830035894](https://github.com/glwang-g/code-museum/actions/runs/42830035894)成功。115项默认回归、离线构建、本机及正式模型Chrome各15项和原有讲解Chrome17项通过；部署与回退见 [发布记录](../data/audit/ai-code-review-deployment.json)。原按需讲解首次发布证据保存在 [历史记录](../data/audit/ai-explanations-deployment.json)。

实验台保留馆内固定讲解；点击“检查并讲解当前代码”才向同源 `POST /api/explanations` 提交语言标识、编辑器里的完整代码及可选的“预期行为”。打开页面、编辑代码或预期、导入、恢复草稿、切换语言及显示/隐藏讲解均不调用模型。标准输入、运行结果和其他草稿不随请求发送。模型服务不执行代码，真实运行仍使用原有运行环境。

模型固定为 `deepseek-flash`，显式设置 `thinking.type=disabled`、`stream=false`、`max_tokens=3200` 和 JSON 输出；不用工具、不自动重试请求。一次调用返回三类判断之一：`ok`仅表示未发现明显问题，展示1至8段原代码讲解；`issues`展示错误位置、原因及改进建议；`uncertain`说明还需确认的预期或上下文，不擅自补全业务规则。馆内固定讲解明确标为尚未进行模型检查。

检查结果同时反馈到编辑区和检查头部：`ok`为淡绿色，`issues`为浅红色，暗色主题使用对应低亮度底色；`uncertain`保持中性并显示需要确认的文字。颜色来自原有返回，不增加模型调用，不按错误数量猜测严重程度。修改代码、语言或预期后，旧颜色立即清除；检查中、请求失败和未经模型检查的馆内示例不会显示成功/问题色。相同输入复用缓存时恢复对应颜色，晚到的旧返回不能给新稿上色。绿色仍只表示模型未发现明显问题。颜色反馈已随 `942904f` 发布，本机与正式Chrome各18项通过，见 [发布记录](../data/audit/review-feedback-deployment.json)。

纠错以保持原意、输入输出、分支和边界行为为原则。用户可补充预期行为，留空时模型推断原意并显示其理解；没有足够证据确认业务意图时，不能声称修正保持了需求。模型只给最多6个不重叠的原始行替换块，每块最多4KiB、总计8KiB；后端按原代码拼接候选，仅替换这些行，前端再次核对候选与替换块完全一致。所有问题都能给出明确修改时，才显示“建议修正版（未运行）”；可复制后对照修改，编辑器不会自动被覆盖或执行。部分问题无法可靠修改、或判断为不确定时，只给原因和建议。检查结果不保证代码正确，模型建议仍须人工核对并实际运行验证。

## 请求、缓存和限额

- 每次最多24KiB UTF-8源码、400行，HTTP正文最多32KiB；超限明确提示，不截断代码。提供方响应最多64KiB，模型请求超时30秒。
- 当前页面最多保留16份检查；相同语言、代码和预期行为直接复用，不发送新请求。修改代码或预期后可再次点击；上一请求完成前按钮禁用。编辑期间完成的旧结果只进入它对应输入的缓存，不覆盖新代码或新预期。预期行为按语言保留在页面内存中。
- 后端缓存最多64份、有效1小时，键包含模型、提示版本、语言、完整代码及预期行为的摘要；新检查使用 `museum-review-v2` 提示版本，旧讲解不会误作检查通过。相同在途请求合并，最多2次模型并发。源码和预期不写入数据库或访问日志，缓存及建议仅在内存中；服务重启会清空缓存。
- 默认每天最多100次新模型尝试、每来源地址每天最多20次。SQLite原子记账，重启保留限额；失败请求也计数，因为无法保证提供方没有消耗。缓存命中、合并等待和未被接纳的请求不额外计数。按UTC日重置；Nginx另有每地址每分钟6次入口限流。第6个执行会话的原有规则继续独立工作。
- 数据库仅保留当日计数及使用服务器密钥、日期和来源地址计算的HMAC，不保存原始地址、代码、预期、标准输入、输出或密钥。完整代码与填写的预期在点击后发送给DeepSeek处理；提供方的数据处理边界以其服务条款为准。

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

检查功能的后端升级使用 `deploy/upgrade-explanation.py --source <审查后源码> --sha256 <新源码摘要> --previous-sha256 <当前源码摘要> --snippet-sha256 <当前模型片段摘要>`。它拒绝覆盖已改变的源码或Nginx片段，先在root0700目录备份两者；短暂关闭新模型请求、等待现有HTTP线程排空（最多45秒），只原子替换独立模型源码并重启该服务，经schemaVersion=2健康检查后恢复原片段。保留原单元、密钥和活计数库，原执行服务不变。升级异常时使用同一备份恢复源码及片段；不要倒灌旧数据库。新后端兼容旧页面请求，以诊断步骤供旧界面显示，避免部署窗口把有问题的代码标成检查通过。

## 验收

`npm test` 包含无需外网/密钥的模型适配器、三种判断、原始行最小替换、意图隔离、晚到保护、并发合并、持久限额及同源HTTP回归。`npm run lab:ai-browser` 使用本机配置和真实Chrome，**会为三份固定公开测试代码请求真实模型**；`-- --production` 验收正式HTTPS入口。核对正常代码解释、变量错误仅改一行、规则不明不改代码，原编辑器保持、缓存及宽窄明暗布局。建议候选必须逐字等于已知安全测试程序后，才执行该固定程序核验求和10；不执行任意模型输出。报告不记录密钥、用户草稿或模型原始响应；截图留在忽略的 `tmp/ai-explanations/`。

接口依据：[DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)、[JSON输出](https://api-docs.deepseek.com/guides/json_mode/)。
