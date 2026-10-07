# Code Museum

**The Museum of Programming Languages** — FreeXLib 自由实验空间的编程语言博物馆。

继续开发前请阅读 [产品上下文与交接](docs/PROJECT_CONTEXT.md)：保存已讨论的产品方向、视觉与历史准确性要求，以及已实现/未实现的边界。项目协作入口见 [AGENTS.md](AGENTS.md)。

目前采用单屏五页签工作台：时间长河、关系谱系、语言检索、语言实验台和出处说明。地图默认适屏展示全貌，支持局部放大；聚焦时按直接关联节点及名称边界调整取景，相关名称保持屏幕字号，聚焦名称按选中、直接关系、远层关系的顺序避让，移位名称用细线指回原节点，聚焦连线按缩放补偿线宽与虚线间距；可在「设计脉络」与「实现与生态」关系层之间切换。档案区分「附有论证与出处」与「来源字段，关系待核」，地图较淡连线表示后者；有论证不等于全部史料已核。完整导入固定 PLDB 快照的 5,155 条记录，其中 4,608 条被来源标记为语言；经证据筛选的地图节点为 233 个，60 条已核语法与实现、11 条有历史一手资料。规范化历史关系共 417 条，另有 7 条独立校验的生态关系。证据不足的记录列为待核，非编程语言的工具、产品和记法移入相关技术，原始馆藏仍可检索。快照全量不等于所有历史语言无一遗漏。地图常显标签参考 [TIOBE 当前前 50 名和有出处的历史节点](docs/audit/LABEL_SELECTION.md)，不决定馆藏收录。

地图提供共享模糊搜索框，范围为当前有年代的地图节点，匹配名称、别名和馆藏 ID，并支持轻微拼写错误；保留 C++ 与 C# 的符号区别。结果可点击或用方向键/Enter 选择，直接定位、高亮并打开档案。谱系未显示的语言标注「仅时间长河」，选中后切到时间长河；无匹配时可携带查询进入全量馆藏检索。

地图选中 JavaScript、Python、Lua 或 Scheme 时，名称右侧显示 `▶` 运行图标，点击或键盘 Enter 可直接打开对应实验台，焦点随即进入代码编辑器；其他未接入网页运行时的语言不显示此标识。图标只表示已具备执行入口，加载失败或超时仍显示真实错误。

实验台提供可编辑且高亮的代码。JavaScript 在浏览器 Worker 中真实执行，运行超过 2 秒会停止；Python 由本地 Pyodide WebAssembly 运行时在模块 Worker 中执行，运行超过 3 秒会停止。Lua 5.4.5 通过本地 Wasmoon 1.16.0 Wasm 在独立 Worker 中执行，每次运行创建新环境，超过2秒会停止；加载预算30秒。支持 print、数学、字符串、表、UTF-8及协程基础功能，不提供文件、系统或第三方模块。Scheme 使用本地 BiwaScheme 0.8.3 JavaScript 解释器（非Wasm、非Guile），捕获标准输出与最后表达式值，每次创建新环境，执行2秒、加载30秒预算。提供基础语法高亮；支持多数R7RS small功能，syntax-rules、异常与库系统不完整，字符串不可变、整数精度受JS数值限制；不提供JS互操作、文件/网络或第三方模块。原始发布模块、Worker核心适配、MIT许可和SHA-256保存在 `public/assets/scheme/`，构建还验证核心从原模块的精确派生。编辑后均自动更新实际输出或错误。Lua 仅在运行时加载约413 KiB（未压缩）的解释器及接口，运行文件、MIT许可和SHA-256清单保存在 `public/assets/lua/`，构建离线核验。Python 仅在选中时加载约 13.53 MB 的固定运行文件，首次下载及初始化最多等待90秒；代码执行仍最多3秒。C、C++、Java、Ruby、Go、Rust、Bash、Korn shell、tcsh 提供可编辑示例，但尚无浏览器运行环境；Shell 默认样例与本机实际执行记录一致，并注明核验版本。其他语言可写草稿，不显示模拟结果。Worker 不是安全沙箱；请只执行自己信任的代码。

