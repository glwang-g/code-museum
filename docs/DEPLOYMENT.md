# Code Museum 首版部署

目标仓库：`glwang-g/code-museum`，主分支 `master`。正式站点：<https://codemuseum.freexlib.com>，与 xshow 的 `labs.freexlib.com` 同在 `82.156.83.121`（Ubuntu 24.04 / Nginx 1.24）。2026-10-05 已完成独立站点、Let's Encrypt HTTPS 和统计服务部署；证书有效至2027-01-03，Certbot续期 timer 已启用，新域名续期成功后专用 hook 校验并 reload Nginx。

首次发布 release 为 `0a0b19e2656c962dccb5ce18c272b05e300463f8`。管理员使用本机 SSH alias `xshow`；经用户明确批准，专用 `code-museum-deploy` 账户只可写 `/var/www/code-museum`，sudo仅允许 restart `code-museum-analytics`，已实际验证无 xshow 目录写权限。GitHub Actions 使用单独密钥及已记录的主机公钥，Secrets不进入源码。自动部署启用后仍需看对应 Actions 的deploy结果，不能仅凭build成功判断已发布。

## 发布结构

独立目录 `/var/www/code-museum/releases/<commit SHA>` 保存 `dist/`、`server/` 与 `deploy/activate.sh`；`/var/www/code-museum/current` 是当前版本链接。Nginx 根目录只指向 `current/dist`。不使用 xshow 的部署目录，也不对其执行 rsync 删除。SQLite 保存于 `/var/lib/code-museum/visits.sqlite3`，与发布目录独立。保留旧 release 可回滚，清理须另行明确保留策略。

## 服务器首次准备

确认现有 Nginx、SSH、TLS 与 sudo 约定后执行；先备份当前虚拟主机配置。

1. 将域名 A 记录指向确认的服务器地址。
2. 创建只读网站/可写状态目录的专用 `code-museum` 系统用户；创建部署目录，授予现有部署用户写入权。服务器需要 Python 3、SQLite 标准库、rsync、curl 和 systemd。源码构建在本机或 Actions 的 Node.js 22 完成，服务器无需 Node.js。
3. 将 `deploy/code-museum-analytics.service` 安装到 `/etc/systemd/system/`，运行 `systemctl daemon-reload`。首次启用服务需先上传 release 并创建 current 链接，随后 `systemctl enable --now code-museum-analytics`。仅授予部署用户对该服务 restart 的 sudo 权限，不授予全局 sudo。
4. 将 `deploy/nginx.conf` 作为独立虚拟主机模板，沿用服务器现有证书签发机制；首次证书不存在时先启用仅 HTTP/ACME 配置，取得证书后再启用 HTTPS 段。限流 zone 放在 http 上下文。保留 xshow 原配置；执行 `nginx -t` 成功后再 reload。
5. 本机核对服务器主机公钥，经可信连接确认指纹后保存 `DEPLOY_KNOWN_HOSTS`，不在 CI 用实时扫描代替身份核验。
6. 检查 HTTPS、`.mjs`/`.wasm` MIME、真实 Python 执行及访问计数。开启自动部署前先完成首次配置。

## GitHub Actions

每次推送 master：离线构建输入、运行 `npm test`、`npm run build`，检查 Python 语法并上传 release artifact。无 npm 下载依赖。部署仅在仓库 variable `DEPLOY_ENABLED=true` 时启用，启用前配置以下 secrets（可置于 production environment）：

| 名称 | 用途 |
| --- | --- |
| DEPLOY_HOST | 已确认的服务器 IP/域名 |
| DEPLOY_USER | 现有部署用户 |
| DEPLOY_PORT | SSH 端口，缺省22 |
| DEPLOY_SSH_KEY | 已授权的专用部署私钥 |
| DEPLOY_KNOWN_HOSTS | 已核验的主机公钥 known_hosts 行 |

