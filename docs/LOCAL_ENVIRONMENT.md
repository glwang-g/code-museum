# 本机与真实运行环境

本机开发环境只负责离线构建、静态预览和浏览器本地运行时核验；它不等同于正式 Linux Docker 执行器。

## 本轮环境快照（2026-11-11）

本轮文档校对所处环境为 `arm64`、macOS 27.2、Node.js 25.8.0、Python 3.14.7；可找到Docker CLI、rsync和tar，未找到Colima、Lima和qemu-img。这里只记录当前执行环境，不代表所有维护者设备；Docker CLI存在也不证明Docker daemon已启动或可用。本轮未启动或安装虚拟机。

旧文档中的Intel MacBook Pro / Ventura及Colima安装情况是早期设备记录，不适合作为当前开发前提。离线网站构建不需要本机Docker；生产工具链运行在已核验的 `linux/amd64` 远端环境。

## 推荐验证层次

1. **离线源码层**：`npm test`、`npm run build`，完整默认测试需Node.js 22+、Python 3、rsync及可写临时目录，无需访问公网、下载或Docker；部分HTTP测试监听本机回环地址。
2. **本机浏览器层**：安装Chrome/Chromium后，启动 `PORT=4191 npm run preview`，执行 `npm run site:browser`、`npm run learning:browser`、`node scripts/check-explore-reading.cjs`；`npm run controls:browser`、`npm run credits:browser`自建临时预览。普通静态预览不读取模型密钥，也不提供远端执行后端；模型服务另见 [按需检查说明](AI_EXPLANATIONS.md)。
3. **真实双节点层**：`npm run executor:browser`默认按完整56门分配清单，通过SSH在xshow、xshow2准备临时guest/runsc联调；默认浏览器执行场景仍为Python、Ruby、C、C++、Rust、Go、Java七门，逐一运行全56门使用 [guest专项](GUEST_EXECUTION.md)。流程会上传执行器模块、固定镜像清单、五份公开馆藏数据及测试程序，并建立临时服务、隔离容器和隧道。须预先准备两台固定镜像和runsc，按 [双节点说明](DUAL_NODE_DEPLOYMENT.md) 与 [免令牌验收](GUEST_EXECUTION.md) 执行，不自动安装常驻服务或切换生产入口。旧 `executor:preview` / `executor:dual-preview` 默认私有模式，仅供相应历史专项，不作为当前免令牌网页的通用预览。
4. **生产只读层**：`npm run executor:production-check`只读取正式HTTPS的运行时清单和公开构建证据，不提交代码、不上传源码、不消耗执行配额，也不需要执行令牌。需要真实生产执行时，`EXECUTOR_BROWSER_ORIGIN=https://codemuseum.freexlib.com npm run executor:browser`显式指定正式站；它会提交固定测试程序并消耗实际资源，不属于只读检查，不允许平台故障注入模式。

生产运行时的版本、镜像来源、内存和编译/运行预算以 `server/runtime-images.json`、`docs/EXECUTOR.md` 和 `/api/runtimes` 的一致性检查为准。ARM 或旧 macOS 本机不能直接代替已核验的 `linux/amd64` 生产环境。
