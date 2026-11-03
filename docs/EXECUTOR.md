# Docker 私有执行首版

当前源码支持 Python、Ruby、R 原生远端执行，C、C++、Rust、Go、Java、C#、Fortran、Pascal 的编译后执行，以及 TypeScript、SQL（SQLite）、Bash、AWK、sed、PHP、Perl、XSLT（libxslt），共 19 门。当前 19 门已于 2026-11-03 升级生产执行服务；P1 新增十二门的正式 HTTPS 记录见下文。Linux 执行服务使用 Python 标准库，不需要 pip/npm 依赖。网站仍可完全离线构建，构建不会启动 Docker、拉镜像或连接服务器。

## 2026-11-03：Pascal、R（本机与生产已核验）

两门使用独立的固定镜像。`server/runtimes/pascal-r/` 保存 14 个 Debian 12 官方发行包及依赖（约 40.4 MB）、原始版权文件、来源/版本/SHA-256 清单和 Dockerfile，复用已缓存且 digest 固定的官方 GCC / Debian 12 基础镜像。准备时以 `--network=none` 执行 `dpkg -i`，不读取软件源；网站构建只离线校验文件。采用该发行版本是为了固定与基础镜像兼容的工具链，不宣称最新版本。

| 馆藏 ID | 真实实现 | 首版范围 |
| --- | --- | --- |
| `pascal` | Free Pascal 3.2.2，Debian `3.2.2+dfsg-20` | 单文件；`-n -Mobjfpc -Sh -O-`，不读取配置文件，显式使用预装基础 RTL；编译成功后才执行，诊断与运行输出分开。默认 ObjFPC 模式和 AnsiString，不保证 ISO Pascal、Turbo Pascal 或其他历史版本兼容。编译 10 秒、运行 3 秒、512 MiB。 |
| `r` | Rscript / R 4.2.2 Patched，Debian `4.2.2.20221110-2` | 单文件；`--vanilla --default-packages=stats,utils`，不读取启动配置和历史工作区；可使用预装基础包，任务不安装 CRAN 包。文本输出；绘图和文件不导出。使用 `file("stdin")` 或 `scan("stdin", ...)` 读取进程标准输入，`stdin()` 不是交互终端。运行 3 秒、512 MiB。 |

R 启动实测需要 `nofile=256`，64 会报告文件数上限过低；其余解释脚本容器仍为 64。R 的 `/work` 16 MiB、`/tmp` 8 MiB 均 noexec，Pascal 沿用编译容器的可执行临时工作区。两门均禁网、非 root、只读根、无宿主挂载、限制输出及进程数量，超时或取消销毁任务容器。R 镜像内的 BLAS/OpenMP 线程数固定为 1。资源限制不等于对抗恶意代码的完整安全边界。

真实容器回归见 [p1-runtime-checks.json](../data/audit/p1-runtime-checks.json)：72 项，含两门的修改源码后真实执行、错误、多行中文输入、超时、输出上限、取消、任务隔离和恢复，以及前十门回归和 Perl 中文源码；结束残留容器为 0。旧 52 项记录仍保留为前两批快照。

[真实浏览器专项](../data/audit/p1-runtime-browser-checks.json) 36 项通过：覆盖十二门的 1440/390 实际执行、明暗主题、Pascal 编译错误不执行及恢复、R 多行中文输入/实际版本/错误恢复、地图和档案入口。已查看 Pascal/R 的两档截图。`npm test` 83/83 与离线构建通过；这份记录为临时 API 核验；随后完成的生产上线与核验见下一段。

