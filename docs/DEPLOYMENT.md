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


## 2026-10-09 运行体验续版后端升级

主改动dcc6292已由用户/外部操作推送，Actions37898617382的build/deploy成功。私有执行器本轮带备份升级，备份`/var/backups/code-museum-executor/20261009T110023Z`；executor.py SHA `52dca77233bc3b583fd570befa00279fcb458931f8eb73a534b1828dd1fe06b6`，固定镜像清单SHA保持`4782d1897554fbd51bec739d5f1bcdac71289c09a28d7432019f9ef97f7c1ccc`。原令牌、服务身份/权限、CI权限和统计数据库沿用；Nginx/systemd检查通过，两服务active，生产执行器容器零残留。统计仍从2026-10-05开始，读取时10访客/23访问，读取不增计数。

42项实际隔离Docker检查和30项实际Chrome→临时SSH Docker检查通过；后者包含Rust/Go八主题真实输出。窄屏展开诊断区最小高度补丁经实际截图复核，可同时读诊断和“未执行”提示。记录见execution-experience-docker-checks.json及execution-experience-browser-checks.json。最终收尾提交/Actions与正式HTTPS核验待实际完成后追加。

最终续版上线核验：收尾补丁8f11914推送成功，Actions37921475238的build/deploy成功。正式HTTPS实际Chrome30项检查通过：七远端语言两尺寸、独立编译诊断/分阶段耗时、编译中停止恢复、Rust/Go八主题预期输出、私有远端与明确启用后的本地Pyodide，以及JS/Lua/Scheme真实输出。13份浏览器读取文件与额外9份模块/数据文件逐字节匹配本地构建；宽窄屏及编译错误截图已查看。正式SSH只读MCP四条更新关系查询通过，C→C++已显示influencedBy，Java→C#、Objective-C→Swift、JS→TS摘录状态一致。记录见execution-experience-production-checks.json、execution-experience-production-files.json、execution-experience-production-mcp.json。报告不存令牌/会话/任务ID；后续仅核验文档提交不改变已核验网页和后端源码。


## 2026-10-09 监控、HTTPS MCP 与导览发布

主提交4b2dc8506ccc5063b957249b6ae90e844338e277，Actions37927867005的build/deploy成功；未覆盖其他机器提交。现有私有执行器通过管理员安装器升级五份模块、unit与Nginx片段，备份`/var/backups/code-museum-executor/20261009T120616Z`。仅新增执行账号专属0700指标目录/0600 SQLite及需独立Bearer的`/mcp`；原执行密钥、账号/Docker/CI权限、访客数据库保持。回滚原文件可用备份manifest，不删除指标数据库；静态release与后端仍分别管理。

真实生产HTTPS9组服务检查通过：匿名执行/MCP401、两种凭据不互通、Origin/协议/Accept/方法拒绝、通知202、五只读查询、无执行工具、私有指标、目录/DB权限、五份安装SHA、两服务active、执行容器零残留。统计接口仍10 UV/23 PV，起始2026-10-05T03:43:53.001398+00:00，未清零。指标自2026-10-09T12:06:17.912975+00:00启用。

实际Chrome生产HTTPS15组检查通过（临时服务版另有一次进程重启保留检查，生产不为测试重启）：一次真实Python执行更新聚合，五查询/凭据隔离、三条全部16步的导航目标和前后/结束/刷新恢复、两主题两尺寸、无隐式POST或环境下载。16份静态文件与本地构建SHA一致，宽窄屏截图已查看。记录platform-production-service-checks.json与platform-production-browser-checks.json。不把一次Python执行当作本轮重跑全部七种生产镜像或安全逃逸证明；镜像与资源权限契约沿用上一轮。

HTTP MCP共用执行器进程及Docker启动依赖，手工Bearer无OAuth/SSE；聚合指标无告警/趋势/完整可用率；导览仅导航进度不评判学习成果。接入见MCP.md、EXECUTOR.md。

## 2026-10-10 关系证据与地图点击修复发布准备

用户明确授权推送发布本轮已完成改动：Self→JavaScript、Haskell→Curry、λ演算→Lisp、LLVM IR→MLIR 四条既有关系补证，以及地图标签/执行按钮优先于关系连线的点击修复。106条关系匹配摘录、322条字段待核；未新增运行时或调整后端。

54项npm测试、离线构建与80项实际Chrome点击定向检查通过，其中Java40项；前两批关系各16项定向检查通过。发布前读到正式站仍为旧JS/CSS，不将本地结论视为已上线。本次沿用master的现有Actions限权静态发布，后端无改动、无需升级。最终commit、Actions和正式站检查结果在完成后追加。

