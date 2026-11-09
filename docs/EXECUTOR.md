# Docker 私有执行首版

## 当前访问方式变更（2026-11-09）

用户选择免令牌、最多5个活跃执行会话，第6个提示“当前访问比较多，请稍后重试。”。页面移除令牌输入和权限申请，内部worker、管理接口与MCP保留鉴权；详见 [免令牌说明](GUEST_EXECUTION.md)。guest开启须所有可用worker通过runsc健康检查，当前实际部署与验收结果见 [部署记录](DEPLOYMENT.md)。以下按既有历史阶段保留实现记录，其中旧版网页粘贴令牌的步骤已停用。

## 双节点私有发布历史

当前生产后端已于2026-11-09按用户授权升级为双节点56门私有远端执行：xshow 42门、xshow2 14门，统一网关沿用原同域 API 和私有令牌。10项常驻 canary、[63项正式 HTTPS/Chrome 检查](../data/audit/dual-node-production-checks.json)（精确元数据、56门逐一正例及6项既有页面检查）、[8项生命周期与故障恢复检查](../data/audit/dual-node-production-lifecycle.json)通过；[新服务已 active/enabled](../data/audit/dual-node-production-services.json)，旧执行器停用自启但保留回退。Groovy 当前运行预算8秒，含 JVM 启动与脚本编译，其余按各语言 API 预算。拓扑、v3清单和备份见 [双节点部署说明](DUAL_NODE_DEPLOYMENT.md)。

