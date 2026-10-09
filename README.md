# Code Museum

**The Museum of Programming Languages** — FreeXLib 自由实验空间的编程语言博物馆。

继续开发前请阅读 [产品上下文与交接](docs/PROJECT_CONTEXT.md)：保存已讨论的产品方向、视觉与历史准确性要求，以及已实现/未实现的边界。项目协作入口见 [AGENTS.md](AGENTS.md)。

目前采用单屏六页签工作台：时间长河、关系谱系、语言检索、语言实验台、语言对比和出处说明。地图默认适屏展示全貌，支持局部放大；聚焦时按直接关联节点及名称边界调整取景，相关名称保持屏幕字号，聚焦名称按选中、直接关系、远层关系的顺序避让，移位名称用细线指回原节点，聚焦连线按缩放补偿线宽与虚线间距；可在「设计脉络」与「实现与生态」关系层之间切换。档案区分「附有论证与出处」与「来源字段，关系待核」，地图较淡连线表示后者；有论证不等于全部史料已核。完整导入固定 PLDB 快照的 5,155 条记录，其中 4,608 条被来源标记为语言；经证据筛选的地图节点为 233 个，60 条已核语法与实现、11 条有历史一手资料。规范化历史关系共 419 条，另有 7 条独立校验的生态关系。证据不足的记录列为待核，非编程语言的工具、产品和记法移入相关技术，原始馆藏仍可检索。快照全量不等于所有历史语言无一遗漏。地图常显标签参考 [TIOBE 当前前 50 名和有出处的历史节点](docs/audit/LABEL_SELECTION.md)，不决定馆藏收录。

地图提供共享模糊搜索框，范围为当前有年代的地图节点，匹配名称、别名和馆藏 ID，并支持轻微拼写错误；保留 C++ 与 C# 的符号区别。结果可点击或用方向键/Enter 选择，直接定位、高亮并打开档案。谱系未显示的语言标注「仅时间长河」，选中后切到时间长河；无匹配时可携带查询进入全量馆藏检索。

地图选中 JavaScript、Python、Lua 或 Scheme 时，名称右侧显示 `▶` 运行图标，点击或键盘 Enter 可直接打开对应实验台，焦点随即进入代码编辑器；其他未接入网页运行时的语言不显示此标识。图标只表示已具备执行入口；Python默认远端需要连接私有API，或明确启用本地环境。加载失败或超时仍显示真实错误。

实验台提供可编辑且高亮的代码。新增变量、循环、函数、集合四类原创完整示例，覆盖 JavaScript、Python、Lua、Scheme、Ruby、C、C++、Java、C#；后四种仍仅编辑。草稿按语言和主题保存在本机（最多80份，每份最多131,072字符，受浏览器存储配额限制），切换主题和刷新后可恢复；存储不可用时保留当前页面内存并明确提示。支持导入UTF-8代码文件（最多128 KiB）、下载当前代码、恢复示例及恢复替换前草稿；导入/恢复示例不会自动执行，令牌和stdin不进入草稿存储。文件操作与完整环境说明可展开查看，运行时可手动停止，结果保留真实诊断并区分常见错误类别。JavaScript 在浏览器 Worker 中真实执行，超过2秒会停止。Python、Ruby 默认选择远端执行，点击运行才上传，编辑不自动提交；需要连接私有 Docker 服务并输入令牌，远端API已部署到正式域名，保持私有令牌访问，核验记录见部署说明。Python 可切换浏览器本地并明确点击「下载并启用」，加载约13.53 MB未压缩的固定 Pyodide文件，加载90秒、执行3秒预算。Lua 5.4.5 使用 Wasmoon 1.16.0 Wasm（约413 KiB），Scheme 使用 BiwaScheme 0.8.3 JavaScript解释器（约244 KiB，非Wasm），两者也需要明确启用，加载30秒、执行2秒预算。本地启用后编辑自动执行；离开实验台或后台停止活动任务。Ruby仅有私有Docker远端执行，尚无本地Wasm实现。无服务或加载失败显示真实错误，不伪造结果或自动回退。首版私有试看、资源限制、镜像来源与核验见 [Docker执行说明](docs/EXECUTOR.md)。

Lua每次运行新VM，支持print和基础标准库，不提供文件、系统、第三方模块；Scheme每次新环境，支持多数R7RS small功能，syntax-rules、异常、库系统不完整，字符串不可变、整数精度受JS数值限制，不提供JS互操作、文件/网络或第三方模块。本地文件、许可和SHA清单纳入源码，构建离线核验；Scheme核心验证从固定原模块精确派生。C、C++、Java、Go、Rust、Bash、Korn shell、tcsh提供可编辑示例，尚未接入执行环境；Shell样例保留本机实际核验版本。其他语言可记草稿。Worker不是安全沙箱，请只执行信任的代码。

