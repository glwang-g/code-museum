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

接口检查同源 Origin、UUID、请求大小、内容类型；同一个 eventId 重复请求只计一次。SQLite WAL 事务持久化，同一标识重复加载增加 PV 不增加 UV。进程仅监听回环地址，Nginx 转发并限制频率；公开接口不提供统计查询。统计起始时间为2026-10-05 11:43:53（Asia/Shanghai）。是否公开展示累计数字仍待用户决定，当前管理员通过 SSH 查询：

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