当前正式发布提交为`f2ff0bf`，已通过Actions部署，正式页面提供4门浏览器与56门私有远端，Python重叠，共59个可执行节点。[本轮73项正式HTTPS/Chrome检查](../data/audit/b37-site-runtime-checks.json)包含56门逐一真实正例、BCPL/Oberon/Groovy/Swift/Dart/VHDL/PostScript在1440/390页面的执行，以及Python真实错误与恢复；[公开数据一致性](../data/audit/b37-site-consistency.json)通过。Groovy新页面使用8秒预算文案。版本和边界见各节；[逐门记录](../data/audit/runtime-rollout.json)仍保留临时验收阶段，不改写历史。公开固定输入已推送master，[正式Actions](https://github.com/glwang-g/code-museum/actions/runs/42603930037)的build/deploy及[CI后核验](../data/audit/b37-ci-release.json)通过；临时资料分支已清理。Linux执行服务使用Python标准库，不需要pip/npm依赖；网站可从公共输入完全离线构建，不启动Docker、拉镜像或连接服务器。

## 2026-11-09 公开源码与 BCPL 私有输入

B组37门均已完成真实执行；其中36门的完整固定工具链输入已写入本轮公开发布提交；远端Git分批上传仍在收尾。BCPL的95,200,146字节原始归档及相关上游材料未找到全包公开再分发的明确授权，不能把随包GNU Library GPL文本理解成整个归档采用同一许可。官方条款见 [BCPL页面](https://www.cl.cam.ac.uk/~mr10/BCPL.html) 与 [作者README](https://www.cl.cam.ac.uk/~mr10/BCPL/README)。

`data/runtime-input-policy.json` 仅为BCPL固定六项私有输入：三个原始归档分片、`cintcode-noninteractive.patch`、上游README全文与`upstream-sysboot.b`。这些材料不进入公共Git或网页发布包；公共部分保留原始`manifest.json`、来源和逐文件哈希、自编Dockerfile/启动器、项目说明及可复制的GNU许可文本。原manifest与已部署镜像身份不改写。

网站离线构建核对这份明确的公开元数据策略及所有公开输入，不要求私有包存在；本机有无私有包不能改变网页产物。BCPL完整工具链重建仍须逐项核对全部私有字节，缺失、额外文件或哈希不符应停止，不在构建时下载。事先合法持有的固定材料通过显式参数提供，例如：

```sh
python3 scripts/build-fixed-runtime.py --directory bcpl \
  --private-input-directory /path/to/authorized-private-bcpl \
  --ssh-host xshow2 --base-oci-layout /path/to/pinned-gcc-oci
```

本机私有档案在已忽略的`output/private-runtime-inputs/bcpl-20261109`，以独立本地Git提交`dac1672e722e6b5d81ccffbb16704b4a4638a6d7`固定，没有配置远端；这不是公共源码的一部分。既有BCPL生产执行仍使用已核验镜像，不因公共仓库排除原包而伪造运行或重新下载。当前Groovy档案已改为8秒，通用超时文案改为“运行超过时间预算，已停止。”；该修正已随新页面发布，Groovy在两档正式页面的真实执行已通过本轮验收。

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

隔离测试可按节点只启用一部分已固定运行时：执行器 `--languages zig` 在完整校验镜像清单后只核对并公开指定语言，未启用语言的提交会被拒绝。`runtime:planned-check -- --language zig --ssh-host <节点别名>` 与设置 `PLANNED_LANGUAGE=zig` 的 planned 浏览器检查也只要求该节点拥有选定语言镜像；省略语言选择仍核对全量清单。这是测试/执行进程的显式白名单，不提供前端跨节点调度，也不表示新节点已部署。

普通临时预览可设置 `EXECUTOR_SSH_HOST=xshow2 EXECUTOR_LANGUAGES=swift,dart npm run executor:preview`（仍需按下文提供本机临时令牌），只验证和公开该节点已准备的指定语言。不要在只有部分镜像的节点上省略语言白名单。

固定运行时准备脚本支持 `--base-oci-layout /绝对路径`：将已经取得的固定基础镜像导出为 OCI 布局，使用 BuildKit 本地上下文覆盖同一官方镜像引用，并在 OCI 路径中继续锁定清单声明的原摘要。新节点上即使 `--pull=false`，BuildKit 仍可能访问仓库解析基础镜像元数据；此选项用于完全离线构建，不改变 Dockerfile 或基础摘要。OCI 布局应预先按基础镜像的 `linux/amd64` 平台导出；布局路径位于实际构建节点上。

前提：本机 Node.js ≥22、SSH alias `xshow` 可连接；远端有 Python 3、Docker、cgroup v2 和清单中固定 linux/amd64 镜像。原型核验已在xshow准备镜像；预览和集成核验采用独立随机命名空间/锁，不清理生产容器。

```sh
npm run build
export EXECUTOR_TOKEN="$(openssl rand -hex 32)"
npm run executor:preview
```

旧版粘贴私有令牌的网页流程已停用。当前页面只连接显式开启guest的统一网关；私有预览仍可供管理API检查，真实网页核验使用 [免令牌检查](GUEST_EXECUTION.md#复查)。

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

旧版管理员取令牌并粘贴网页的步骤已退役，内部凭据只留在服务端。原runc受信任私有试用记录不能替代当前guest/runsc验收，参见 [免令牌说明](GUEST_EXECUTION.md)。

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

`GET /api/executor-status`需要原私有执行Bearer及32位十六进制X-Execution-Session，同源校验沿用执行接口；不会返回任务内容、ID或所有者。当前网页「服务状态」仅读取公开 `/api/runtimes`；旧版私有聚合指标界面已移除，内部管理API仍需鉴权。

返回队列数、活动数、进程启动/运行时间与累计终态任务。SQLite `/var/lib/code-museum-executor/metrics.sqlite`属于执行专用账号，目录0700，systemd UMask0077；独立于release，安装器用SQLite backup保存已有数据，不清零。每个语言/终态只有一行聚合，没有单任务表；保存数量及排队/编译/运行的总耗时与样本数。不存在的阶段不记零，均值表示已有阶段的样本。程序错误、编译错误、两种超时、取消、输出/内存上限与环境故障独立统计。

统计从新版启用开始，不补算此前历史。API拒绝不计任务，未结束/进程强杀的任务可能漏记；SQLite写失败只增加本次进程的漏记警告。它是执行汇总而非完整可用率/SLO；暂未接入告警、时序窗口、趋势或外部监控。源码/stdin/stdout/stderr仍只在任务原有内存/容器生命周期内，不进入统计数据库。

HTTPS只读MCP复用该进程，见MCP.md；不会扩大CI或网站账号的Docker权限。管理员升级需要部署五份后端模块、unit和Nginx片段；安装器备份/回滚原文件，并在reload前验证私有指标与五个只读工具。聚合数据库保留，不随代码回滚删除。

## 2026-11-06 持续推进：ALGOL 60 / Common Lisp（未部署）

新增 `runtime:algol60-build`、`runtime:common-lisp-build`，显式准备时通过 `--ssh-host xshow --write-manifest` 使用固定输入离线构建，并记录实际镜像身份。GNU MARST 官方完整源码与原始许可保存在 `server/runtimes/algol60/`；SBCL Debian 固定包和原始版权保存在 `server/runtimes/common-lisp/`。网站构建只校验这些输入，不下载工具链；服务器资产不发给浏览器。

ALGOL 60 为 MARST 2.8 → C89 / GCC 14.3.0，10 秒编译、3 秒运行、512 MiB，编译失败不运行；上游生成 C 在传名调用上仍有求值顺序警告，诊断保留，不保证完整语义。Common Lisp 为 SBCL 2.2.9，3 秒运行、512 MiB、128 MiB dynamic space、8 MiB control stack，单文件、无启动文件/交互调试器/Quicklisp。各任务继续沿用非 root、禁网、只读根目录、输出上限与清理协议。

真实核验：`npm run runtime:planned-check -- --ssh-host xshow --output data/audit/planned-runtime-checks.json`；构建后 `BROWSER_CHECK_OUTPUT=tmp/planned-browser npm run runtime:planned-browser` 创建独立临时 API，不改生产。报告只记录实际范围，原生产核验记录不覆盖。

Prolog 已接入源码与独立临时网页：SWI-Prolog 9.0.4，512 MiB / 3 秒 / 128 MiB 栈，main/0 入口，`--on-error=halt`，禁用启动文件、线程与扩展包；语法错误停止加载、失败目标返回失败。固定 6 个 Debian 包、来源与签名校验记录在 `server/runtimes/prolog/`。准备命令为 `npm run runtime:fixed-build -- --directory prolog --ssh-host xshow --write-manifest`；仍未部署。

Forth 已完成源码与临时网页验收：Gforth 0.7.3，256 MiB / 3 秒，16 MiB 字典、数据栈/返回栈各 1 MiB，禁用动态 superinstructions，文件执行后 `bye`，保留未知词/栈下溢错误。固定 4 个 Debian 包和版权在 `server/runtimes/forth/`；`runtime:fixed-build -- --directory forth --ssh-host xshow --write-manifest` 显式离线准备。未部署。

Racket 已于 2026-11-07 完成独立临时验收：Minimal Racket 8.7 CS，官方归档 SHA-256 与发布页一致，512 MiB / 3 秒，`-q -U -t /work/main.rkt`，单文件 #lang racket/base 及预装基础库，无图形界面或在线包安装。固定输入 `server/runtimes/racket/`，构建命令 `runtime:fixed-build -- --directory racket --ssh-host xshow --write-manifest`；10 项容器与 6 项网页报告分别保存。未部署。

Smalltalk 已完成隔离验收：GNU Smalltalk 3.2.5 字节码 VM（JIT 禁用）、512 MiB / 3 秒，`--no-user-files -q -f /work/main.st`。固定完整 GNU 源码及 Iconv/Expat 接口兼容补丁、CLI 状态适配补丁在 `server/runtimes/smalltalk/`，原始归档不改写。报告的语法错误和未处理异常返回失败；显式捕获的错误与普通 stderr 保持成功，13 项容器与 6 项网页记录验证这些区别。无 Xerox 图形环境或在线包安装；未部署。

COBOL 已完成隔离验收：GnuCOBOL 3.1.2，自由格式 `-free -std=cobol2014 -x`，512 MiB / 编译 10 秒 / 运行 3 秒，单文件原生程序，编译失败不运行。固定 3 个 Debian 包/原始版权与离线构建输入在 `server/runtimes/cobol/`，9 项容器 / 5 项网页报告已保存；无 IBM 主机、外部数据库或在线 COPYBOOK 安装，不宣称完整符合性。未部署。

Ada 已完成隔离验收：GNAT 12.2.0，`-gnat2012 -gnatwa`，512 MiB / 编译 10 秒 / 运行 3 秒，入口 main.adb / procedure Main；下载保持 main.adb。固定 GNAT 包与完整共享 GCC 12 版权在 `server/runtimes/ada/`。10 项容器 / 7 项网页记录验证类型错误不执行、真实异常及捕获、中文输入、取消与恢复；不安装 Alire、不宣称完整符合性，未部署。

Clojure 已完成隔离验收：Clojure 1.11.1 / 固定 Java 17，固定基础 JAR，768 MiB / JVM 堆 256 MiB / 3 秒含启动；UTF-8 文本输入输出，不在线还原 tools.deps/Leiningen/Maven。固定包、JAR、版权和提取证明在 `server/runtimes/clojure/`，11 项容器 / 7 项网页记录已保存。自制镜像只复制纯 JAR，复用既有 JDK 基础，不安装跨发行版原生包；未部署。

### OCaml 固定准备（未部署）

OCaml 4.13.1：`ocamlc -w +a-70 -o /work/program /work/main.ml`，再执行字节码；512 MiB、编译 10 秒 / 运行 3 秒，仅标准库。固定包、签名索引及版权在 `server/runtimes/ocaml/`，不使用 opam/dune 在线安装。10 项真实容器和 7 项临时网页检查通过，报告 `data/audit/ocaml-runtime-{checks,browser-checks}.json`。生产未升级。

### Haskell 固定准备（未部署）

GHC 9.0.2 / Haskell 2010：`ghc -v0 -O0 -Wall -XHaskell2010 -outputdir /work -o /work/program /work/Main.hs`，执行原生程序；768 MiB，编译 20 秒 / 运行 3 秒，保留警告与类型检查，只有预装库，不在线还原 Cabal/Stack 依赖。固定输入 `server/runtimes/haskell/`；10 项容器、8 项临时网页检查通过，报告 `data/audit/haskell-runtime-{checks,browser-checks}.json`。

### Kotlin 固定准备（已临时验收，未部署）

Kotlin 2.1.20 / Java 17，单文件 Main.kt 编译 JVM target 17 JAR；768 MiB，编译器堆 384 MiB / 编译 30 秒，运行堆 256 MiB / 运行 3 秒，文件句柄 256。固定官方 ZIP 与全部捆绑许可离线构建，无 Gradle/Maven 还原。独立探针验证后设置 `-Djansi.tmpdir=/work`，正常编译诊断为空，/tmp 保持 noexec；10 项容器和 8 项真实网页复测通过并查看宽窄屏截图。报告 `data/audit/kotlin-runtime-{checks,browser-checks}.json`。

### Groovy 初期固定准备（历史：3秒预算，未部署）

Groovy 4.0.26 / Java 17：固定官方 ZIP，使用 `groovy.ui.GroovyMain /work/main.groovy`，只加载核心 JAR，`groovy.grape.enable=false`；768 MiB / 堆 256 MiB / 3 秒包含 JVM 启动与脚本编译执行，无 Ivy/Maven 在线还原。11 项容器、7 项临时网页检查通过并查看宽窄屏截图；实测类样例约 2.5 秒，复杂脚本仍可能超时。固定输入 `server/runtimes/groovy/`，报告 `data/audit/groovy-runtime-{checks,browser-checks}.json`。

本段保留初期准备记录；当前生产 API 运行预算为8秒，依据与正式证据见文末预算修正。本轮已把语言档案改为8秒，通用超时提示移除硬编码3秒；修正已随`8bf6c20`新静态页面发布。

### Erlang 固定准备（未部署）

Erlang/OTP 25.2.3：单文件 main.erl / 模块 main / main/0，预装 compile:file 编译到 /work，由 BEAM VM 执行；512 MiB、编译 10 秒 / 运行 3 秒，调度器 1、async 1、dirty CPU/IO 各 1，禁网、不启动分布式节点、不在线安装 rebar3 依赖；崩溃转储定向 /dev/null。固定签名校验包 `server/runtimes/erlang/`；10 项容器、8 项真实网页通过并查看宽窄屏，报告 `data/audit/erlang-runtime-{checks,browser-checks}.json`。

### Elixir 固定准备（未部署）

Elixir 1.14.0 / OTP 25.2.3：main.exs 单文件与固定预装库，512 MiB / 3 秒含 BEAM 启动与脚本编译执行，调度器/async/dirty 线程数量受限，无 Mix/Hex 在线依赖或分布式节点。固定输入 `server/runtimes/elixir/`；12 项容器、7 项临时网页通过并查看宽窄屏，报告 `data/audit/elixir-runtime-{checks,browser-checks}.json`。

### Tcl 固定准备（未部署）

Tcl 8.6.13：`tclsh8.6 /work/main.tcl`，256 MiB / 3 秒，固定基础库与 TclOO，无 Tk GUI、在线安装包或 Tcl 9 兼容声明。版本脚本打印真实 info patchlevel。固定输入 `server/runtimes/tcl/`；12 项容器、7 项临时网页通过并查看宽窄屏，报告 `data/audit/tcl-runtime-{checks,browser-checks}.json`。

### Standard ML 固定准备（未部署）

PolyML 5.7.1：`poly --script /work/main.sml`，512 MiB / 3 秒包含编译求值，固定 Standard Basis 库，无在线包安装。脚本按声明编译求值，后续类型错误不撤销先前输出；错误真实返回失败，不把它描述为整文件预编译。不冒充 SML/NJ/MLton 或完整标准符合性。固定输入 `server/runtimes/standard-ml/`；12 项容器、8 项真实网页通过并查看宽窄屏，报告 `data/audit/standard-ml-runtime-{checks,browser-checks}.json`。

### Scala 固定准备（未部署）

Scala 2.13.16 / Java 17：官方发行包六个 JAR，Main.scala / object Main / main(args: Array[String])，768 MiB / 编译器堆 384 MiB / 编译 30 秒、运行堆 256 MiB / 运行 3 秒。无 sbt/Maven/Coursier 在线还原或 Scala 3 兼容声明。固定原归档、发布清单、编译器 Maven SHA-1 与全部输入 SHA-256 在 `server/runtimes/scala/`，不声称整个归档官方 SHA-256 或签名核验。10 项容器、8 项临时网页通过并查看宽窄屏，报告 `data/audit/scala-runtime-{checks,browser-checks}.json`。

### Visual Basic .NET 固定准备（未部署）

既有固定官方 .NET SDK 10.0.403 / vbc Roslyn 5.9.0，使用预装参考程序集与 VisualBasic.Core 编译 Main.vb 控制台；默认 `-optionstrict+`、`-define:_MYTYPE="Empty"`，不提供桌面 My 服务、Windows UI 或 NuGet 在线还原。1024 MiB / 编译 30 秒 / 运行 3 秒，256 文件句柄，64 MiB 单文件上限，与既有 .NET 隔离协议一致。11 项容器、8 项临时网页通过并查看宽窄屏，报告 `data/audit/visual-basic.net-runtime-{checks,browser-checks}.json`。

### F# 固定准备（未部署）

F# 10.0 / 编译器 15.2.403.0 / 固定官方 .NET SDK 10.0.403，Main.fs 单文件、预装参考程序集与 FSharp.Core；仅复制预装 Core 至任务临时目录，不还原 NuGet 包。1024 MiB / 编译 30 秒 / 运行 3 秒，256 文件句柄与 64 MiB 单文件上限。12 项容器、8 项真实网页通过并查看宽窄屏，报告 `data/audit/f-sharp-runtime-{checks,browser-checks}.json`。F# 编译器和 Core 的 MIT 许可见 [上游原文](https://github.com/dotnet/fsharp/blob/main/License.txt)，SDK 与运行时沿用既有条目。

### D 固定准备（未部署）

GNU D 12.2.0 / gdc-12、固定 Phobos，`gdc-12 -O0 -Wall -o /work/program /work/main.d`；768 MiB / 编译 10 秒 / 运行 3 秒，无 dub 在线安装，不冒充 DMD 版本或完整标准符合性。原始 GCC 12 版权覆盖 D/Phobos。固定输入 `server/runtimes/d/`；11 项容器、8 项真实网页通过并查看宽窄屏，报告 `data/audit/d-runtime-{checks,browser-checks}.json`。

### Nim 固定准备（未部署）

Nim 1.6.10 与固定标准库/GCC：main.nim 单文件、parallelBuild 1，缓存仅在临时 /work，保留默认运行时检查；768 MiB / 编译 20 秒 / 运行 3 秒，无 Nimble 在线安装或 Nim 2 兼容声明。固定输入 `server/runtimes/nim/`；12 项容器、8 项真实网页通过并查看宽窄屏，报告 `data/audit/nim-runtime-{checks,browser-checks}.json`。

### Zig 固定准备（未部署）

Zig 0.14.1 官方 SDK，main.zig 单文件，原始完整 LLVM 后端与 Debug 检查；启动器只限制编译 CPU 亲和至一个已允许 CPU，所有缓存放在 /work。1024 MiB / 编译 30 秒 / 运行 3 秒，无在线包下载或新版 Zig API 兼容声明。原始 49,086,504 字节归档匹配官方索引 SHA-256，13 份原始许可保留于 `server/runtimes/zig/`。12 项容器、9 项真实网页通过并查看宽窄屏，报告 `data/audit/zig-runtime-{checks,browser-checks}.json`。


Swift 已完成独立临时网页验收：官方 6.1.3 / Swift 6 模式，main.swift 与固定标准库/Foundation，1024 MiB / 编译 30 秒 / 运行 3 秒，无 SPM 在线依赖或 Apple UI 框架。固定完整 SDK 分片、发布签名及原始许可在 `server/runtimes/swift/`；用 `runtime:fixed-build -- --directory swift --ssh-host xshow2 --base-oci-layout /path/to/gcc-oci --write-manifest` 显式离线准备（替换为节点上实际的 ASCII 绝对路径）。专项检查选择 `--language swift` / `PLANNED_LANGUAGE=swift`，节点设为 xshow2；13 项容器、9 项网页证据分别保存。未部署，生产不能自动路由到新节点。


Dart 已完成 xshow2 独立临时验收：官方 SDK 3.9.4，main.dart AOT 原生编译与标准库，768 MiB / 编译 15 秒 / 运行 3 秒；命令抑制分析统计，无 pub 在线依赖、Flutter 或浏览器 UI。固定完整 SDK 7 分片、官方校验和与原始通知在 `server/runtimes/dart/`。准备使用 `runtime:fixed-build -- --directory dart --ssh-host xshow2 --base-oci-layout /path/to/gcc-oci --write-manifest`；专项选择 `--language dart` / `PLANNED_LANGUAGE=dart`，13 项容器和 10 项网页证据已保存。未部署。


Julia 已完成 xshow2 独立临时验收：1.11.7 / main.jl、预装标准库与正常 JIT，768 MiB / 3 秒含启动/JIT，初始 Julia/GC/BLAS 单线程；使用已有编译缓存但不生成新预编译缓存，错误前输出保留，无在线 Pkg、绘图或 Notebook。完整 SDK 9 分片、官方校验和、19 份许可在 `server/runtimes/julia/`；准备 `runtime:fixed-build -- --directory julia --ssh-host xshow2 --base-oci-layout /path/to/gcc-oci --write-manifest`，专项 `--language julia` / `PLANNED_LANGUAGE=julia`。13 项容器、10 项网页报告已保存；未部署。


GNU Octave 已完成 xshow2 临时验收：7.3.0 CLI，main.m 脚本与核心库，512 MiB / 3 秒；无 GUI/窗口系统、初始化/历史、在线 pkg 或绘图界面。固定 179 包、178 版权在 `server/runtimes/octave/`，含 Debian 合法 ~ 版本文件名。准备 `runtime:fixed-build -- --directory octave --ssh-host xshow2 --base-oci-layout /path/to/gcc-oci --write-manifest`；13 项容器 / 10 项网页记录已保存，未部署。Debian 预取脚本可显式设置 `--mirror-root https://mirrors.tuna.tsinghua.edu.cn`，保留官方规范 URL、索引签名与逐包 SHA-256；缓存或镜像字节使用相同校验。


## PowerShell 隔离配置（临时验收完成，未部署）

PowerShell 7.5.4 官方 Microsoft DEB 的完整 SHA-256 匹配官方 GitHub 发行资产，三分片与原始许可保留在 `server/runtimes/powershell/`。独立 CLI 入口默认 `ErrorActionPreference=Stop`，保留显式捕获、原生诊断、普通 stderr 与显式退出码；Linux 核心模块，不提供在线 Gallery 或 Windows/Office 宿主。

该包的 .NET 9 JIT 使用逻辑大小 2 TiB 的稀疏匿名 `memfd:doublemapper`，初始化会受 POSIX fsize 限额影响；见 [.NET 上游实现](https://github.com/dotnet/runtime/blob/v9.0.10/src/coreclr/minipal/Unix/doublemapping.cpp) 与 [维护者说明](https://github.com/dotnet/runtime/discussions/81752)。只对 PowerShell 将逻辑 fsize 设为 2 TiB，保持 W^X 默认保护；这不是 2 TiB 内存配额，实际 cgroup 内存仍 768 MiB，/work 和 /tmp tmpfs 分别 16/8 MiB、均 noexec，根只读，非 root、禁网、NNP、进程/输出/3 秒限制保留，文件句柄 256。17 项真实容器检查包含写满 tmpfs 的 ENOSPC 与只读根拒写，实际成功/失败状态来自原引擎。版本探测同样使用独立 noexec 临时 HOME。11 项真实网页检查通过，已查看宽窄屏；未部署。

### 2026-11-09 Korn shell 临时验收

`server/runtimes/korn-shell/` 保存 ksh93u+m 1.0.4 完整 Debian 包、原始许可和签名索引核验记录；使用前述固定构建器与 xshow2 同摘要 OCI 基础镜像离线构建。`main.ksh` 通过 `/usr/bin/ksh93 -p /work/main.ksh` 执行，256 MiB / 3 秒；原生退出状态，不启用隐含 errexit。`--language korn-shell` / `PLANNED_LANGUAGE=korn-shell` 已有 14 项容器、10 项 Chrome 证据，生产和多节点路由均未改。

### 2026-11-09 tcsh 临时验收

`server/runtimes/tcsh/` 保留 tcsh 6.24.07 固定 Debian 包和原始版权、签名索引记录；使用固定构建器与同摘要 OCI 基础离线构建。main.tcsh 由 `/usr/bin/tcsh -f /work/main.tcsh` 执行，256 MiB / 3 秒，保留原生状态。`--language tcsh` / `PLANNED_LANGUAGE=tcsh`：12 项容器、10 项 Chrome 证据，生产未改。

### 2026-11-09 WebAssembly 临时验收

`server/runtimes/wasm/` 保存固定离线输入与原始许可，用固定构建器和同摘要 OCI 基础构建。Wasmtime 50.0.1；完整官方 11,577,424 字节 SDK 匹配官方 GitHub 资产 SHA-256，原始许可保留，未声称 PGP 验签。main.wat 核心模块 / _start / WASI Preview 1，512 MiB / 3 秒含 WAT 翻译与 JIT，至多一块 256 MiB 线性内存；禁用组件模型和线程，无预开放目录、继承环境、网络或浏览器宿主。17 项容器覆盖计算、中文输入输出、语法/类型验证、除零/越界陷阱、proc_exit 状态、内存/权限限制、取消和恢复。 `--language wasm` / `PLANNED_LANGUAGE=wasm`：17 项真实容器、10 项真实 Chrome 检查通过，1440/390 明暗截图已核读；85/85 默认测试与离线构建通过。 生产未改。

### 2026-11-09 x86 Assembly 临时验收

`server/runtimes/x86-assembly/` 保存固定离线输入与原始许可，用固定构建器和同摘要 OCI 基础构建。NASM 2.16.01 → 固定基础 GNU ld → 原生 x86-64 Linux ELF64，main.asm / _start / Linux syscall ABI，256 MiB / 编译 10 秒 / 运行 3 秒。固定 Debian 包、签名索引、SHA-256 和 NASM/binutils 原始许可保留。编译与链接均通过才执行，警告原样保留；无 libc 或外部目标文件，不冒充 8086、DOS、Windows 或模拟器。实际覆盖循环、函数、中文系统调用输入、NASM/链接错误、除零/非法内存访问和退出码。 `--language x86-assembly` / `PLANNED_LANGUAGE=x86-assembly`：13 项真实容器、10 项真实 Chrome 检查通过，1440/390 明暗截图已核读；85/85 默认测试与离线构建通过。 生产未改。

### 2026-11-09 Verilog 临时验收

`server/runtimes/verilog/` 保存固定离线输入与原始许可，用固定构建器和同摘要 OCI 基础构建。Icarus Verilog 11.0 / Verilog-2005，main.v / 顶层 module main，512 MiB / 编译 10 秒 / vvp 文本仿真 3 秒实际时间。完整固定 Debian 包、签名索引、SHA-256 与原始许可保留。-N 使 $stop 非交互且返回失败，$fatal 和原生诊断保留，禁用波形输出；无综合、FPGA 部署或波形下载，不是真实电路。页面动作/结果明确为仿真，并验证切换语言恢复运行标签；覆盖计数器、延迟、四态、函数、中文输入、错误、取消与恢复。 `--language verilog` / `PLANNED_LANGUAGE=verilog`：13 项真实容器、11 项真实 Chrome 检查通过，1440/390 明暗截图已核读；85/85 默认测试与离线构建通过。 生产未改。

### 2026-11-09 VHDL 临时验收

`server/runtimes/vhdl/` 保存固定离线输入与原始许可，用固定构建器和同摘要 OCI 基础构建。GHDL 2.0.0 mcode / VHDL-2008，main.vhd / 顶层 entity main，512 MiB / 分析展开 10 秒 / 文本仿真 3 秒实际时间。3 个固定 Debian 包、签名索引、SHA-256 与原始许可保留，--assert-level=error 保留断言和约束检查，warning 仍可继续。无综合、FPGA 部署或波形下载，不是真实电路。页面明确仿真；覆盖记录、IEEE 多值逻辑、类型错误、仿真时间、中文 TextIO、断言/边界错误、取消恢复和文件操作。 `--language vhdl` / `PLANNED_LANGUAGE=vhdl`：15 项真实容器、10 项真实 Chrome 检查通过，1440/390 明暗截图已核读；85/85 默认测试与离线构建通过。 生产未改。

### 2026-11-09 PostScript 临时验收

`server/runtimes/postscript/` 保存固定离线输入与原始许可，用固定构建器和同摘要 OCI 基础构建。Ghostscript 10.00.0，18 个固定 Debian 包、签名索引、SHA-256 与原始许可保留。main.ps，256 MiB / 3 秒，-q -dSAFER -dNODISPLAY -dBATCH -dNOPAUSE；栈、过程、递归、字典和文本输出来自真实解释器，原生错误与 stopped 捕获保留。无页面渲染、打印设备或文件产物下载；实际核验 SAFER 拒绝未授权读写、中文多行标准输入、错误/恢复及导入下载。 `--language postscript` / `PLANNED_LANGUAGE=postscript`：16 项真实容器、10 项真实 Chrome 检查通过，1440/390 明暗截图已核读；85/85 默认测试与离线构建通过。 生产未改。


## 2026-11-09 BCPL、Oberon 临时验收（B 组收尾，未部署）

BCPL 使用作者 2026-11-09 完整快照、Cintcode64 编译器和以固定 GCC 重建的 C VM；原始 bootstrap、标准头文件、作者条款和随包 GNU licence 保留。main.b / start()，512 MiB / 编译 10 秒 / 运行 3 秒。非交互 VM 补丁把真实故障码转为失败退出，PC 取原系统的第 6 号寄存器；启动器恢复原始标准输入、使用 LF 文本输出并阻止剩余输入进入 CLI。除零、返回 7、中文多行输入、语法拒绝、超时、输出上限、取消和恢复已实测。无图形、音频、在线依赖或历史机器重现；作者只明确私人/学术用途，不推断商业再分发许可。

Oberon 使用 OBNC 0.17.2 官方完整源码、4 个 Debian 固定依赖及原始许可，签名索引与逐包 SHA-256 已核验；官方源码 MD5 与独立官方清单匹配，另保留本地 SHA-256，不声称上游 SHA-256 或签名。最终 2016 语言 / Oberon-07 家族 → C/GCC 原生程序；Main.obn / MODULE Main，512 MiB / 编译 10 秒 / 运行 3 秒，INTEGER 32 位、REAL 64 位。保留默认 GC、类型与运行时检查，文本和 ext 库逐项检查；不提供 SDL Input/XYplane、在线模块、Oberon-2 或 Ceres 操作系统重现。变量断言和数组越界保留原生 E8/E2 诊断，ASSERT(FALSE) 按原实现直接失败退出，普通 stderr 不误报失败。

BCPL [13 项真实容器检查](../data/audit/bcpl-runtime-checks.json)、[10 项真实 Chrome 检查](../data/audit/bcpl-runtime-browser-checks.json)，Oberon [14 项真实容器检查](../data/audit/oberon-runtime-checks.json)、[10 项真实 Chrome 检查](../data/audit/oberon-runtime-browser-checks.json)通过，任务容器零残留。1440/390 明暗页面及环境说明截图已查看；覆盖编辑后真实执行、原生关键词/注释着色、编译与运行错误分离、UTF-8 导入不上传不自动执行、main.b / Main.obn 下载名、地图和档案入口。原 B 组为 37/37 门临时验收完成；生产仍为原 22 个节点。

显式准备与复测（本地 OCI 布局须事先具备相同固定 GCC 摘要；其路径只是准备参数，网站构建与用户任务不读取它）：

```sh
python3 scripts/build-fixed-runtime.py --directory bcpl --ssh-host xshow2 --base-oci-layout /tmp/code-museum-swift-6.1.3/gcc-oci --write-manifest
python3 scripts/check-planned-runtimes.py --language bcpl --ssh-host xshow2 --output data/audit/bcpl-runtime-checks.json
npm run build
EXECUTOR_SSH_HOST=xshow2 PLANNED_LANGUAGE=bcpl BROWSER_CHECK_OUTPUT=tmp/bcpl-runtime-browser npm run runtime:planned-browser
```

Oberon 把上述 directory/language 及输出名改为 oberon。镜像构建只使用固定源码/依赖和基础镜像；所有站点资产来自项目目录输入，源码归档不进入网页下载。固定输入和改动尚未提交，尚不能把工作区复现称为已有提交的复现；提交时须完整纳入版本管理。BCPL 的许可边界在任何未来发布前仍需保持可见。未提交、推送或部署。


## 双节点网关实现（生产后端已切换）

`server/execution-nodes.json` 将 56 个远端运行时完整且唯一地分配到 xshow 42 门、xshow2 14 门。构建会离线拒绝缺失、重复或未知语言，以及非 loopback 节点地址；公开能力数据只给出配置容量（两节点合计 2、每节点 1），不包含上游地址或凭据名称。

worker 使用 `--nodes <file> --node <id>` 启动并仅核对本机镜像。统一入口 `execution_gateway.py` 以独立节点令牌转发同域请求；用户的会话标识保留，查询和取消绑定到原节点。任务路由持久化且短期过期，重启网关不重发任务。提交结果未知时响应 `submissionState=unknown`、`retrySafe=false`；请求只向选定节点发送一次，用户应等待后再操作。失联语言从实时清单移除，仍可使用另一台；指标按样本数加权并标注部分可达覆盖。只读 MCP 保持已发布 `current/dist/data` 的既有配置快照语义，没有随后端切换发布新的59节点数据。

临时两机预览与检查不使用生产令牌：

```sh
npm run executor:dual-preview
npm run executor:dual-check -- --output data/audit/dual-node-runtime-checks.json --screenshots tmp/dual-node-browser
npm run executor:prepare-dual -- --output output/dual-executor-review
```

安装准备、常驻隧道、权限和回退见 [双节点部署说明](DUAL_NODE_DEPLOYMENT.md)。生产后端已通过10项常驻canary、[63项正式 HTTPS/Chrome 检查](../data/audit/dual-node-production-checks.json)及[8项生命周期检查](../data/audit/dual-node-production-lifecycle.json)并切换到56门；[新服务已启用](../data/audit/dual-node-production-services.json)。静态前端随后以`8bf6c20`发布为59节点；见 [本轮部署记录](DEPLOYMENT.md)。


### 双节点回归中的 Groovy 预算修正

首次全量网关回归中，Groovy 原正例触发 3 秒超时；三个独立 JVM 在显式 8 秒诊断限时内分别用约 5271/5161/5261 ms 输出正确结果，见 `data/audit/groovy-cold-start-diagnostics.json`。当前只把 Groovy 的运行预算改为 **8 秒（包含 JVM 启动与脚本编译执行）**，768 MiB 容器和 256 MiB JVM 堆等约束保持不变。其他语言仍使用各自已有预算。

这是宿主执行协议调整，固定 Groovy 工具链与镜像未变。上方旧验收记录与固定 NOTICE 的3秒说明是初期准备状态；生产 API 已按每门 `runSeconds` 正确公开 Groovy 的8秒预算。`/api/runtimes` 的 `limits.seconds` 表示当前可用语言中最大的运行预算，具体语言必须读取自身 `runSeconds`；编译预算另列。本轮已修正语言档案的8秒预算，并把通用执行超时提示改为“运行超过时间预算，已停止。”；修正已随新静态页面发布，Groovy正式宽窄屏执行通过。

最终双节点临时验收：14项API/Chrome与56/56门正例回归通过，分别见 `dual-node-runtime-checks.json`、`dual-node-all-runtimes.json`；宽窄屏及部分可用状态截图已核读。Groovy新预算11项容器/7项网页通过。全量默认测试90/90、网关HTTP测试12/12与离线构建通过。随后正式生产已完成安装、切换和上述HTTPS验收；[启用后健康复核](../data/audit/dual-node-production-final-health.json)再次确认完整56门、并发2及最大预算8秒。静态前端随后已实际发布；当前master已推送，正式Actions以`f2ff0bf`部署了与完整验收版本逐字节一致的独立release，详见本轮部署记录。