GitHub 无法读回 xshow Secret 值；需要本机已有授权密钥或用户在仓库配置。不要把密钥、数据库或环境文件提交 Git。部署目录固定为 `/var/www/code-museum`，避免误填 xshow 路径。

工作流上传新 release 后原子替换 current 链接，重启统计服务并检查健康；存在旧 release 时，激活失败会恢复旧链接并尝试恢复服务。HTTPS 检查失败会让工作流失败，需判断 DNS/TLS 或应用问题，不能把构建成功当成上线成功。并发发布排队，避免在切换中途取消。GitHub Actions 本身需联网，但站点构建的数据和运行时不在构建时下载。

## UV/PV 统计

`src/analytics.js` 仅在生产 HTTPS 域名运行。页面首次可见时发送一次 POST `/api/visits`；刷新计新 PV，SPA 页签/语言点击不计新 PV。UV 按 localStorage 中随机 UUID 去重；数据库只保存其 SHA-256，不保存原标识、IP、搜索词或代码。清除浏览器数据/换设备会产生新 UV；禁用脚本/持久存储、上报失败及被识别的自动客户端不计数。它是已成功上报的浏览器访问，不是精确人数，也无法保证排除所有机器人。限流可能丢弃高频刷新。首次启动数据库保存 `startedAt`；此前无埋点的访问无法恢复。

Python 首次运行文件下载及初始化允许最多90秒；程序实际运行仍最多3秒。较慢网络可能达到加载预算，失败时显示真实错误并允许重试。

接口检查同源 Origin、UUID、请求大小、内容类型；同一个 eventId 重复请求只计一次。SQLite WAL 事务持久化，同一标识重复加载增加 PV 不增加 UV。进程仅监听回环地址，Nginx 转发并限制频率；`GET /api/visits` 公开返回累计 `uv`、`pv` 和 `startedAt`，不返回访客标识、事件列表或数据库路径。累计查询由服务端缓存30秒，前端成功读取后一分钟内不重复查询。统计起始时间为2026-10-05 11:43:53（Asia/Shanghai）。网站右上角主题按钮旁显示累计 UV/PV，点击可查看准确数字、起始日期和统计口径；接口不可用显示“—”，本地静态预览不伪造数字。管理员仍可通过 SSH 查询：

```sh
sudo -u code-museum python3 /var/www/code-museum/current/server/analytics.py --report
sudo -u code-museum python3 /var/www/code-museum/current/server/analytics.py --backup /var/lib/code-museum/visits-backup.sqlite3
```

备份使用 SQLite backup API，不能只复制活动数据库而忽略 WAL。应定期把备份存入已有服务器备份体系；数据库和备份均不放进公开静态目录。尚未配置自动定时备份。更换发布版本不清零；删除状态目录才会丢失统计。

## 已核线上边界

24个静态文件与本机构建SHA-256一致，HTTP重定向HTTPS，Wasm以application/wasm及gzip传输。实际Chrome通过地图模糊搜索、节点选中、JavaScript输出42、Python输出55和390px布局检查；自动浏览器与DeploymentBot上报不计数。复查发现一次首次Python加载30秒超时，随后将加载预算增至90秒，执行预算保持3秒，最终发布后继续核验。当前只增加独立code-museum虚拟主机，备份对比确认其他Nginx站点配置保持一致。统计服务开机自启，数据库首份备份已创建，定时异地备份尚未配置。

发布传输使用 rsync --checksum 与 --link-dest 指向当前release，校验内容后复用或在服务器内复制相同文件；新release仍是独立目录，不原地覆盖current。避免每次从GitHub经国际链路重传未变化的Pyodide文件，读取与校验开销发生在CI和服务器。

## 最终首版核验记录