实验台新增运行环境状态条，区分未启用、资源读取、初始化、可运行、执行中、完成与失败；远端另显示连接、等待令牌和排队状态。Python/Lua 的核心资源进度按真实读取的解压后字节统计，不代表全部运行文件的网络传输量；浏览器可能复用 HTTP 缓存，初始化阶段显示不定进度，不伪造百分比。失败时可重新连接、重新加载或重试运行，Python 代码错误后的重试复用已就绪环境。本地 Python 版本从实际运行时读取，远端版本由执行 API 返回。

右上角明暗主题按钮支持亮色与深色；首次访问跟随系统，手动选择后保存在本机并覆盖系统偏好。亮色主题覆盖地图、名称与连线、检索、档案、实验台代码高亮和出处页，不改变数据或运行模式；切换主题保留当前草稿与地图选择。

JavaScript、Python、Lua 与 Scheme 的捕获输出最多保留 20,000 个字符，JavaScript 另保留最多 200 次日志调用。输出过多时优先保留运行异常，避免错误被日志截断。捕获上限只约束日志存储，程序自身的内存分配仍会消耗设备资源。

离开实验台或页面进入后台时会停止加载与活动任务，并取消等待运行的编辑。返回可见的实验台后，本地已启用环境对被中断的任务重新执行最新草稿；远端始终需手动运行。已经完成的本地结果会复用。空闲 Python Worker 设置 3 分钟释放定时，实际触发时机受浏览器后台定时器调度影响。

## 语言对比

语言对比页提供 C/C++、Java/C#、Python/JavaScript、Lua/Scheme 四组快捷入口，也可在上述九种语言间自由选择。共同任务复用实验台四类原创示例，注明语法版本、语言资料入口与执行范围；宽屏并排，窄屏上下排列并在页签内滚动。来源年代、创造者来自当前馆藏，设计取向为带资料入口的简要概述，不替代完整设计史。

直接关系、上下游及证据状态从同一构建的关系盘点读取，可打开已有关系依据和语言档案。待补证关系继续标明待补，不由语法相似性新增连线。运行入口进入对应主题实验台，保留该主题已有草稿和本地下载同意；未接入运行时的语言仅提供编辑入口。浏览器与本机示例核验见 `data/audit/learning-browser-checks.json`、`data/audit/learning-native-checks.json`，本机通过不表示新增网页运行时。

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

发布诊断可离线检查当前源码提交、`dist/` 文件清单、PLDB 快照和人工审查哈希：`npm run diagnose:release`。也可用 `npm run diagnose:release -- --url https://codemuseum.freexlib.com` 只读比较线上 `/data/provenance.json` 的来源哈希、记录数和关系计数；网络失败或线上版本不一致会以非零状态退出，不会修改本地或线上文件。

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

构建将人工审查输入原样保存为站点的 `/data/audit-reviews.json`，保留完整摘录、来源哈希、读取时间、访问失败和范围说明。现有 `/data/provenance.json` 的 `meta.reviewEvidence` 提供该文件路径、SHA-256、记录与已阅读来源数量。当前只有 83 条人工审查记录及 166 条已阅读来源，不代表 5,155 条馆藏全部核实；下载文件的哈希证明字节对应这次输入，不能单独证明史料内容正确。

有出处的名称、年代或作者校订保存在人工审查的 `catalogueCorrection` 中。构建与审计共用校验器，要求原值精确匹配固定快照、校订出处已在同条审查中阅读，年代必须指明事件；原始快照不改写。详情展示原值、校订值、理由与出处，导出证据保留完整校订。作者字段缺失可用 `from: null` 与 `fromMissing: true` 明确补录，校验会拒绝原字段已出现的过期补录；详情显示“未记载 → 作者”，审计保留原作者字段是否存在与展示值。首例是 `sh`：Bourne shell (sh)，1979 年 Unix V7 发布；原始 1971 年值保留。

更新馆藏是显式操作：取得新的 PLDB 快照，核查后替换原始文件，并更新清单中的来源时间、SHA-256、记录数量和语言数量；随后运行构建及测试。固定快照的数量断言也应在确认变化后更新。构建不会自动获取“最新版”。关系类型没有出处时不能凭相关链接补作影响关系。

PLDB 的公开领域说明见 https://github.com/breck7/pldb/blob/main/readme.scroll 。本项目只使用当前规范化器选择的字段，不将上游快照中附带的第三方代码范例自动放到页面上；上游材料中的单独许可仍应保留和尊重。

## Git 与发布

提交 `src/`、`public/`、`data/`、`scripts/`、`tests/`、项目配置及需要保留的档案。`dist/` 和 `node_modules/` 被忽略。

