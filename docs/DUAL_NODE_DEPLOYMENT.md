# 双节点执行部署方案与操作顺序

用户已授权本轮提交、推送和静态部署；`8bf6c20`站点现已实际发布，正式数据为59节点/56远端，GitHub分批上传及master/Actions仍在收尾，不能把站点激活等同Git或CI全部完成。本方案把运行时准备、站点发布和私有执行服务升级分开。`deploy/prepare-dual-executor.py` 只生成本机可审查材料，不连接服务器、不安装账号、不生成凭据、不启动或切换服务。准备成功与临时双节点联调成功都不等于生产已部署。

## 拓扑和分工

| 位置 | 服务 | 监听 / 访问方式 |
| --- | --- | --- |
| xshow | 现有 Nginx 网站入口 | 原 HTTPS / 同域执行 API 保留 |
| xshow | `code-museum-execution-gateway` | `127.0.0.1:4181`，聚合可用语言并按固定分配转发 |
| xshow | `code-museum-worker@xshow` | `127.0.0.1:4184`，仅接受 xshow 的语言子集 |
| xshow | `code-museum-execution-tunnel` | 本机 `127.0.0.1:4183` 转发到 xshow2 的 `127.0.0.1:4181` |
| xshow2 | `code-museum-worker@xshow2` | `127.0.0.1:4181`，仅接受 xshow2 的语言子集 |

正式安装预检发现 xshow 的 4182 已由既有 `xshow-guestbook.service` 使用，因此新 worker 改用经空闲检查的 4184；原留言服务和它的端口保持原样。端口修订后的 v3 清单和两台实际代码已重新核对，见 `data/audit/dual-node-production-port-revision.json`。

分配以 `server/execution-nodes.json` 为准，要求完整覆盖固定清单，每门语言恰好一个节点。每个 worker 仍只有一个执行槽和有界队列。当前 Groovy 单独为 8 秒运行预算（含 JVM 启动与脚本编译），其他语言沿用原预算；API 用每门 `runSeconds` 精确公开，`limits.seconds` 为可用语言中的最大值。网关记录任务归属，查询和取消始终返回原节点；节点失败不自动向另一台重发代码。网站只展示实时可用的语言，失联节点不使另一台全部失效。

网关沿用浏览器使用的现有私有执行令牌，向 worker 转发时使用独立的节点令牌；节点令牌与 SSH 密钥不进入源码、发布包或浏览器。网关账号没有 Docker 权限。worker 只按原有受限容器执行协议运行用户代码。

## 先生成可审查的部署材料

从工作区固定输入构建站点，再生成一个新的准备目录：

```sh
npm test
npm run build
python3 deploy/prepare-dual-executor.py --output output/dual-executor-review
python3 output/dual-executor-review/xshow/preflight.py
python3 output/dual-executor-review/xshow2/preflight.py
```

目录中的 `plan.json` 列出节点分配、端口、服务、包字节数、激活和回退步骤。每个节点目录包含固定代码、五份 museum 数据、所需 unit、凭据占位模板及逐文件 SHA-256 清单，没有 SDK 归档或镜像层。`preflight.py` 检查这些文件没有变化；加 `--check-images` 时只读核对当前机器 Docker cgroup v2、seccomp 和该节点的固定镜像 ID/架构，不拉取或启动镜像。

在各节点的独立临时目录上传相应准备材料后，由有 Docker 只读访问能力的管理员运行：

```sh
python3 /path/to/review/xshow/preflight.py --check-images
# xshow2 上使用其对应目录：
python3 /path/to/review/xshow2/preflight.py --check-images
```

任何缺少或身份不同的镜像都要先通过项目固定构建器单独准备；不能改 image ID 让检查表面通过。两台只检查自己的语言子集，不要求每台放入全量镜像。`bundle-manifest.json` 及 `plan.json` 在最终批准前保留原样，后续安装的字节必须与它们相符。

## 经批准后安装常驻服务