生产补记：实现提交 `a585bc0` 的 [Actions 41575243748](https://github.com/glwang-g/code-museum/actions/runs/41575243748) 构建与部署成功，管理员安装器随后将执行服务从 7 门升级到 19 门。[部署记录](../data/audit/p1-executor-deployment.json)、[正式 HTTPS 浏览器记录](../data/audit/p1-production-browser-checks.json) 36 项、[服务检查](../data/audit/p1-production-service-checks.json) 13 项及[生产一致性](../data/audit/p1-production-consistency.json)均通过。原令牌、原指标起始时间和 13 条既有聚合任务记录保留；备份在 `/var/backups/code-museum-executor/20261103T042729Z`。匿名执行仍被拒绝，微信扫码授权尚未接入。

显式准备与复测（不部署生产）：

```sh
npm run runtime:pascal-r-build -- --ssh-host xshow --write-manifest
npm run runtime:cli-check -- --ssh-host xshow --output data/audit/p1-runtime-checks.json
npm run build
BROWSER_CHECK_OUTPUT=tmp/p1-browser npm run runtime:cli-browser
```

完整 P1 检查还要求原先的 CLI、.NET、GCC 等固定镜像已缓存。每个新主机都需运行显式构建并核对其实际镜像 ID；不能对项目 image ID 执行 `docker pull`，也不能只改清单冒充兼容。基础包出处见 [固定清单](../server/runtimes/pascal-r/manifest.json) 和 [许可说明](../server/runtimes/pascal-r/NOTICE.md)；语义边界依据 [ObjFPC 模式](https://docs.freepascal.org/daily/doc/prog/progse76.html) 与 [Rscript 标准输入约定](https://stat.ethz.ch/R-manual/R-devel/library/utils/html/Rscript.html)。

## 2026-11-02：PHP、Perl、XSLT、C#、Fortran（临时环境核验）

本批延续固定执行协议。PHP、Perl、libxslt 作为新增 APK 纳入 `server/runtimes/cli/` 的同一离线镜像，来源、许可、哈希和 aports 配方入口记录在 `manifest.json`；C# 使用固定 digest 的官方 .NET SDK 镜像，Fortran 复用已有的官方 GCC 镜像（其中已包含 GNU Fortran），二者不新增仓库内大体积资产。新增 APK 合计约 12.7 MB，`server/runtimes/cli/` 约 20 MB。

| 馆藏 ID | 真实实现 | 首版范围 |
| --- | --- | --- |
| `php` | PHP 8.3.36 CLI | 单文件；`-n` 最小配置，禁用系统命令与网络函数，`open_basedir` 限制在 `/work`、`/tmp`；不开放 Web 服务、外部扩展或在线安装。 |
| `perl` | Perl 5.42.2 | 单文件；UTF-8 标准输入输出；源码含中文字符串时须声明 `use utf8;`，默认示例已声明；只使用预装核心模块，不安装 CPAN 包。 |
| `xslt` | libxslt 1.1.43 / libxml2 2.13.9 | XSLT 1.0，不是 2.0/3.0；编辑区为样式表，标准输入为 XML 文档；`--nonet --nowrite --nomkdir`，禁网并禁止写出。容器不挂载宿主文件，但容器内只读运行时文件仍可能被 `document()` 读取；任务结束销毁容器。 |
| `csharp` | .NET SDK 10.0.403 / Roslyn | 单文件；直接调用固定 Roslyn `csc.dll` 与预装参考程序集，编译成功后才运行；任务期间不还原 NuGet 包。 |
| `fortran` | GNU Fortran (GCC) 14.3.0 | 单文件；`-std=f2008 -O0 -Wall -Wextra`；使用官方 GCC 镜像内已有编译器，不另外存储工具链。 |

C# 的编译环境需要比解释器更高的文件描述符和文件大小上限（`nofile=256`、`fsize=64 MiB`），否则 Roslyn 在受限容器中会异常退出；其余限制与其他编译语言一致。C# 的 `/work/refs.rsp` 由固定准备步骤生成，运行使用 SDK 自带的 `dotnet.runtimeconfig.json`，二者随固定镜像 digest 绑定；升级 SDK 镜像时必须同步更新 Roslyn、参考程序集和 runtimeconfig 路径并重新核验。

本批实际容器记录已写入 [cli-runtime-checks.json](../data/audit/cli-runtime-checks.json)：累计 52 项真实容器检查，新增覆盖 PHP 算术、多行输入、语法错误、禁用系统命令和 `open_basedir` 文件读取拦截；Perl 算术、多行输入和语法错误；XSLT 1.0 两种转换和非法 XPath；Fortran 编译执行、修改源码后输出变化、编译错误不执行、超时终止；C# 编译执行、修改源码、多行输入、编译错误不执行、缺少 NuGet 包时拒绝、超时终止。浏览器专项记录见 [cli-runtime-browser-checks.json](../data/audit/cli-runtime-browser-checks.json)，覆盖 1440/390 两种宽度、明暗主题、十门（原五门加新五门）的真实远端执行、编译诊断、地图入口与出处入口；不把临时核验当作生产上线。

## 2026-11-02 首批：TypeScript、SQLite、Bash、AWK、sed（临时环境核验）

新增工具链位于 `server/runtimes/cli/`，包含固定官方 TypeScript 发行包、签名 Alpine APK 及依赖、来源/许可/哈希清单与 Dockerfile；合计约 7.1 MB。源码构建只校验这些固定输入，不运行 Docker；浏览器也不下载它们。显式准备镜像需要事先缓存清单中的 Node 基础镜像，之后 `RUN` 阶段禁网、不读取软件源、不执行 npm install 或在线依赖恢复。新镜像使用实际构建的不可变 image ID，和原七门的官方仓库 digest 分开标注。

| 馆藏 ID | 真实实现 | 首版范围 |
| --- | --- | --- |
| `typescript` | TypeScript 5.9.3 / Node.js 22.23.2 | 单文件；`strict`、`noEmitOnError`、ES2022、CommonJS、ES2022/DOM 声明库；完整类型检查失败不运行 JS。DOM 声明只提供类型，Node 不提供浏览器 DOM。未预装 `@types/node` 或第三方包，不支持用户在线安装依赖。编译 15 秒、运行 3 秒、512 MiB。 |
| `sql` | SQLite 3.53.4 | 地图 SQL 节点的 SQLite 方言；编辑区 SQL 经真实 CLI 标准输入执行，每次独立 `:memory:` 库，禁用 `.shell`、外部文件与扩展加载。不使用另一个标准输入；不等同于所有 SQL 标准或 PL/SQL。 |
| `bash` | GNU Bash 5.3.9 | 无 profile/rc，脚本在容器内执行；支持多行文本标准输入，不访问宿主命令或文件。 |
| `awk` | GNU awk 5.3.2 | 编辑区为程序，标准输入为待处理文本；不冒充原始 AWK 或所有实现。 |
| `sed` | GNU sed 4.9 | 编辑区为脚本，标准输入为待处理文本；无输入时可以正确地没有输出。 |

后四门运行 3 秒、256 MiB、32 进程、`/work` 16 MiB 且 noexec；脚本由解释器读取。TypeScript 沿用编译容器限制。任务均禁网、非 root、只读根、无宿主挂载；源码通过 stdin 流入固定文件，结束销毁临时容器。多行标准输入不写入分享 URL。

明确准备与核验（不部署生产）：

```sh
npm run runtime:cli-build -- --ssh-host xshow --write-manifest
npm run runtime:cli-check -- --ssh-host xshow --output data/audit/cli-runtime-checks.json
npm run build
npm run runtime:cli-browser
```

不传 `--ssh-host` 时在当前 Linux Docker 主机准备或核验。新主机先显式准备 `manifest.json` 中的基础镜像，不要对项目本地 image ID 执行 `docker pull`。`--write-manifest` 记录本次实际镜像 ID 和版本；不同构建主机或 Docker 版本得到的 image ID 必须重新核验、同步清单，不能只改字段冒充兼容。旧镜像、旧正式 API 或缺镜像均不触发自动下载或本地回退。

真实容器记录见 [cli-runtime-checks.json](../data/audit/cli-runtime-checks.json)，覆盖类型拒绝、SQLite 安全模式/任务隔离、脚本多行输入、真实错误、五语言超时、输出上限及取消恢复。`runtime:cli-browser` 使用独立临时 API 与本机 Chrome，截图不等于生产上线。部署仍需准备已核镜像并审核升级执行服务和静态站点，不能只推送前端就认为生产获得新运行时。

首批结果：31 项真实容器检查、17 项实际 Chrome 专项通过（两份记录现已分别累计 52 项与 27 项，首批结果为其中子集）；[浏览器记录](../data/audit/cli-runtime-browser-checks.json)绑定最终源码和被服务资源哈希。另有 80 项默认测试、离线构建及完整本地浏览器回归 34/34 通过。旧回归的“13 张来源卡片”改为逐个核对完整 ID 集合；Bash 的旧“仅编辑”断言同步更新为“远端已配置、无 API 时不允许运行且不伪造输出”，新版默认程序另经本机实际执行，不跳过原有核验。

## 本机试看（xshow）

前提：本机 Node.js ≥22、SSH alias `xshow` 可连接；远端有 Python 3、Docker、cgroup v2 和清单中固定 linux/amd64 镜像。原型核验已在xshow准备镜像；预览和集成核验采用独立随机命名空间/锁，不清理生产容器。

```sh
npm run build
export EXECUTOR_TOKEN="$(openssl rand -hex 32)"
npm run executor:preview
```

打开 **http://127.0.0.1:4174/#lab**，选择已经准备好的远端语言。在启动预览的终端用 `printf '%s\n' "$EXECUTOR_TOKEN"` 查看令牌，复制到网页「私有执行令牌」，点击「运行代码」。令牌只留在当前页面内存中，不写浏览器存储、URL、项目文件或执行日志。

预览程序将本地后端源码和镜像清单通过 SSH stdin 传入远端独立临时目录，启动仅 loopback 可访问的服务，并通过同一 SSH 连接转发。端口冲突会报错，不终止已有服务。Ctrl+C 关闭自己的预览和临时服务、删除临时源码目录；SSH stdin 断开也触发清理，单次试用最长30分钟。网络故障时清理可能延迟到连接断开或到期。Docker 镜像作为显式准备的缓存保留。

可用 `PORT=4175`、`EXECUTOR_SSH_HOST=另一SSH别名`、`EXECUTOR_REMOTE_PORT=4188` 修改配置。生产默认锁禁止生产多实例；预览/集成检查有独立随机锁和容器标签。各实例只清理自己的容器，不操作其他 Docker 容器。

## 交互与边界

- 清单中的 19 门语言默认远端；只在点击运行时上传代码与可选标准输入，编辑不提交。切换语言、离开实验台、编辑正在执行的代码或点取消都会请求停止任务。
- Python 可切换浏览器本地，明确点击「下载并启用」后使用现有 Pyodide。Lua/ Scheme 也需明确启用；JavaScript 使用浏览器原生引擎。
- Ruby 本地选项禁用，本轮没有接入 ruby.wasm。无远端服务时显示未连接，不伪造结果、不自动回退或下载运行时。
- 本地模式启用后编辑会自动执行；远端一直需要手动运行。标准输入控件只供远端使用。
- 远端为独立、临时环境；不保留上次变量、不安装用户依赖。Python `-I` 隔离解释器配置。Ruby 使用 StringIO 提供标准输入，并非完整交互终端。
- 网页展示原生 Docker 运行时版本/镜像来源；本地模式显示 Pyodide、Wasmoon 或 BiwaScheme 的实际归属。远端不冒充 Wasm。

## 固定镜像与独立 Linux 启动

镜像身份、平台、实际版本及来源见 `server/runtime-images.json`。当前实测 Python 3.13.16、Ruby 3.4.11、GCC/G++ 14.3.0、rustc 1.99.0、Go 1.27.2、javac 17.0.20.1。C按C11、C++按C++17、Rust按2021 edition、Java按--release17编译；Java入口类名Museum。编译语言仅单文件和预装标准库，不联网下载依赖。Docker Official Images 来自官方 python/ruby 镜像项目；Python 按 PSF 许可，Ruby 按 Ruby/BSD 许可，镜像基础系统和依赖各自保留许可。来源入口：

- https://hub.docker.com/_/python ，https://github.com/docker-library/python ，https://docs.python.org/3/license.html
- https://hub.docker.com/_/ruby ，https://github.com/docker-library/ruby ，https://www.ruby-lang.org/en/about/license.txt

新主机需管理员明确执行准备步骤（有网络），然后运行时/构建无需下载：

```sh
python3 - <<'PY'
import json, subprocess
for r in json.load(open('server/runtime-images.json'))['runtimes']:
    if r['image'].startswith('sha256:'): continue  # 项目镜像需按上文显式离线构建
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
| 执行 | 运行3秒；C/C++/Fortran编译10秒、Rust/Java15秒、Go30秒、C#30秒；create8秒、启动3秒/源码传入8秒；解释器watchdog12秒、编译容器60秒租约 |
| 内存 | Python256MiB；Ruby/C/C++/Fortran512MiB；Rust/Go/Java768MiB；C#1024MiB；不额外提供swap；Java堆256MiB |
| CPU / 进程 / 文件描述符 | 1核 / 解释器32、编译环境128 / 64（C#为256）；文件大小上限16MiB（C#为64MiB） |
| 文件系统 | 只读根；解释器/work16MiB、/tmp8MiB均noexec；编译环境各128MiB，/work允许执行容器内产物、/tmp仍noexec；均nosuid/nodev |
| 网络 / 用户 / 权限 | 禁网、uid65534、cap-drop ALL、no-new-privileges、Docker默认seccomp |
| 源码 / stdin / HTTP body | 64 KiB / 16 KiB / 96 KiB，按UTF-8字节 |
| compilerStdout + compilerStderr + stdout + stderr | 合计32 KiB，包括非法UTF-8替换后的结果 |
| 配额 / 结果查询 | 每session每分钟10次、全局30次；最多100记录，完成结果可查询5分钟 |

任务状态包括 queued、compiling、running、completed、failed、compile_error、compile_timed_out、timed_out、cancelled、output_limit、memory_limit、infrastructure_error。源码与输入仅在任务内存和临时容器中使用，完成后从任务记录删除；标准输出/错误可能含用户输入，仍应视为敏感数据。结果超过5分钟不可查询，在新任务提交时移除过期内存记录，服务退出时全部释放；并非定时落盘或精确到秒的内存擦除。无代码日志和 Docker 输出日志。当前配额按私有会话计算，不是公开用户身份认证。

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

取等号后的值粘贴到正式站点实验台的私有令牌输入框。生产保持自己的singleton锁；本版临时预览和集成检查使用独立namespace、锁、容器前缀/标签，可与生产服务共存。旧版脚本仍共用生产标记，不得混用。正式HTTPS检查可执行：

```sh
EXECUTOR_BROWSER_ORIGIN=https://codemuseum.freexlib.com npm run executor:browser
```

脚本从现有管理员SSH连接读取令牌到内存，不打印或写文件，不停止常驻服务。以上是本轮部署准备与管理约定；最终上线状态另见DEPLOYMENT.md的实际记录。

普通 Docker runc 共享宿主内核，本轮限制实测不等于容器逃逸防护证明。当前只适合自己信任的私有试用。公开匿名执行前应使用独立执行机器/VM与更强沙箱（例如额外安装并核验 gVisor/runsc），加入真正用户认证、IP/用户配额、监控及故障恢复；现有 `--runtime runsc` 参数只是接口，尚未安装或验证 runsc。不能将模板或私有试用称为已经公开上线。

## 编译阶段与新增核验

源码通过docker exec的标准输入写入容器tmpfs，未写宿主源码文件、无宿主挂载。固定白名单编译命令与运行命令分别计时，返回compileMs/runMs/phase；编译失败或超时不启动用户程序。编译诊断和程序输出合计32KiB。超时/输出过量/取消先终止docker客户端管道，再强制移除容器；宿主watchdog处理API死亡。新程序的二进制/类文件只在容器内执行，最后随容器销毁。Go每次冷编译，首版没有跨用户共享可写缓存。

真实Docker检查记录见data/audit/executor-compiled-checks.json；覆盖五语言真实编译/输出/stdin、编译诊断、运行超时和输出上限，保留Python/Ruby限制回归。普通Docker共享内核，资源限制实测不证明容器逃逸防护。

## 分阶段结果字段（2026-10-09）

- `compilerStdout` / `compilerStderr`：仅编译器诊断；`stdout` / `stderr`：程序执行阶段输出。编译失败后程序字段为空，不把诊断伪装成程序输出。
- `queueMs`：接收任务至调度开始的单调时钟实测毫秒；排队取消也记录已等待时间。
- `compileMs` / `runMs`：存在对应阶段才返回；解释器只有运行阶段。包含Docker客户端/解释器启动等阶段开销，不是CPU时间。
- `elapsedMs`：调度开始后容器准备、传入源码、编译及执行等耗时，不含排队，不含最后销毁容器的时间；不能由compileMs/runMs简单相加替代。

四项输出仍共享32KiB总上限，UTF-8替换扩张仍计入总预算，原任务认证/配额/容器限制保持。自定义API客户端应读取新增编译字段；网页独立展示诊断与程序输出。新一轮检查使用独立报告，不覆写前批证据。


## 聚合服务状态

`GET /api/executor-status`需要原私有执行Bearer及32位十六进制X-Execution-Session，同源校验沿用执行接口；不会返回任务内容、ID或所有者。网页实验台远端访问区展开「服务状态」并显式刷新，不自动探测令牌。

返回队列数、活动数、进程启动/运行时间与累计终态任务。SQLite `/var/lib/code-museum-executor/metrics.sqlite`属于执行专用账号，目录0700，systemd UMask0077；独立于release，安装器用SQLite backup保存已有数据，不清零。每个语言/终态只有一行聚合，没有单任务表；保存数量及排队/编译/运行的总耗时与样本数。不存在的阶段不记零，均值表示已有阶段的样本。程序错误、编译错误、两种超时、取消、输出/内存上限与环境故障独立统计。

统计从新版启用开始，不补算此前历史。API拒绝不计任务，未结束/进程强杀的任务可能漏记；SQLite写失败只增加本次进程的漏记警告。它是执行汇总而非完整可用率/SLO；暂未接入告警、时序窗口、趋势或外部监控。源码/stdin/stdout/stderr仍只在任务原有内存/容器生命周期内，不进入统计数据库。

HTTPS只读MCP复用该进程，见MCP.md；不会扩大CI或网站账号的Docker权限。管理员升级需要部署五份后端模块、unit和Nginx片段；安装器备份/回滚原文件，并在reload前验证私有指标与五个只读工具。聚合数据库保留，不随代码回滚删除。
