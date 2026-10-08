# Docker 私有执行首版

本轮实现 Python、Ruby 原生远端执行，先完成SSH私有原型核验，随后按用户指令准备正式域名上的令牌访问部署。Linux 执行服务使用 Python 标准库，不需要 pip/npm 依赖。网站仍可完全离线构建，构建不会启动 Docker、拉镜像或连接服务器。

## 本机试看（xshow）

前提：本机 Node.js ≥22、SSH alias `xshow` 可连接；远端有 Python 3、Docker、cgroup v2 和清单中两个固定 linux/amd64 镜像。原型核验已在xshow准备镜像；若常驻服务已安装，请使用正式站点，不同时启动临时原型。

```sh
npm run build
export EXECUTOR_TOKEN="$(openssl rand -hex 32)"
npm run executor:preview
```

打开 **http://127.0.0.1:4174/#lab**，切换到 Python 或 Ruby。在启动预览的终端用 `printf '%s\n' "$EXECUTOR_TOKEN"` 查看令牌，复制到网页「私有执行令牌」，点击「运行代码」。令牌只留在当前页面内存中，不写浏览器存储、URL、项目文件或执行日志。

预览程序将本地后端源码和镜像清单通过 SSH stdin 传入远端独立临时目录，启动仅 loopback 可访问的服务，并通过同一 SSH 连接转发。端口冲突会报错，不终止已有服务。Ctrl+C 关闭自己的预览和临时服务、删除临时源码目录；SSH stdin 断开也触发清理，单次试用最长30分钟。网络故障时清理可能延迟到连接断开或到期。Docker 镜像作为显式准备的缓存保留。

可用 `PORT=4175`、`EXECUTOR_SSH_HOST=另一SSH别名`、`EXECUTOR_REMOTE_PORT=4188` 修改配置。后端通过同一个默认锁禁止多实例并行；不能同时运行集成核验和试用。它会清理本执行器标签的旧容器，不操作其他 Docker 容器。

## 交互与边界

- Python、Ruby 默认远端；只在点击运行时上传代码与可选标准输入，编辑不提交。切换语言、离开实验台、编辑正在执行的代码或点取消都会请求停止任务。
- Python 可切换浏览器本地，明确点击「下载并启用」后使用现有 Pyodide。Lua/ Scheme 也需明确启用；JavaScript 使用浏览器原生引擎。
- Ruby 本地选项禁用，本轮没有接入 ruby.wasm。无远端服务时显示未连接，不伪造结果、不自动回退或下载运行时。
- 本地模式启用后编辑会自动执行；远端一直需要手动运行。标准输入控件只供远端使用。
- 远端为独立、临时环境；不保留上次变量、不安装用户依赖。Python `-I` 隔离解释器配置。Ruby 使用 StringIO 提供标准输入，并非完整交互终端。
- 网页展示原生 Docker 运行时版本/镜像来源；本地模式显示 Pyodide、Wasmoon 或 BiwaScheme 的实际归属。远端不冒充 Wasm。

## 固定镜像与独立 Linux 启动

镜像身份、平台、实际版本及来源见 `server/runtime-images.json`。当前实测 Python 3.13.16、Ruby 3.4.11。Docker Official Images 来自官方 python/ruby 镜像项目；Python 按 PSF 许可，Ruby 按 Ruby/BSD 许可，镜像基础系统和依赖各自保留许可。来源入口：

- https://hub.docker.com/_/python ，https://github.com/docker-library/python ，https://docs.python.org/3/license.html
- https://hub.docker.com/_/ruby ，https://github.com/docker-library/ruby ，https://www.ruby-lang.org/en/about/license.txt

新主机需管理员明确执行准备步骤（有网络），然后运行时/构建无需下载：

```sh
python3 - <<'PY'
import json, subprocess
for r in json.load(open('server/runtime-images.json'))['runtimes']:
    subprocess.run(['docker','pull','--platform=linux/'+r['architecture'],r['image']],check=True)
PY
export EXECUTOR_TOKEN="$(openssl rand -hex 32)"
python3 server/executor.py --port 4181 --origin http://127.0.0.1:4173
```

另一个终端启动同源代理：

```sh
EXECUTOR_UPSTREAM=http://127.0.0.1:4181 npm run preview
```

仅支持 loopback HTTP 上游。未准备镜像、平台/身份不匹配、缺资源控制、清理失败会拒绝服务，不自动 pull。ARM 主机需另外核实固定镜像和平台，不能直接改架构字段冒充已验证。

## 资源限制