下列是准备材料的安装约定，执行前应审查具体 `plan.json`，确认两台剩余磁盘、内存和已有进程。首次安装须有明确的生产变更授权；普通 GitHub Actions 无权执行这些步骤。

1. 两台都将对应 `code/` 文件安装到新的 root 拥有目录 `/opt/code-museum-executor-dual`，文件不可由 CI 或服务账号写入；不要覆盖旧 `/opt/code-museum-executor`。准备材料中的 `code/museum-data` 同步安装，避免 worker 启动依赖网页发布目录。
2. 两台建立或复用无登录 `code-museum-executor` 服务身份和 `/var/lib/code-museum-executor`。仅 unit 的 `SupplementaryGroups=docker` 给 worker Docker 权限；不把 CI、网关或 SSH 转发账号加入 docker 组。
3. xshow 建立无登录的 `code-museum-gateway`、`code-museum-tunnel` 身份。网关路由状态位于独立 `/var/lib/code-museum-executor-gateway`；xshow worker 使用原服务身份并复用原 `/var/lib/code-museum-executor/metrics.sqlite`，使历史聚合指标继续出现在网关汇总中。xshow2 使用独立 `worker-xshow2-metrics.sqlite`；不能把原数据库复制到两台后相加，避免重复计算。worker unit 通过各自 `EXECUTOR_METRICS_DB` 指定路径。旧指标文件、访问统计、留言和授权申请数据库不迁移、不清空。
4. 通过管理员凭据编辑渠道填充 `/etc/code-museum-executor/worker-xshow.env`、`worker-xshow2.env`、`gateway.env`；仅把各机器需要的文件放到该机器，root:root、0600。`gateway.env` 保留现有公开执行入口的私有令牌，并分别设置与两台 worker 匹配的 `EXECUTOR_NODE_XSHOW_TOKEN`、`EXECUTOR_NODE_XSHOW2_TOKEN`。两个 worker 令牌须不同，禁止使用模板占位文字。
5. 安装相应 `units/` 到 `/etc/systemd/system`，先执行 `systemd-analyze verify` 和 `systemctl daemon-reload`，再启动 worker。xshow worker 使用 4184，可与原生产执行器 4181 并存，作为切换前的验收阶段；它沿用同一聚合指标库，预切换验收任务也会计入真实聚合记录。网关用 `Wants` 启动本机 worker 和隧道，保证重启时会尝试启动它们；不使用强制 `Requires`，单个节点异常仍允许其他节点服务。

BCPL 沿用原作者明确的私人/学术使用边界，原始条款随固定输入保留。使用私有令牌不构成额外的商业再分发授权；任何未来用途变化需要按原条款另行判断。本方案不把暂未明确的授权写成已清除的许可结论。

首次安装时，账号、私有环境文件和目录权限确认后，可按下列命令复制已经通过 preflight 的字节；`museum_bundle` 必须指向当前机器对应的审查包。这些命令不是普通 CI 的步骤，也不适用于覆盖正在运行的新版本服务：

```sh
museum_bundle=/path/to/review/xshow
sudo install -d -o root -g root -m 0755 /opt/code-museum-executor-dual
sudo install -d -o root -g root -m 0755 /opt/code-museum-executor-dual/museum-data
sudo install -o root -g root -m 0644 "$museum_bundle/code/"*.py /opt/code-museum-executor-dual/
sudo install -o root -g root -m 0644 "$museum_bundle/code/"*.json /opt/code-museum-executor-dual/
sudo install -o root -g root -m 0644 "$museum_bundle/code/museum-data/"*.json /opt/code-museum-executor-dual/museum-data/
sudo install -o root -g root -m 0644 "$museum_bundle/units/"*.service /etc/systemd/system/
sudo systemd-analyze verify /etc/systemd/system/code-museum-worker@.service
sudo systemctl daemon-reload
sudo systemctl start code-museum-worker@xshow.service
```