JavaScript、Python、Lua 与 Scheme 的捕获输出最多保留 20,000 个字符，JavaScript 另保留最多 200 次日志调用。输出过多时优先保留运行异常，避免错误被日志截断。捕获上限只约束日志存储，程序自身的内存分配仍会消耗设备资源。

离开实验台或页面进入后台时会停止加载与活动任务，并取消等待运行的编辑。返回可见的实验台后，对被中断的任务重新执行最新草稿；已经完成的结果会复用。空闲 Python Worker 设置 3 分钟释放定时，实际触发时机受浏览器后台定时器调度影响。

## 从源码恢复网站

需要 Node.js 22 或更高版本及随附的 npm。构建不下载数据、不联网，也不需要先执行 npm install；Pyodide 固定版本的运行时文件已保存在 `public/assets/pyodide/`，构建时会核对 SHA-256。

```sh
npm run build
npm run preview
```

打开 http://127.0.0.1:4173 。端口被占用时可用 `PORT=4174 npm run preview`。Python 模块 Worker 需要 HTTP 服务正确提供 `.mjs` 和 `.wasm` 的 MIME 类型；直接打开 `dist/index.html` 时浏览器可能阻止 Python 运行时加载。预览服务与正式静态托管均无需外网运行。本机预览服务使用 ETag 验证缓存：未变化的 Pyodide 文件再次请求时返回 304，修改源码并重建后仍会获取新文件。正式托管的缓存策略需在部署环境另行确认。

本机预览按浏览器的 `Accept-Encoding` 协商 Brotli、gzip 或原文件传输，保留正确的 Wasm MIME，并用 `Vary` 与不同 ETag 区分编码；ZIP 和 PNG 不再压缩。核心 Python 文件未压缩为 13.53 MB，本机测得 Brotli 约 6.04 MB、gzip 约 6.39 MB，均包含保持原样的标准库 ZIP。执行 `npm run runtime:budget` 可离线重测。正式静态托管是否启用压缩需另行确认。

```sh
npm run dev   # 构建一次并预览；没有热更新，修改源码后重新 build 并刷新
npm test      # 检验从无 dist 的源码副本构建、重复构建和错误输入保护
```

## 可选的真实浏览器核验

已安装 Chrome/Chromium 时，可在构建后执行 `npm run runtime:browser`。默认使用本机 macOS Chrome 路径；其他安装位置通过 `CHROME_BIN` 指定。脚本使用独立临时配置和本机临时 HTTP 端口，阻断外部 DNS，不读取日常浏览器会话，也不下载浏览器或 npm 依赖。结束后关闭自己的浏览器并清理配置。

```sh
npm run build
BROWSER_CHECK_OUTPUT=/tmp/code-museum-browser-check npm run runtime:browser
```

设置 `MAP_SWEEP=1` 可逐项检查全部常显标签，`MAP_SWEEP=all` 则检查全部有年代的地图节点：在 1440×1000 与 390×844 两种视口及设计、生态两种关系层中依次选中，核对直接关系名称、已放置名称避让、引导线与点击空白恢复。谱系中未显示的条目单独记录，不补造关系。扩展检查使用减少动态效果模式；默认检查仍覆盖普通动态效果下的 Lua/Kotlin，以及 Python/Rust/Zig 生态切换和放大后的键盘关系预览。

`BROWSER_CHECK_OUTPUT` 可选；指定后保存 JSON 记录及宽屏、窄屏截图，未指定时仅输出记录。检查涵盖真实 JavaScript/Python 执行、Wasm 压缩响应、重复打开保留草稿与 Worker、输出上限与异常、无限循环终止及恢复、两种视口的页面溢出，以及 VBA/VBScript 地图节点、关系和审查详情、Kotlin/Lua 的已核设计连线、来源入口及宽窄屏完整标签边界、已放置名称互不覆盖，以及放大和适屏后的引导线端点。脚本会拒绝过期的实验台构建。这是需要本机浏览器与 HTTP 端口的单独检查，不影响默认离线 `npm test` 和构建。记录见 [浏览器核验](data/audit/browser-runtime-checks.json)；真实页签可见性、3 分钟闲置释放及正式托管配置尚未由该脚本验证。

