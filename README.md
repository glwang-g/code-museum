# Code Museum

**The Museum of Programming Languages** — 一座可以漫游、检索、比较和动手运行的编程语言博物馆。

[进入正式网站](https://codemuseum.freexlib.com) · [查看源码仓库](https://github.com/glwang-g/code-museum) · [在线阅读本文档](https://github.com/glwang-g/code-museum/blob/master/README.md)

## 这是一个什么项目

Code Museum 把编程语言当作一座可以探索的博物馆：你可以沿着时间长河浏览语言，打开关系谱系查看设计来源，搜索完整馆藏，比较不同语言解决同一问题的方式，也可以在实验台中编辑并运行一部分真实代码。

项目的核心想法很简单：语言之间的关系应该有出处，运行结果应该来自真实环境，缺少证据的地方应该明确标成待核，而不是用看起来合理的故事填满地图。

## 你可以体验什么

- **时间长河**：按馆藏来源年代浏览语言和计算史背景，保留完整馆藏入口，不只展示热门语言。
- **关系谱系**：在“设计脉络”和“实现与生态”之间切换。设计影响、后继/扩展关系与 C ABI、平台和工具互操作分开显示。选中语言默认只展开直接关联，可按上游/下游及 1–3 层逐级展开，也可显示全部前序与后续；支持返回上一语言。
- **语言展品**：JavaScript、Python、Lua、Scheme、C、C++、Java、Rust 的档案新增设计背景、核心规则、原创注释代码与版本边界，可继续阅读设计依据或进入实验台改写。
- **语言检索**：搜索名称、别名、创造者或馆藏 ID，支持全量馆藏和性质筛选。
- **语言实验台**：编辑带高亮的示例代码，保存本机草稿，导入或下载代码，并查看真实诊断。JavaScript、Python、Lua、Scheme 支持浏览器内运行；远端已接入56门，连同浏览器模式共59个可执行语言节点（Python重叠）。免令牌模式最多允许5个活跃执行会话，第6个提示“当前访问比较多，请稍后重试。”；具体语言、版本、部署状态和边界见 [执行说明](docs/EXECUTOR.md) 与 [免令牌说明](docs/GUEST_EXECUTION.md)。
- **语言对比**：用相同主题比较 C/C++、Java/C#、Python/JavaScript、Lua/Scheme 等语言，并沿着学习导览继续探索。
- **学习导览**：5 条路线、27 个步骤，每步说明观察内容、动手操作及预期；阅读任务和真实运行任务分别说明，JavaScript 入门路线的变量、分支、循环、函数、列表练习及原有 Scheme 平方练习支持真实输出与预期比较及本机完成记录；只核对输出，不评判代码写法。
- **分享与恢复**：URL 保留语言、关系层、展开范围、关系依据或实验台主题，支持刷新及前进后退；分享链接不包含代码、标准输入或执行会话凭据。恢复实验台链接不会自动执行保存的代码。
- **出处与说明**：查看运行时、数据快照、关系证据、许可和馆藏边界，并显示由源码和固定数据生成的内容版本。
- **留言板**：写下意见或建议，留言会公开显示在留言板日志中；如已配置通知服务，维护者会收到提醒。服务只保存昵称、留言内容、当前页面位置及用于限流的匿名标识哈希，不记录 IP、邮箱、账号或原始匿名标识；发送失败时不会显示为已送达。

### 视觉预览

![时间长河视觉资产](public/assets/history-river.0992af42abfd.webp)

当前页面背景为 640 × 427 的 WebP，9,064 字节；原始插画留存在 `archive/assets/`，不进入站点构建。

这张图是网站中的视觉资产，不是自动生成的关系结论；地图上的语言关系仍以馆藏数据和对应出处为准。早期的“语言世界树”原型仍保存在 `public/assets/` 作为历史资产，但不再代表当前产品的主要叙事或关系模型。

## 当前馆藏与证据范围

当前固定 PLDB 快照包含 5,155 条记录，其中 4,608 条被来源标记为语言；经证据筛选的地图节点为 233 个，60 条语言记录已核实语法与实现，11 条记录有历史一手资料。

当前关系盘点共有 461 条关系：451 条设计/历史关系、10 条实现与生态关系。其中 178 条已有匹配的原文摘录，280 条仍只有来源字段，另有 3 条仅有引用出处；后两类都不能视为已经完成历史核实。常显设计层仍有 2 个缺口：Assembly、XSLT；另有 6 项年代提示。

这些数字只描述当前固定输入和审计状态，不表示已经找全所有语言、所有上游或所有历史关系。可以从 [关系状态](docs/audit/RELATIONSHIP_STATUS.md) 和 [研究待办](data/audit/research-gap-report.json) 查看细节。

## 运行环境和边界

- 浏览器中的 JavaScript 使用 Worker 执行，并有输出和时间限制。
- Python 的本地模式使用固定版本 Pyodide；Lua 使用 Wasmoon/Lua 5.4.5；Scheme 使用 BiwaScheme 0.8.3。它们都明确说明兼容范围，不冒充完整系统环境。
- 远端执行通过同源网关接入受限容器；免令牌模式要求worker使用gVisor/runsc，最多5个活跃浏览器会话、每会话1个在途任务，两台机器合计执行并发2。源码只在任务期间进入临时执行容器，不存入网站数据库。会话闲置5分钟释放，限流不等于识别5个真实用户。
- P1 新增十二门语言沿用固定受限执行协议：TypeScript 5.9.3 严格类型检查通过后才由 Node.js 执行；SQL 使用 SQLite 3.53.4 安全模式与每次独立内存库；Bash 5.3.9、GNU awk 5.3.2、GNU sed 4.9 支持多行标准输入；PHP 8.3.36 使用最小 CLI 配置并限制系统命令、网络和文件访问；Perl 5.42.2 只使用预装核心模块，不安装 CPAN 包；XSLT 固定 1.0（libxslt 1.1.43），禁网、禁止写出；C# 使用 .NET SDK 10.0.403 的 Roslyn 与预装参考程序集，任务期间不还原 NuGet 包；Fortran 使用 GCC 14.3.0 中的 GNU Fortran 和 Fortran 2008 标准选项。Pascal 使用 Free Pascal 3.2.2 / ObjFPC 模式和基础 RTL；R 使用 Rscript 4.2.2、预装基础包和文本输出，不在线安装 CRAN 包或导出绘图。固定 CLI 工具包约 20 MB，Pascal/R 的独立固定包约 40 MB，留在服务端构建输入，不随网页下载。生产未升级时入口明确显示服务不可用；没有自动回退。
- 尚未接入网页运行时的语言不会显示伪造的运行结果；本机通过也不等于网页或生产环境已经接入。
- 留言板依赖正式站后端 `/api/messages`；本地预览或后端未接入时会明确显示服务不可用，不会显示任何伪造留言。只有服务器配置了 SMTP 凭据才会发信，未确认送达的留言保持待通知状态。
- 浏览器Worker、容器和gVisor各有边界；资源和隔离检查不构成不存在逃逸漏洞或全语言语义认证。尚未满足runsc健康条件的节点不会对guest开放。

完整的运行范围、版本、资源限制和本机/生产边界见 [执行说明](docs/EXECUTOR.md) 与 [本机环境说明](docs/LOCAL_ENVIRONMENT.md)。

## 正在推进的事项

2026-11-10更新：免令牌功能提交 `f163b27` 已通过 [Actions](https://github.com/glwang-g/code-museum/actions/runs/42649436958)正式部署。56门远端已逐一通过生产匿名真实执行，Chrome宽窄屏和第6会话繁忙提示通过；页面令牌与权限申请已移除，内部鉴权保留。详见 [部署记录](docs/DEPLOYMENT.md)。以下B组发布记录保留为历史阶段。

原 B 组37门已按P2、P3顺序完成固定工具链、源码、真实执行与页面接入。2026-11-09，正式发布提交`f2ff0bf`已通过Actions并部署，正式页面现提供59个可执行语言节点（4浏览器 / 56远端，Python重叠），由xshow 42门、xshow2 14门的私有网关服务配合。新站 [73项正式HTTPS/Chrome验收](data/audit/b37-site-runtime-checks.json)通过，含全56门逐一正例、7种语言1440/390页面以及Python错误与恢复；[公开数据一致性](data/audit/b37-site-consistency.json)通过。

源码与公开固定输入已推送master，[Actions 42603930037](https://github.com/glwang-g/code-museum/actions/runs/42603930037)的build/deploy均成功；[CI后线上核验](data/audit/b37-ci-release.json)确认发布包与完整验收版本逐字节一致，临时资料分支已清理。ALGOL 60 传名调用仍有已知生成代码警告，Oberon 为 OBNC 的最终2016语言实现；Groovy 运行预算为8秒，含 JVM 启动和脚本编译，语言档案与超时提示的旧3秒文案已修正。B组其余36门的固定工具链输入已写入本轮发布提交；BCPL的完整上游归档尚无明确的全包公开再分发授权，六项上游私有材料继续本机固定保存，不上传公共仓库。各语言版本与语义边界见 [临时逐门记录](data/audit/runtime-rollout.json) 与 [构建计划](docs/audit/RUNTIME_BUILD_PLAN.md)；逐门记录保留为临时验收历史，当前生产状态以正式报告为准。

- 继续为常显标签和高价值关系寻找可回溯的一手资料，减少“只有来源字段”的关系。
- 研究 XSLT、Zig 和具体汇编方言的历史设计来源；不把参考文献、ABI、编译目标或语法相似性直接当成继承关系。
- 继续区分馆藏原始字段、人工校订、设计证据和实现/生态证据。
- 逐步补充更多真实运行环境，但保持每种语言的版本、许可、限制和核验记录可见。
- 双节点后端已通过10项常驻canary、原63项正式检查及8项鉴权/取消/恢复检查；本轮静态发布另通过73项执行/页面验收与[6项服务检查](data/audit/b37-site-service-checks.json)。历史运行权限申请现已退役，不接收或发送新申请，原记录保留；普通留言通知继续工作。部署与回退见 [部署记录](docs/DEPLOYMENT.md) 和 [双节点说明](docs/DUAL_NODE_DEPLOYMENT.md)。

现有 6 项年代警告和 Assembly/XSLT 两个缺口在相关档案或关系依据中显示证据分诊与下一步；分诊不代表新增一手史料核实，原待核计数继续保留。

研究过程见 [项目上下文与交接](docs/PROJECT_CONTEXT.md) 以及 [关系研究记录](docs/audit/)。

## 从源码运行

需要 Node.js 22 或更高版本。网站构建不需要联网下载数据，也不需要先执行 `npm install`：浏览器资源和网站所需公开元数据均为固定项目输入。BCPL采用 [受限输入策略](data/runtime-input-policy.json)，从公开源码也能离线构建相同网页；重建BCPL镜像另须预先具备原清单匹配的私有包，不能只凭公共仓库完整重建，见 [执行说明](docs/EXECUTOR.md)。

```sh
npm run build
npm run preview
```

然后打开 <http://127.0.0.1:4173>。开发时也可以使用：

```sh
npm run dev
```

构建和测试：

```sh
npm test
npm run audit
npm run relations:audit
npm run diagnose:release
npm run museum:browser # 需已安装 Chrome，验证地图性能、展品与学习路线
npm run performance:browser # 测量点击后取景稳定时间、节点复用与缓存
```

`npm test` 会在独立临时目录中从源码输入重建网站，并检查构建可复现、坏输入保护和预览服务边界。已安装 Chrome/Chromium 时，可按 [浏览器核验说明](docs/PROJECT_CONTEXT.md) 中的范围运行真实浏览器检查。

## 数据、许可与文档

- 固定 PLDB 快照、审查记录和关系证据位于 `data/`。
- 网站源码位于 `src/`，原始静态资源位于 `public/`，构建入口位于 `scripts/`。
- 不要直接编辑 `dist/`；它由构建生成，也不作为源码输入提交。
- 数据来源、运行时许可和版本入口在网站“出处与说明”页公开；上游许可仍以各项目自己的声明为准。

更多信息：

- [项目上下文与交接](docs/PROJECT_CONTEXT.md)
- [部署说明](docs/DEPLOYMENT.md)
- [私有执行说明](docs/EXECUTOR.md)
- [只读 MCP 说明](docs/MCP.md)
- [馆藏完整性审计](docs/audit/INTEGRITY.md)
- [关系状态与研究记录](docs/audit/RELATIONSHIP_STATUS.md)
- [关系研究台账](docs/audit/RELATIONSHIP_RESEARCH_LEDGER.md)

## 网站与源码互链

正式网站的“出处与说明”页提供返回本 README 和 [GitHub 源码仓库](https://github.com/glwang-g/code-museum) 的链接；README 也提供 [正式网站](https://codemuseum.freexlib.com) 入口。网站内容以实际发布版本为准，源码中的构建、审计和历史记录则保留完整复现依据。