本轮正式发布与核验完成：功能提交 `2911cc5e5573b452630609a03b35518a862f353d` 已推送，[Actions 38046491074](https://github.com/glwang-g/code-museum/actions/runs/38046491074) 的build/deploy均成功。实际隔离Chrome正式HTTPS64项鼠标导航检查通过：Java/JavaScript×1440/390×明暗×时间长河/关系谱系×已选标签/关联标签/自然运行按钮/裸露连线。Java按钮进入对应实验台、标签打开档案、裸露线打开关系；无人工路径修改或能力夹具，使用正式GET /api/runtimes，未提交代码或执行API变更。

8份线上文件逐字节匹配本地构建，正式宽窄屏截图已查看；证据 `data/audit/map-hit-target-production-checks.json`。四条关系补证随本次数据发布，后端没有升级。本次不代表实际Java编译执行或原生Safari鼠标实测。后续仅核验文档/报告提交不改变已核验网站源码与文件字节，沿用同一发布流程。

## 2026-10-11 信息层级与交互闭环上线

信息层级首轮提交 `3fd9537` 对应 Actions `38101158448`；交互闭环提交 `e047043` 对应 Actions `38102455759`。两次 build/deploy 均成功，沿用 master 自动发布、限权部署账户及现有生产目录，没有修改后端执行权限、令牌、统计数据库或 Nginx。

第二轮上线后读取正式站 `index.html`、`museum.js`、`museum.css`、`credits.js`、`exploration-tools.js`，SHA-256 与本地构建分别为 `02345222…`、`40ce6b6f…`、`8e3f2628…`、`e2fb2a6c…`、`b329729a…`。实际生产 HTTPS Chrome 探针通过：实验台“项目与许可”打开并聚焦 `credit-browser-javascript`；关系设置摘要显示“探索设置 · 上游 · 2 层”；设置打开时按 Escape 只关闭设置，档案保持 open 且非 inert。完整本地浏览器证据见 `data/audit/exploration-hierarchy-round2-checks.json` 与 `data/audit/exploration-hierarchy-runtime-browser-checks.json`。

## 2026-10-11 仓库链接规范化

GitHub remote 已迁至 `glwang-g/code-museum`。提交 `0aa352e` 将站点顶部项目入口、出处页源码与 README 链接、仓库 README 内外链统一到新地址，Actions `38102639824` build/deploy 成功。正式站 `index.html` SHA-256 `ac3b4f16…`、`credits.js` `3ebeec93…` 与本地构建一致。`npm run diagnose:release -- --url https://codemuseum.freexlib.com --json` 返回 errors/warnings 均为空，线上与本地 provenance 的 PLDB 快照、人工审查、地图节点、421 条设计关系与 7 条生态关系完全一致。本次没有后端或运行权限改动。

## 2026-10-11 关系缺口研究入口上线

提交 `9cbb69b` 增加档案到关系核对 gaps 视图的直达入口，Actions `38115359630` build/deploy 成功，无后端或权限改动。正式站 `museum.js` SHA-256 `55edf131…`、`relationship-coverage.js` `113cfe69…` 与本地构建一致；本地真实 Chrome 回归覆盖 1440/390、gaps 筛选、XSLT 聚焦和历史折叠区访问，证据见 `data/audit/relationship-gap-research-browser-checks.json`。

## 2026-10-11 地图关系缺口入口

提交 `6de9d65` 将无设计层关联常显语言的研究入口补到地图底部，Actions `38115707001` build/deploy 成功。1440/390 实际 Chrome 回归覆盖地图入口和档案入口、gaps 过滤与 XSLT 聚焦。

提交 `3f9b2ac` 将地图研究缺口入口明确为“设计层待补”，Actions `38115889027` build/deploy 成功；正式 `index.html` SHA-256 `fe659e80…` 与本地构建一致。

提交 `58e3c09` 将研究缺口判断修正为地图内设计关系，Actions `38116156431` build/deploy 成功。正式 HTTPS 验证 Assembly、XSLT、Zig 在 1440/390 的 gaps 入口和聚焦行为。

## 2026-10-11 身份别名批次 1

提交 `ac87ec1` 记录 cperl、JRuby、Lisp/Common Lisp、Visual Basic/.NET 的别名排除及来源，Actions `38117111217` build/deploy 成功。`npm test` 62/62，审计重生成后 124 行身份问题中 6 行已明确、118 行待核；没有修改原始 PLDB 快照或新增关系。

## 2026-10-11 关系证据扩展批次 22–29

以下提交均通过 master 自动 build/deploy，没有修改后端执行器、令牌、统计数据库或 Nginx：

| 批次 | 提交 | Actions | 内容 |
| --- | --- | --- | --- |
| 22 | `9c6a2d5` | `38117678764` | Common Lisp 上游关系 |
| 23 | `6f151dc` | `38118039837` | Miranda → Haskell |
| 24 | `ea643b3` | `38118396929` | Haskell 报告地图可见前驱 |
| 25 | `2dffb52` | `38118759653` | C# → F#；Python → F# 否决 |
| 26 | `dacba1b` | `38119074848` | F# → TypeScript |
| 27 | `1e9ea29` | `38119458824` | Lisp → Clojure |
| 28 | `fc54cce` | `38119507787` | Standard ML → Alice |
| 29 | `eb0b591` | `38119590563` | Haskell 报告非地图前驱 |

最终当前状态：442 条设计/历史关系、7 条生态关系；设计关系中 318 条字段待核、6 项年代线索；地图节点 233、无可见设计关系节点 161、常显标签缺口 3（Assembly、XSLT、Zig）。研究限制与逐条来源见 `docs/audit/RELATIONSHIP_RESEARCH_LEDGER.md` 和各批次报告。

## 2026-10-11 第二轮研究、身份与 Zig 缺口关闭

沿用 master 自动构建/部署，未修改后端执行器、令牌、统计数据库或 Nginx。近期部署：

| 提交 | Actions | 内容 |
| --- | --- | --- |
| `caef28a` | `38119799152` | 同步机器可读研究台账 |
| `ca174d4` | `38120199996` | 关系核对页展示研究台账摘要、浏览器测试加固 |
| `d984410` | `38120286460` | Gofer 年代边界说明 |
| `b31ee56` | `38120775666` | ALGOL 60 → ALGOL W |
| `2ab2b42` | `38120880146` | C → Zig 设计对照，Zig 缺口关闭 |
| `47c2670` | `38120967700` | Bazel/INC 身份别名排除 |
| `5e0c55c` | `38121075104` | ColdFusion/CFML 排除；未决/已处理身份指标拆分 |

当前审计：450 条总关系（443 条设计/历史、7 条生态）；设计关系 126 条摘录已存、317 条字段待核；6 项年代线索；地图节点 233、无可见设计关系节点 160、常显设计层缺口 2（Assembly、XSLT）；身份总线索 126、未决 115、已明确处理 11。生产 `diagnose:release` 的线上/本地 provenance 输入一致。

### 2026-10-11 最新研究批次收口

| 提交 | Actions | 内容 |
| --- | --- | --- |
| `e21945e` | `38121222127` | XSLT/DSSSL 有来源但因缺失端点阻塞 |
| `5588a2a` | `38121794221` | Sass → Less 官方设计启发 |
| `3657d33` | `38121871540` | C/C++ → C# 候选收口为无合格来源 |

生产诊断在 `3657d33` 通过：451 条总关系、444 条设计关系、7 条生态关系；94 条人工审查、216 条已阅读来源；地图无可见设计关系节点 158、常显缺口 2（Assembly、XSLT）；无 provenance mismatch。

## 2026-10-16 公开留言板

网站新增公开留言板：意见同时发到维护者 QQ 邮箱 `1956341482@qq.com`，并在页面上以日志形式公开显示。实现位于 `server/messages.py`，由既有 `server/analytics.py` 进程加载，因此**不新增 systemd 单元**，发布仍只重启 `code-museum-analytics`。留言数据库固定为 `/var/lib/code-museum/messages.sqlite3`（`--messages-database` 或 `MESSAGES_DB` 可覆盖），落在服务已有的 `StateDirectory`/`ReadWritePaths` 内，无需新增权限。若 `messages` 模块或该数据库不可用，服务打印 `Guest book disabled...`，访问计数继续工作。

部署配置如下；`deploy/nginx.conf` 是可复现模板，生产 Nginx 使用独立 snippet 合并。

1. Nginx：在 http 上下文新增 `limit_req_zone ... zone=code_museum_messages:1m rate=2r/s;`，并在 code-museum 虚拟主机内加入模板中的 `location = /api/messages` 与正则 location `"^/api/messages/[a-f0-9]{32}/visibility$"`（正则花括号必须加引号）。前者允许 GET/POST、限制 8k 请求体、关闭访问日志；后者只允许 POST，并在后端二次校验 Bearer 令牌。先备份现有配置，`nginx -t` 通过后再 reload；`access_log off` 用于避免把留言正文写入日志。
2. SMTP 凭据：创建 `/etc/code-museum/messages.env`（目录为 `root:code-museum`、0750；文件为 `root:code-museum`、0640，与 release 目录分离，不进入 Git）。服务以 `code-museum` 用户运行，必须能穿过目录并只读该文件；其他用户均不可读取：

   ```ini
   MESSAGES_SMTP_USER=1956341482@qq.com
   MESSAGES_SMTP_PASSWORD=<QQ 邮箱 SMTP 授权码，不是登录密码>
   MESSAGES_SMTP_HOST=smtp.qq.com
   MESSAGES_SMTP_PORT=465
   MESSAGES_MAIL_TO=1956341482@qq.com
   MESSAGES_ADMIN_TOKEN=<随机隐藏令牌>
   ```

   `MESSAGES_MAIL_TO` 缺省与发信账号相同；`MESSAGES_ADMIN_TOKEN` 只用于隐藏违规留言，不是发信凭据。单元文件的 `ProtectSystem=strict` 只让 `/etc` 只读，仍可读取该文件。文件不存在或缺少账号/授权码时，留言照常保存和公开展示，但不会发信，服务日志会打印 `mail notifications not configured`。
3. 出站网络：发信需要服务器到 `smtp.qq.com:465` 的出站 TCP 连通（非 465 端口走 STARTTLS）。若被防火墙阻断，留言保持 `notified_at IS NULL` 并记录 `notify_error`，后台线程每 120 秒重试；这属于“未确认送达”，不能对外说成已发送。
4. 发布后核验：`curl -s https://codemuseum.freexlib.com/api/messages?limit=3` 应返回 JSON；在页面上提交一条真实留言，确认公开日志与邮箱都收到；`/api/visits`、`/healthz` 与执行 API 行为不变。

维护命令（在服务器上运行，数据库属于服务账户）：

```sh
sudo python3 /var/www/code-museum/current/server/messages.py --report      # 总数/可见数/未确认送达数
sudo python3 /var/www/code-museum/current/server/messages.py --list 20     # 最新 20 条，含已隐藏
sudo python3 /var/www/code-museum/current/server/messages.py --hide <id>   # 隐藏 / --show 恢复
sudo python3 /var/www/code-museum/current/server/messages.py --deliver     # 立即重试一次待发通知
```

本地已核验（仅回环环境，用无头 Chrome + `dist/` 预览 + 真实 `server/analytics.py`）：提交返回 201 并立即出现在公开日志、角标与 `共 N 条` 计数正确、20 秒冷却与每次访客限流生效、空列表与「服务未接入」降级文案正确、`--hide` 后公开列表与角标同步变化、1440 与 390 两档无横向溢出、无 console 异常。注意本地启动后端时必须把预览站的实际来源（含端口，例如 `https://codemuseum.freexlib.com:4173`）传给 `--origin`，否则 POST 返回 403。

生产上线记录：提交 `661ec75` 的 Actions `38828385194` build/deploy 成功。生产 Nginx 将留言代理置于独立 `/etc/nginx/snippets/code-museum-messages.conf`，主虚拟主机只追加 include 与 `code_museum_messages` 限流 zone；原配置备份在 `/var/backups/code-museum-nginx/code-museum.pre-messages-20261016T001638Z`。`nginx -t` 通过后 reload，统计/留言服务 active。

HTTPS 探针实际 POST 201、GET 可见、管理员命令隐藏后公开列表不再返回该记录；探针保留为隐藏记录以验证审计路径。随后 `--deliver` 返回 1，`pendingNotification` 从 1 变为 0，证明 SMTP 服务端接受了该通知；不把这替代为收件箱人工确认。第一次备份若放在 `sites-enabled` 会被 Nginx 当成第二个站点并触发重复 zone 错误；该次校验未 reload，已将备份移至 `/var/backups/code-museum-nginx/` 并恢复基线后重试成功。

仍需持续观察：`POST /api/messages` 只做同源 Origin 校验（依赖 Nginx 转发 Origin），不是防滥用身份系统；限流按匿名标识哈希，清除浏览器数据即可重置。留言公开显示，界面已提示不要填写隐私信息，但公开内容仍需人工关注，必要时用 `--hide` 处理。


## 2026-10-16 内容指纹与静态缓存（本地配置，未部署）

构建保留原始 JS/CSS 稳定地址供 Worker 与诊断使用，同时为 HTML 直接引用的脚本、样式和生成数据创建 `name.<sha256前12位>.js/css` 副本；`dist/data/asset-manifest.json` 记录对应关系。内容版本基于生成别名前的固定输入计算，别名和清单都是确定性派生物。HTML 不长期缓存，稳定文件地址继续 `no-cache`，只有带内容指纹的文件可用 `public, max-age=31536000, immutable`。河景采用同样带内容哈希的 WebP 文件名，构建强制校验小于 10,000 字节。

本机 `scripts/serve.cjs` 已实现相同缓存规则。生产需在现有 Code Museum HTTPS server 块中、通用扩展名 location 之前，合入 `deploy/nginx.conf` 中新增的内容指纹 location，再执行 `nginx -t` 和 reload；不能整份覆盖现有虚拟主机，以免丢失执行接口、MCP、留言板与 TLS 配置。现有 `deploy/activate.sh` 只切换 release，并不自动更改 Nginx，所以推送本身不会启用这条缓存策略。每次新 HTML 会引用新的指纹地址，避免长缓存混用新旧脚本；旧 release 仍按现有回滚策略保留。