## 可选的 ALGOL 60 本机核验

已在临时目录构建 GNU MARST 2.8 并实际执行三份原创样例，输出 `55`、`720`、`6`，错误语法被拒绝；传名调用生成的 C 存在求值顺序警告。这不代表已接入网页运行或完整符合性通过。

`python3 scripts/verify-algol60.py --runtime-dir /path/to/built/marst-2.8` 仅使用已经构建的翻译器、静态库及本机 Clang，不下载或安装依赖。来源核对、复现步骤及限制见 [核验说明](docs/audit/ALGOL60_RUNTIME.md)，原始证据见 [执行记录](data/audit/algol60-runtime-checks.json)。网站构建不依赖这个临时工具链。

## 可选的 XSLT 1.0 本机核验

本机 xsltproc / libxslt 1.1.35 已实际执行两份原创样例：求和输出 `55`，排序与条件输出 `8,9,10,`，非法 XPath 表达式被拒绝。`python3 scripts/verify-xslt.py` 仅使用已安装的 xsltproc，以 `--nonet` 执行固定样例，记录代码、输入、哈希、命令和真实输出；未安装或样例失败时不替换既有证据。它不代表 XSLT 2.0/3.0、完整标准符合性或网页运行。详见 [XSLT 核验说明](docs/audit/XSLT_RUNTIME.md)。

## 可选的 ksh93 本机核验

本机 ksh93u+（2012-08-01）实际执行两份原创程序，输出 `55`、`12`，并拒绝非法语法。`python3 scripts/verify-ksh93.py` 只调用已安装的 ksh，保存程序哈希、版本、语法检查及真实结果；未执行1988/1993历史二进制，也未接入网页运行。详见 [ksh93 核验说明](docs/audit/KSH93_RUNTIME.md)。

## 可选的 tcsh 本机核验

`python3 scripts/verify-tcsh.py` 调用已安装的 tcsh，以 `-f` 跳过启动文件，实际执行整数循环及列表/条件程序，输出 `55`、`Lisp`，并拒绝错误引号语法。本机 tcsh 6.21.00 与 `/bin/csh` 是同一实现，不代表1978年原始 C shell 或完整历史兼容性验证；网页尚未接入 Shell 执行。记录与复现范围见 [tcsh 核验说明](docs/audit/TCSH_RUNTIME.md)。

## 项目结构

```text
src/                         网站源码：HTML、CSS、交互 JavaScript
public/                      原始静态资源，构建时原样复制
  assets/                    长河与早期古树插画
  assets/pyodide/            固定版本 Python WebAssembly 运行时及校验清单
data/
  raw/pldb.json              固定版本的完整原始数据，必须提交
  raw/pldb.snapshot.json     来源、许可、固定时间及 SHA-256 校验
  relationship-overrides.json 人工补充/校订的关系和依据
  ecosystem-relations.json 人工核实的实现、平台与互操作关系
  audit/                     馆藏证据、地图分类决定和运行记录
scripts/
  import-pldb.cjs            校验原始快照并规范化数据
  build.cjs                  离线构建入口
  serve.cjs                  本机静态预览服务
tests/                       可复现构建测试
archive/                     早期原型和规划草案，不参与构建
.openai/hosting.json          保留的站点身份与 dist 发布配置
dist/                        生成产物，不提交 Git
```

页面改动写在 `src/`，插画写在 `public/`，设计关系校订写在 `data/relationship-overrides.json`，具体实现或互操作写在 `data/ecosystem-relations.json`。不要直接编辑 `dist/`，构建会整体替换它，包括清除旧产物；输入校验失败则保留上一版站点。