2026-10-05，Actions run [37266961880](https://github.com/glwang-g/code-museum/actions/runs/37266961880) 的build与deploy成功，release392411b已激活。完整线上复核已通过合并工具栏、真实鼠标选中、JavaScript42、Python55、三个Shell高亮示例及窄屏布局；24份静态文件哈希与本地一致。记录：[生产核验](../data/audit/production-runtime-checks.json)。暂存CI私钥已从本机临时目录移除，私钥仅保存在已授权GitHub Secret中。


## 2026-10-08 私有 Docker 执行服务

用户明确批准安装独立无登录服务身份、服务进程Docker权限、root代码/私有令牌配置、systemd开机自启及同域HTTPS代理。`code-museum-executor`已安装并通过active/enabled检查，监听127.0.0.1:4181；Python3.13.16、Ruby3.4.11固定镜像已准备。执行请求必须私有Bearer令牌及32hex session，无令牌HTTPS POST实测401。不存在匿名执行或公开令牌。

代码在 `/opt/code-museum-executor`，root拥有，独立于CI可写的release；单位文件在 `/etc/systemd/system/code-museum-executor.service`，secret在 `/etc/code-museum-executor/private.env`（root:root 0600）。Docker SupplementaryGroups只给服务进程，专用账户无登录、没有永久加入docker组；`code-museum-deploy`仍只有原部署权限，docker组仍仅现有ubuntu成员。后端升级必须管理员重新执行 `sudo python3 deploy/install-executor.py`，静态Actions不自动升级或重启这个服务。

代理只追加在code-museum独立虚拟主机，由 `/etc/nginx/snippets/code-museum-executor.conf` 提供。关闭执行API的访问日志、请求和响应缓冲。Nginx/systemd配置检查通过后reload。安装先遇到Linux保护已有/tmp锁的O_CREAT限制（没有配置变更），修复后遇到Nginx正则花括号须加引号，配置检查失败已自动恢复原站点；修正后安装成功。成功安装备份在 `/var/backups/code-museum-executor/20261008T061852Z`，此前失败检查也保留独立备份。

这是正式域名上受私有令牌限制的runc执行服务，只执行受信任代码；不等于匿名公共沙箱、独立执行主机或gVisor防护。管理员取令牌并粘贴到实验台的步骤见 [执行说明](EXECUTOR.md)。最终页面commit与真实HTTPS浏览器核验待发布后追加。

正式发布核验：实现提交 `2daa0e148811f5560e8cb940bbfca1adfc9aeb44` 已推送并激活，[Actions 37737054299](https://github.com/glwang-g/code-museum/actions/runs/37737054299) build/deploy均成功。正式HTTPS实际Chrome10项执行检查通过：Python/Ruby在1440/390两种宽度实际求和与stdin输出55/hello，Python语法错误，取消后恢复42，编辑不自动提交，默认无Pyodide下载，明确启用本地Pyodide后43，JavaScript/Lua/Scheme均实际输出42。13份线上页面/数据/Worker/运行时清单SHA与本地构建一致；宽窄屏截图已查看。记录见 [Docker与浏览器线上核验](../data/audit/executor-production-checks.json)。

首次线上检查误用15秒等待本地Pyodide，页面当时仍在加载而非执行失败；脚本改为对齐网站90秒加载预算（95秒观察窗口），并修复关闭Chrome后临时目录删除的等待/重试，再完成全量10项。网站运行时本身未因这个脚本问题改动。原访问统计health204、统计与执行两个服务active；执行配置root-only600、root代码与固定镜像哈希一致。没有重新执行公开站点全地图遍历或原生Safari测试。


## 2026-10-09 公共累计统计入口（本地实现）

新增头部累计统计与只读GET接口。上线时除静态站点/统计服务正常发布外，需将既有 `/api/visits` Nginx location 的 `limit_except POST` 改为 `limit_except GET POST`（GET隐含允许HEAD）；不新增数据库、权限或访客字段。现有Actions不会自动修改生产Nginx，本轮尚未发布或更改服务器配置。仅上线前端会因GET被旧配置拒绝而显示统计不可用。


## 2026-10-09 累计统计已上线

68707e8 已推送，Actions 37877136008 的build/deploy均成功。生产站点既有Nginx统计location已从仅POST改为GET/POST，保留时间戳备份并通过nginx -t和reload；执行API及其他站点未改动。HTTPS累计查询真实返回uv/pv/startedAt，4份线上静态文件与该提交SHA一致；读取不增加访问。统计数据库沿用原文件，起始日期仍为2026-10-05。本条覆盖前述“仅本地实现、待发布”的状态。


## 2026-10-09 学习体验与中文统计名称发布准备

沿用用户验证后提交推送授权，准备发布主题示例、按语言/主题草稿、文件操作、停止运行和语言对比第六页签；统计常显名称改为访客/访问，展开保留UV/PV对照。45项npm测试、离线构建、23组最终定向Chrome检查通过；34组完整回归对应最后用词调整前的版本，报告明确记录范围，未改写历史核验哈希。执行服务运行范围与私有权限保持既有实现，未新增C/C++/Java/C#网页运行。最终Actions和正式站点检查结果待实际完成后追加。


学习功能发布核验：2032738推送成功，Actions37879243826的build/deploy均成功。正式HTTPS实际隔离Chrome检查顶部“访客/访问”、累计接口仅返回uv/pv/startedAt、两主题1440/390宽度的四组对比（16种组合）、对应函数主题实验台与真实JavaScript输出49；14份线上关键文件与本地构建SHA一致，宽窄屏截图已查看。证据data/audit/learning-production-checks.json。本次未重新执行生产Docker或线上Python/Lua/Scheme，也未核验原生Safari；本地四种运行时的16份新增程序见learning-browser-checks.json。前述“准备发布”的状态由本条实际结果覆盖。后续核验文档提交不改变上述网站源码与被核验文件。


## 2026-10-09 第3/4/5项正式发布

功能提交b1665b2推送成功，Actions37890426132的build/deploy成功，正式release为b1665b222d527bb37686b3333ab43ee2e9166e18。静态发布保持现有限权CI账户和原子激活流程；5,155条馆藏与累计访问SQLite沿用。发布诊断核对线上provenance与本地一致。

现有私有执行器经已授权管理员安装升级，备份/var/backups/code-museum-executor/20261009T054846Z；账户、Docker权限和原有令牌不变，新增C/C++/Rust/Go/Java固定官方镜像及分离编译/运行阶段。安装代码SHA：executor.py 4c24e4e1070d0d796632b01e8112fadd9866d60ec41ccf4ce7465f7a68f70430；runtime-images.json 4782d1897554fbd51bec739d5f1bcdac71289c09a28d7432019f9ef97f7c1ccc。Nginx/systemd校验通过，执行与统计服务active；无令牌执行401，CI未获得Docker权限。

实际Chrome正式HTTPS22组检查通过：七种远端语言在1440深色/390亮色真实输出和stdin，五种编译阶段计时/禁用本地选项，编译错误独立展示、Go编译中停止及恢复，Python语法错误/取消恢复，以及Pyodide/JS/Lua/Scheme真实执行。13份浏览器读取文件和额外9份新模块/MCP数据文件SHA与本地dist一致；宽窄屏、编译中和错误截图已查看。记录executor-compiled-production-checks.json和continuation-production-files.json，不含令牌/会话/任务ID。

正式release中的stdio MCP通过既有xshow SSH启动，9项实际协议/工具/资源核验通过，四份数据SHA一致、五工具只读、执行工具拒绝；记录mcp-production-checks.json。没有新增公开MCP端口或常驻权限，客户端接入见MCP.md。

收尾只读确认执行器标签容器零残留，统计仍为2026-10-05开始的数据（核验时9访客/21访问；浏览器自动化不计访问），未重置数据库。上述检查绑定功能发布，后续核验文档提交不改变网站或执行器源码。