新机器拉取这些文件后执行 `npm run build` 即可恢复网站。发布前同样先运行构建，把生成的 `dist/` 交给静态托管服务。`.openai/hosting.json` 只是托管配置，不参与本地生成，也不需要凭证才能构建。

`npm test` 会在独立临时目录仅复制源码输入（不复制 dist、node_modules、Git 或临时下载），重建并比较连续两次输出的逐文件哈希；同时验证坏快照不会覆盖上一次成功结果。预览服务检查覆盖未变化的文件返回 304、运行文件重建后缓存失效、HEAD 请求及目录访问边界，无需启动网络端口。

## 服务端发布与访问量

正式站点为 [codemuseum.freexlib.com](https://codemuseum.freexlib.com)，已配置 HTTPS。GitHub Actions 提供 master 分支测试、离线构建和独立 release 发布。生产域名累计 UV/PV 通过同域接口写入独立 SQLite，网站右上角主题按钮旁展示访客与访问，点击可查看 UV/PV 对照、统计口径与起始日期；接口不可用时显示“—”。管理员可经 SSH 查询与备份。上线状态、发布方式和统计边界见 [部署说明](docs/DEPLOYMENT.md)。

## 开源项目与致谢

「出处与说明」公开实际运行时、数据来源和参考资料，实验台的「项目与许可」入口跳到对应展签。Pyodide、Wasmoon/Lua和BiwaScheme版本从固定运行时清单读取；JavaScript说明为浏览器原生能力，不误标第三方执行库。PLDB、GitHub Linguist使用固定快照日期/提交，TIOBE标明参考榜单月份；历史论断仍在具体档案和关系旁保留引用。运行时许可继续随assets发布，Linguist版权许可从已纳入版本管理的输入校验后发布到licenses/；致谢不替代许可文件。

维护文案在 `data/credits.json`，构建通过 `scripts/credits.cjs` 合并版本/快照证据，输出 `/data/credits.json` 和网页用的数据脚本。新增或升级运行时时，同步用途、适配与限制说明；不要把尚未接入的运行时列为实际使用。页面由 `src/credits.js` 渲染。

## 关系证据与常显语言盘点

地图连线支持鼠标点击及键盘 Enter/空格打开「关系依据」，展示关系类型、论证、原文摘录、读取时间、SHA-256 与待核事项；档案的「查看关系依据」也能进入。设计层与生态层保持独立。交叠连线按点击到实际曲线的距离选择，距离相近时提供关系列表；不让透明命中区域挡住其他线。原文摘录已存不表示历史论证已经全部成立。

出处页的「关系核对」逐项列出全部常显标签的设计上游、下游、生态关系和证据缺口，支持筛选暂无地图设计连线或仍需复核的条目，并跳回语言档案。全馆入口仍保留。常显标签、关系总数与待核状态由同一次构建生成，不手动维护网页计数。

`npm run relations:audit` 从固定输入离线生成 [逐语言盘点](docs/audit/RELATIONSHIP_STATUS.md)和 `data/audit/relationship-status.json`；构建独立重算并公开 `/data/relationship-status.json`。检查原始人工关系重复、无效/自连端点、类型和来源 URL，列出缺论证、引用缺摘录、引用哈希版本差异、年代顺序及设计环路；结构错误阻止替换旧站点，年代警告保留研究线索。人工复核决定保存在 `data/audit/relationship-decisions.json`。没有来源摘录的引用不会被自动归为已存原文证据。它是当前数据体检，不是历史关系完整性的证明。

2026-10-08 补核 Scala 设计者2006年概述第1页和 Rust 官方影响清单，新增 C#→Scala、Swift→Rust，并为 Java→Scala 和七条既有 Rust 影响补存原文依据。Java→C# 的旧读者定位论证保留为「直接设计依据待补」。Dart、Zig、XSLT、汇编总称仍保留设计层地图缺口，不凭编译目标、接口或文献引用补造设计继承。研究范围见 [本轮记录](docs/audit/RELATIONSHIP_RESEARCH_2026-10-08.md)。

## 私有 Docker 执行原型

已实现 Python/Ruby受限执行API和同源本机代理；默认不下载本地解释器，明确启用后再加载。`EXECUTOR_TOKEN`设置后执行 `npm run executor:preview` 可通过现有xshow SSH打开 http://127.0.0.1:4174/#lab ，30分钟临时试用，Ctrl+C结束。步骤见 [执行说明](docs/EXECUTOR.md)。普通runc共享宿主内核，仅用于受信任私有运行；已按用户指令部署同域HTTPS与常驻服务，仍需私有令牌，CI不获Docker权限。真实Docker限制和前端端到端证据分别保存在 `data/audit/executor-checks.json` 和 `data/audit/executor-browser-checks.json`。