馆藏覆盖、别名冲突、逐条证据和关系缺口的离线审计见 [审计报告](docs/audit/INTEGRITY.md)。 当前地图参与关系的数量与常显标签缺口见[自动生成的地图状态](docs/audit/MAP_STATUS.md)，随同一次审计更新。有 Python 3 时执行 `npm run audit`，可从固定 PLDB 与 GitHub Linguist 快照重生成证据清单和复核队列；建站本身仍只需要 Node.js。候选关系不会自动进入地图。

## 数据与可复现性

构建校验快照 SHA-256、记录数量、ID 唯一性以及关系端点。时间戳从快照清单读取，排序不依赖本机语言区域设置，因此相同源码和数据生成相同字节。`data/raw/pldb.json` 以原始字节提交，不做自动换行转换。

审计与构建共用人工审查记录校验器：已阅读来源必须记录 URL、读取时间、响应状态、标题、摘录和 SHA-256；已核语言必须具备语法及实现来源。地图筛选结果绑定审查记录与分类决定的哈希，改动这些输入后先执行 `npm run audit`，再构建。该校验保证字段完整与输入一致，史料内容仍需人工核实。

构建将人工审查输入原样保存为站点的 `/data/audit-reviews.json`，保留完整摘录、来源哈希、读取时间、访问失败和范围说明。现有 `/data/provenance.json` 的 `meta.reviewEvidence` 提供该文件路径、SHA-256、记录与已阅读来源数量。当前只有 83 条人工审查记录及 162 条已阅读来源，不代表 5,155 条馆藏全部核实；下载文件的哈希证明字节对应这次输入，不能单独证明史料内容正确。

有出处的名称、年代或作者校订保存在人工审查的 `catalogueCorrection` 中。构建与审计共用校验器，要求原值精确匹配固定快照、校订出处已在同条审查中阅读，年代必须指明事件；原始快照不改写。详情展示原值、校订值、理由与出处，导出证据保留完整校订。作者字段缺失可用 `from: null` 与 `fromMissing: true` 明确补录，校验会拒绝原字段已出现的过期补录；详情显示“未记载 → 作者”，审计保留原作者字段是否存在与展示值。首例是 `sh`：Bourne shell (sh)，1979 年 Unix V7 发布；原始 1971 年值保留。

更新馆藏是显式操作：取得新的 PLDB 快照，核查后替换原始文件，并更新清单中的来源时间、SHA-256、记录数量和语言数量；随后运行构建及测试。固定快照的数量断言也应在确认变化后更新。构建不会自动获取“最新版”。关系类型没有出处时不能凭相关链接补作影响关系。

PLDB 的公开领域说明见 https://github.com/breck7/pldb/blob/main/readme.scroll 。本项目只使用当前规范化器选择的字段，不将上游快照中附带的第三方代码范例自动放到页面上；上游材料中的单独许可仍应保留和尊重。

## Git 与发布

提交 `src/`、`public/`、`data/`、`scripts/`、`tests/`、项目配置及需要保留的档案。`dist/` 和 `node_modules/` 被忽略。

新机器拉取这些文件后执行 `npm run build` 即可恢复网站。发布前同样先运行构建，把生成的 `dist/` 交给静态托管服务。`.openai/hosting.json` 只是托管配置，不参与本地生成，也不需要凭证才能构建。

`npm test` 会在独立临时目录仅复制源码输入（不复制 dist、node_modules、Git 或临时下载），重建并比较连续两次输出的逐文件哈希；同时验证坏快照不会覆盖上一次成功结果。预览服务检查覆盖未变化的文件返回 304、运行文件重建后缓存失效、HEAD 请求及目录访问边界，无需启动网络端口。

## 服务端发布与访问量

正式站点为 [codemuseum.freexlib.com](https://codemuseum.freexlib.com)，已配置 HTTPS。GitHub Actions 提供 master 分支测试、离线构建和独立 release 发布。生产域名累计 UV/PV 通过同域接口写入独立 SQLite，管理员可经 SSH 查询与备份。上线状态、发布方式和统计边界见 [部署说明](docs/DEPLOYMENT.md)。