| 项目 | 首版限制 |
|---|---|
| 并发 / 排队 | 1 / 最多10个；排队超30秒取消 |
| 执行 | Docker start 与代码最多3秒；create另有8秒超时；宿主 watchdog 12秒硬租约并处理清理 |
| 内存 | Python 256 MiB；Ruby 512 MiB；不额外提供 swap |
| CPU / 进程 / 文件描述符 | 1核 / 32 / 64 |
| 文件系统 | 只读根；/work 16 MiB、/tmp 8 MiB tmpfs，noexec/nosuid/nodev |
| 网络 / 用户 / 权限 | 禁网、uid65534、cap-drop ALL、no-new-privileges、Docker默认seccomp |
| 源码 / stdin / HTTP body | 64 KiB / 16 KiB / 96 KiB，按UTF-8字节 |
| stdout + stderr | 合计32 KiB，包括非法UTF-8替换后的结果 |
| 配额 / 结果查询 | 每session每分钟10次、全局30次；最多100记录，完成结果可查询5分钟 |

任务状态包括 completed、failed、timed_out、cancelled、output_limit、memory_limit、infrastructure_error。源码与输入仅在任务内存和临时容器中使用，完成后从任务记录删除；标准输出/错误可能含用户输入，仍应视为敏感数据。结果超过5分钟不可查询，在新任务提交时移除过期内存记录，服务退出时全部释放；并非定时落盘或精确到秒的内存擦除。无代码日志和 Docker 输出日志。当前配额按私有会话计算，不是公开用户身份认证。

## 核验与证据

```sh
npm test
npm run build
npm run runtime:browser          # 本机真实浏览器回归
npm run executor:check           # 在准备好的Linux Docker主机上执行
npm run executor:browser         # 本机Chrome -> SSH xshow -> Docker
```

`executor:check` 自建临时 loopback API，核验真实输出、错误、禁网、只读根、tmpfs容量、非root/NNP、内存/进程/输出上限、超时、owner隔离、取消、配额、API SIGKILL后清理；最终检查本执行器容器零残留。`executor:browser` 自建私有预览，检查 Python/Ruby 真实输出与stdin、错误、取消恢复、编辑不提交、默认无Pyodide下载和明确启用后的本地执行；保存1440/390截图。不下载浏览器，报告不存令牌、session或任务ID。

记录：`data/audit/executor-checks.json`、`data/audit/executor-browser-checks.json`、`data/audit/execution-modes-browser-checks.json`。记录与源码SHA绑定；截图在核验输出目录中。默认测试只用调度替身核验结构，真实执行证据来自上述可选集成检查。

## 常驻服务与管理员部署

管理员安装入口为 `sudo python3 deploy/install-executor.py`。从审核后的源码目录执行，先验证已准备的固定镜像，备份当前Code Museum Nginx配置与执行服务文件，再安装独立nologin服务账户、root拥有的 `/opt/code-museum-executor` 代码、root-only令牌环境文件和systemd开机自启服务。执行服务本身需要Docker管理权限（仅服务进程的SupplementaryGroups），不增加网站或CI账户的Docker权限。Docker管理权限近似宿主root权限。配置检查/启动失败回滚已备份的代码与配置；新账户/令牌作为禁用的安装准备保留，不删除用户数据。

执行服务与静态release独立升级：GitHub Actions上传后端源码供核对，但不会自动运行部署账户可写的Python代码或重启Docker执行服务。后端更新由管理员审核后重新运行安装入口。令牌保存在 `/etc/code-museum-executor/private.env`（root:root 0600），不写GitHub Secret、静态文件或浏览器存储。API只在127.0.0.1:4181监听，同源HTTPS经Nginx转发；执行仍必须Bearer令牌及session，未开放匿名执行。Nginx不记录该API访问日志，关闭请求/响应缓冲，避免源码写入代理临时文件。

管理员在自己的终端取令牌（不要把输出提交Git或贴入公开渠道）：

```sh
ssh xshow "sudo -n cat /etc/code-museum-executor/private.env"
```

取等号后的值粘贴到正式站点实验台的私有令牌输入框。常驻执行服务与临时SSH原型共用singleton锁；**常驻服务运行时不要启动原型或Docker集成检查**，它们不是相互隔离的并行实例。正式HTTPS检查可执行：

```sh
EXECUTOR_BROWSER_ORIGIN=https://codemuseum.freexlib.com npm run executor:browser
```

脚本从现有管理员SSH连接读取令牌到内存，不打印或写文件，不停止常驻服务。以上是本轮部署准备与管理约定；最终上线状态另见DEPLOYMENT.md的实际记录。

普通 Docker runc 共享宿主内核，本轮限制实测不等于容器逃逸防护证明。当前只适合自己信任的私有试用。公开匿名执行前应使用独立执行机器/VM与更强沙箱（例如额外安装并核验 gVisor/runsc），加入真正用户认证、IP/用户配额、监控及故障恢复；现有 `--runtime runsc` 参数只是接口，尚未安装或验证 runsc。不能将模板或私有试用称为已经公开上线。