xshow2 使用它的审查包与 `code-museum-worker@xshow2.service`。xshow 还须分别验证 gateway/tunnel unit。此时只启动 worker，不执行 enable，不停止旧服务；实际切换命令放在下文验收阶段。凭据不通过这组复制命令安装，不能把 `.env.example` 当作已配置的私有凭据。

## 专用 SSH 隧道

隧道服务运行在 xshow，由它连接 xshow2。应在明确授权后为此链路生成专用 Ed25519 密钥，私钥只保存在 xshow 的 `/etc/code-museum-executor/tunnel_ed25519`，root:root、0600。`LoadCredential` 向隧道服务提供只读副本，服务账号无需读取其他管理员密钥。不能将本机个人私钥复制到服务器。

xshow2 使用单独无 Docker 权限的转发账号，例如 `code-museum-forward`。其专用公钥条目至少约束为：

```text
restrict,port-forwarding,permitopen="127.0.0.1:4181",command="/bin/false" ssh-ed25519 <DEDICATED_PUBLIC_KEY>
```

还必须在 xshow2 安装准备材料中的 `ssh/code-museum-forward.sshd.conf`，经管理员审查放入 `/etc/ssh/sshd_config.d/60-code-museum-forward.conf`；它对这个账号限定 `AllowTcpForwarding local`、固定 `PermitOpen`、`PermitListen none` 和 `MaxSessions 0`，并关闭 Unix socket 转发与用户 rc，仅允许公钥认证。这样限制反向转发、shell 和 subsystem；这些选项的范围见 [OpenSSH 官方说明](https://man.openbsd.org/sshd_config)。先运行 `sshd -t`，保留现有管理员连接并验证专用账号限制后才 reload SSH 服务；不能只依赖公钥条目的 `permitopen`，因为它不限制反向转发。

该身份只用于 `ssh -N -T` 转发，不授予 shell、TTY、agent 转发或任意目标访问。`/etc/code-museum-executor/tunnel.env` 仅设置 `EXECUTOR_TUNNEL_TARGET=code-museum-forward@<xshow2-host>`；主机公钥必须从已核验渠道固定在 `tunnel_known_hosts`，不依赖自动接受首次出现的公钥。

unit 固定本机绑定地址为 `127.0.0.1:4183`，远端目标固定为 `127.0.0.1:4181`，并设置连接失败退出、SSH 保活及 systemd 失败重启。两台执行 API 都不直接监听公网。隧道失效时网关应公开对应语言不可用，恢复后重新获取健康状态，不自动重新提交此前请求。

## 切换、验收和回退

先在临时网关端口、与生产分离的状态文件上核验两节点：真实执行、编译诊断、查询、取消、会话隔离、节点断线与恢复、网关重启后的任务归属，以及 worker 并发上限。必须覆盖原有 19 门远端环境；单门临时测试通过不能代替生产回归。

切换时先等待旧生产任务结束，停止旧 `code-museum-executor.service`，再启动 `code-museum-execution-gateway.service` 接管 4181。现有 Nginx 执行代理仍指向同一个 loopback 端口，因此无需把 xshow2 地址暴露给页面。正式 HTTPS 必须检查 `/api/runtimes` 与固定分配一致，使用原入口令牌真实执行和取消，并检查节点断线只影响所属语言。验收通过后才将新服务 enable，并发布声明新增能力的网页。

经批准、临时端口验收完成且旧队列为空后，xshow 的切换命令为：

```sh
sudo systemctl start code-museum-execution-tunnel.service
sudo systemctl stop code-museum-executor.service
sudo systemctl start code-museum-execution-gateway.service
```

正式验收通过后才 enable 新网关、隧道和各节点 worker；还要在 xshow `disable` 旧执行器，避免重启时两个服务争用 4181。保留旧 unit、代码、私有环境和数据库，回退时仍可启动。

若不通过：停止新网关，启动保留的旧 `code-museum-executor.service` 恢复原 4181，然后核对原 19 门远端执行、令牌与原指标。新 worker 和隧道在无活动任务后可停止；不删除已有镜像、旧代码或任何历史数据库。新单元使用独立命名空间，停止/清理不得使用全局 Docker prune。

```sh
sudo systemctl stop code-museum-execution-gateway.service
sudo systemctl start code-museum-executor.service
```

若新服务此前已经 enable，回退还须恢复旧服务 enable，并 disable 新网关，避免下次开机再次切入；worker 和隧道的 stop/disable 在确认没有活动任务后进行。

## 普通网站发布包

`scripts/package-release.cjs --output <new-dir>` 从已构建 `dist/`、显式列出的服务源码与 `deploy/activate.sh` 生成普通发布包，拒绝符号链接和已有输出目录，并生成逐文件哈希。包内不含 `server/runtimes/`、测试、`.env` 或部署密钥，整体上限 128 MiB。GitHub Actions 只上传这个 staging 目录，不再把约 2.2 GB 的运行时构建输入传给普通站点 release。

运行时固定输入仍是版本管理和离线复现的必要材料；从普通发布包中排除它们，不等于删除或放弃保存。B组36门完整输入拟纳入公共Git，BCPL则依`data/runtime-input-policy.json`保留公开元数据与自编适配，并将六项上游材料固定在本机私有档案，不上传。网站从公开输入离线构建；重建BCPL镜像须预先提供与原清单逐字节匹配的私有包，不能仅从公共仓库完整重建。固定输入、Docker镜像、执行服务和网页分别准备、核验和回滚，CI继续没有Docker权限，也不自动升级受保护的执行器。


## 2026-11-09 实际验收与当前审查材料

- `data/audit/dual-node-inventory.json`：42/14 门分配的全部固定镜像身份与平台匹配；记录当时容量，不承诺未来磁盘余量。
- `data/audit/dual-node-runtime-checks.json`：14 项真实两机 API/Chrome 联调，含跨节点正例、会话隔离、编译错误、取消、网关重启、节点断线/恢复、部分指标与 1440/390 页面。截图在 `tmp/dual-node-browser/`，已实际查看。
- `data/audit/dual-node-all-runtimes.json`：56/56 门通过同一临时网关逐门运行已保留正例，精确匹配 stdout 和运行时版本。覆盖原19门与B组37门，每门一个正例，不代替全语义/资源验收或正式 HTTPS 回归。
- Groovy 单独修正为8秒后，11项容器与7项真实Chrome通过；原3秒超时及三次实际耗时诊断保留，不把超时计作成功。
- 默认测试90/90、网关回环HTTP测试12/12、离线构建通过。

当前生产对应的本机审查包是 `output/dual-executor-review-20261109-v3/plan.json`，SHA-256 为 `0286663a1997af8f688233ea7216bf5a1e3a1312a7458e69e4c8e22db726c1b1`，两台各约2.95MB。v3 将 xshow worker 端口由4182修订为4184；运行时镜像、执行器实现、凭据和公开入口未因端口修订改变。无后缀及 v2 准备目录保留为历史材料，不能替代当前 v3。普通站点发布包 `output/dual-node-site-release-20261109-v2/` 约35.4MB，尚未发布；审查包和普通发布包都不包含真实凭据。

用户随后明确授权“授权之前的部署计划”，生产安装、切换与验收已在该授权下完成。以下最终服务状态截至 `2026-11-09T06:05:38Z`：

- `data/audit/dual-node-production-install.json`：两台 root 拥有的新代码、节点账号、0600 私有环境文件及 systemd unit 已安装；原公开执行令牌保留，网关和转发身份没有 Docker 组权限。安装器不启动或启用服务。首次安装使用 v2，随后按 `dual-node-production-port-revision.json` 核对并应用 v3 端口修订；`deploy/install-dual-executor.py` 当前也固定校验 v3 清单与4184端口。
- `data/audit/dual-node-production-ssh.json`：专用隧道密钥在 xshow 生成并保留私钥，xshow2 仅安装公钥；固定主机公钥、受限转发账号和 sshd Match 配置已核验，SSH reload 未改变管理员限制范围。
- `data/audit/dual-node-production-canary.json`：独立 loopback4190 网关与路由库的10项检查通过，包含真实 Python/Oberon、编译错误、归属隔离、网关重启、排队/运行取消、隧道失联时42门保留及恢复56门。此阶段旧执行器和既有留言服务保持运行。
- `data/audit/dual-node-production-cutover.json`：旧执行器队列及活动任务均为0后，于 `2026-11-09T06:00:14Z` 停止旧执行器并由新网关接管4181，实时清单为56门；原聚合指标历史保留，临时 canary 已停止。Nginx 与已发布前端保持原样。旧代码、unit、私有令牌和指标库仍保留，可按本文回退命令恢复旧入口。
- [正式 HTTPS/Chrome 报告](../data/audit/dual-node-production-checks.json)：63项检查通过，包括精确56门元数据、每门一个真实正例、既有前端1440/390的 Python/SQL 执行、真实错误及恢复。报告绑定当时源码和保留的正例；已查看1440 Python、390 SQL截图。它核验当前已发布页面，不表示新版前端已发布，也不代替每门全部语义与资源专项。
- [正式生命周期报告](../data/audit/dual-node-production-lifecycle.json)：8项通过，覆盖缺少令牌和跨站来源拒绝、会话隔离、排队及运行取消、独立凭据的既有只读 MCP、受控隧道失联时保留42门、恢复56门及真实远端执行、历史指标保留。MCP继续读取已发布 `current/dist/data` 的既有快照，此项不表示新的59节点静态数据已发布。
- [最终服务报告](../data/audit/dual-node-production-services.json)：两台 worker 及 xshow 网关/隧道均 active/enabled；旧执行器已停止并 disable，旧代码与配置保留。新API端口均仅绑定loopback，服务身份均无登录且不持久加入Docker组，两台本次执行容器残留均为0。只清理本次安装临时材料与已停止 canary 的路由状态，没有清理历史库或镜像。
- [启用后健康检查](../data/audit/dual-node-production-final-health.json)：`06:06:28Z` 正式 HTTPS 再次只读确认完整56门、全局并发2、最大运行预算8秒；这是元数据复核，没有重复执行全56门程序。

两台 root 私有安装记录分别在 `/var/backups/code-museum-executor/20261109T054729947461Z-dual-xshow` 和 `/var/backups/code-museum-executor/20261109T054729521128Z-dual-xshow2`，各自的 `port-4184-revision/` 保存端口修订前材料。切换前 SQLite 备份在 xshow 的 `/var/backups/code-museum-executor/20261109T054729947461Z-dual-xshow/metrics-before-cutover.sqlite`；这些主机备份不进入源码或普通发布包。新服务启用和旧服务 disable 已在正式验收通过后完成，避免重启争用4181；回退仍须按上文恢复旧服务的开机状态。

上述执行器切换检查点之后，`8bf6c20`静态站点已发布，正式前端现为59个可执行节点（4浏览器 / 56远端，Python重叠）。[本轮73项HTTPS/Chrome检查](../data/audit/b37-site-runtime-checks.json)及[公开数据一致性](../data/audit/b37-site-consistency.json)通过；[6项服务检查](../data/audit/b37-site-service-checks.json)确认申请路由及只读MCP新配置快照。GitHub输入分批上传及master/Actions仍在收尾。`data/audit/runtime-rollout.json`保留原逐门临时验收记录，不改写历史。

本轮静态发布补记：Groovy档案8秒与无硬编码3秒超时文案已随新页面发布。新增权限申请路由只追加到现有Nginx messages snippet，主虚拟主机不变；只验证availability和无效请求，没有发送有效申请或真实测试邮件。本次保留活数据库与旧站，执行器PID不变，详见 [站点部署与回退记录](DEPLOYMENT.md)。上述执行器章节内的“尚未发布/提交”是当时检查点；本轮站点已上线，Git/CI状态仍须分别收尾确认。
