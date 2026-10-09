# 本机与真实运行环境

本机开发环境只负责离线构建、静态预览和浏览器本地运行时核验；它不等同于正式 Linux Docker 执行器。

## 当前 Mac 限制

当前开发机是 Intel MacBook Pro（2017，`MacBookPro14,3`），运行 macOS Ventura 13.7.8。该系统/机型组合无法使用当前 OrbStack 版本，Docker Desktop 当前安装包也不提供适配版本。不要把“本机没有 Docker”解释为网页或生产执行器故障。

本机已经安装 Docker CLI、Lima 和 Colima，但 Colima 的 QEMU 路径还缺少可用的 `qemu-img`，因此不作为默认开发前提。安装 QEMU 会牵涉额外下载和较重的本机依赖；未成功启动前不把 Colima 视为已核验的 Linux 执行环境。

## 推荐验证层次

1. **离线源码层**：`npm test`、`npm run build`，不联网、不需要 Docker。
2. **本机浏览器层**：有 Chrome/Chromium 时执行 `npm run runtime:browser`，只核验浏览器 Worker、静态资源和页面交互。
3. **真实执行层**：通过已有 SSH 连接使用 `npm run executor:browser`，让远端 Linux/Docker 提供 Python、Ruby、C、C++、Rust、Go、Java。该流程不会把本地项目源码作为核验输入发送；仅使用脚本内置的最小测试程序。
4. **生产只读层**：`npm run executor:production-check` 只读取正式 HTTPS 的运行时清单和公开构建证据，不提交代码、不上传源码、不消耗执行配额，也不需要执行令牌。

生产运行时的版本、镜像来源、内存和编译/运行预算以 `server/runtime-images.json`、`docs/EXECUTOR.md` 和 `/api/runtimes` 的一致性检查为准。ARM 或旧 macOS 本机不能直接代替已核验的 `linux/amd64` 生产环境。
