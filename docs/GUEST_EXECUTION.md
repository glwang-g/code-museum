# 免令牌执行与容量限制

2026-11-09 用户选择：最多5个活跃执行会话免令牌使用，第6个提示“当前访问比较多，请稍后重试。”，不转到令牌或申请权限流程。本文记录实现和验收方法；是否已经部署以 `DEPLOYMENT.md` 最新实际记录为准。

## 访问规则

- 网关显式开启 `--guest-sessions 5`，默认值0仍为私有模式。页面只在实时元数据 `private:false` 且 `access.mode:guest` 时开放远端运行。
- 席位从有效的远端任务开始计算，闲置300秒释放。有效提交、本人任务查询和取消续期；浏览页面、读取运行环境、非法请求、跨会话查询不占席或续期。第6个会话收到429、中文提示和 `Retry-After`，页面不自动重投代码。
- 生产使用服务端签名的 `__Host-museum-execution` Cookie，`Secure; HttpOnly; SameSite=Strict; Path=/`。Cookie不进入URL、前端脚本、报告或数据库；SQLite只保存短期所有者哈希和过期时间。密钥轮换会使旧Cookie失效。
- 席位检查、每会话最多一个在途任务和路由创建放在同一个SQLite写事务中。更换客户端会话请求头不能改变guest身份。任务结果、查询及取消只能由所属会话访问。
- 每台worker仍只执行一个任务，两台总执行并发为2；其余已接收任务进入有界队列。现有全局30次/分钟、每会话10次/分钟、排队期限、源码/输入/输出及各语言编译/执行预算保留。席位数不等于容器数。
- 明确拒绝时释放本次新占的席位；worker可能已经接收但响应丢失时，保留身份和未知任务占位，返回 `retrySafe:false`。网关不自动重试POST或向另一节点重发。

这里统计活跃浏览器会话，不是在线人数。共用同一Cookie的页签共用席位，清除Cookie可能创建另一会话，无法据此识别真实用户。Nginx另按连接地址限制提交频率，不对任务轮询套用提交限流；后端不信任客户端提供的转发IP，也不保存原始IP。

## 移除的访问流程

网页移除令牌输入、运行权限申请和相关提示。`/api/access-requests` 返回410，不接收新申请，不再发送申请邮件；私有数据库中的历史申请表及原记录保留。普通留言、公开日志及留言邮件通知继续工作，不改SMTP凭据。

worker节点令牌、网关管理接口和只读MCP鉴权继续保留。`/api/executor-status` 与 `/mcp` 不开放给guest；页面“服务状态”仅读取公开运行环境可用性。旧管理员凭据保留在服务端，不下发到页面。

## 执行隔离

guest网关要求每个worker实时报告 `sandbox:{runtime:runsc}`；runc、缺少字段或不健康的节点不会接收匿名任务。worker API仍只在loopback监听、使用独立节点鉴权，xshow2通过既有受限SSH隧道接入。网关没有Docker权限。

固定平台依赖为gVisor `release-20261102.0` / x86_64 / systrap，归档大小及SHA-256/SHA-512、全部成员清单见 [固定清单](../server/deploy/gvisor-runtime.json)。管理员预先取得合法的官方归档，再离线运行：

```sh
sudo python3 deploy/install-guest-sandbox.py --archive /path/to/gvisor-x86_64.tar.bz2 --install
```

安装器验证完整归档与成员，保留runsc及侧边二进制的相对目录，只注册指定Docker运行时并reload；不改变Docker默认运行时，不restart Docker，不拉取镜像。写入前备份原配置，检查Docker进程及其他容器状态，失败恢复原配置。平台依赖由管理员安装，不参与网站构建；网站仍从Git中的固定输入离线复现。

继续使用非root、只读根、无网络、无宿主挂载、删除capabilities、no-new-privileges、CPU/内存/进程/tmpfs/输出/时间限制和任务结束销毁。更强隔离和资源检查不构成“没有逃逸漏洞”的保证；本轮只记录实际完成的检查，不声称全语言语义或完整攻防认证。gVisor安装布局与平台选项见[官方安装说明](https://gvisor.dev/docs/user_guide/install/)和[平台说明](https://gvisor.dev/docs/user_guide/platforms/)，Docker运行时reload契约见[官方Docker文档](https://docs.docker.com/reference/cli/dockerd/#configuration-reload-behavior)。

runsc的systrap辅助线程也计入宿主cgroup进程数。直接沿用解释类宿主32上限会使程序启动随机失败；实际对照记录见 [沙箱限制检查](../data/audit/guest-sandbox-checks.json)。runsc使用 `RLIMIT_NPROC` 保留用户任务32（解释类）/128（编译类）的进程及线程预算，宿主cgroup另以128/512约束沙箱与辅助线程总量；内存、CPU和其他限额保持原值。旧runc私有模式仍沿用原宿主进程限额。

## 复查

```sh
npm test
npm run build
# 两台已准备固定镜像与runsc；只用临时服务、凭据、隔离容器和隧道
node scripts/check-guest-executor.cjs --resources --output tmp/guest-executor/report.json
# 对已启动的临时guest预览进行真实Chrome页面验收
node scripts/check-guest-browser.cjs --origin http://127.0.0.1:PORT --fill-capacity
```

第一项集成默认逐一执行全部56门远端的固定正例；资源与生命周期检查使用明确的测试程序。第二项检查1440/390、真实Python/BCPL、无令牌/申请控件、HttpOnly Cookie、公开服务状态及第6个独立会话提示。`--fill-capacity`会暂占5席，应优先在独立临时网关执行。正式站验收使用显式 `--origin https://codemuseum.freexlib.com`，不会暂停生产节点或重启服务。历史私有API检查保留管理认证，不能向页面注入内部令牌。

受保护worker/gateway升级与普通静态发布分开进行，CI没有Docker或root执行器升级权限。先备份、停止接受新提交、等待现有任务排空，再由管理员更新并验收；保留原代码、unit、凭据及活数据库。回退不把旧SQLite快照倒灌到活数据库，也不删除镜像或运行全局prune。
