# Code Museum

**The Museum of Programming Languages** — 一座可以漫游、检索、比较和动手运行的编程语言博物馆。

[进入正式网站](https://codemuseum.freexlib.com) · [查看源码仓库](https://github.com/glwang-g/codemuseum) · [在线阅读本文档](https://github.com/glwang-g/codemuseum/blob/master/README.md)

## 这是一个什么项目

Code Museum 把编程语言当作一座可以探索的博物馆：你可以沿着时间长河浏览语言，打开关系谱系查看设计来源，搜索完整馆藏，比较不同语言解决同一问题的方式，也可以在实验台中编辑并运行一部分真实代码。

项目的核心想法很简单：语言之间的关系应该有出处，运行结果应该来自真实环境，缺少证据的地方应该明确标成待核，而不是用看起来合理的故事填满地图。

## 你可以体验什么

- **时间长河**：按馆藏来源年代浏览语言和计算史背景，保留完整馆藏入口，不只展示热门语言。
- **关系谱系**：在“设计脉络”和“实现与生态”之间切换。设计影响、后继/扩展关系与 C ABI、平台和工具互操作分开显示。
- **语言检索**：搜索名称、别名、创造者或馆藏 ID，支持全量馆藏和性质筛选。
- **语言实验台**：编辑带高亮的示例代码，保存本机草稿，导入或下载代码，并查看真实诊断。JavaScript、Python、Lua、Scheme 支持浏览器内运行；Python、Ruby、C、C++、Rust、Go、Java 以及部分编译语言可使用受限的私有远端环境。
- **语言对比**：用相同主题比较 C/C++、Java/C#、Python/JavaScript、Lua/Scheme 等语言，并沿着学习导览继续探索。
- **出处与说明**：查看运行时、数据快照、关系证据、许可和馆藏边界。

### 视觉预览

![时间长河视觉资产](public/assets/history-river.png)

![语言世界树视觉资产](public/assets/language-world-tree.png)

这两张图是网站中的视觉资产，不是自动生成的关系结论；地图上的语言关系仍以馆藏数据和对应出处为准。

## 当前馆藏与证据范围

当前固定 PLDB 快照包含 5,155 条记录，其中 4,608 条被来源标记为语言；经证据筛选的地图节点为 233 个，60 条语言记录已核实语法与实现，11 条记录有历史一手资料。

当前关系盘点共有 428 条关系：421 条设计/历史关系、7 条实现与生态关系。其中 99 条已有匹配的原文摘录，329 条仍只有来源字段，不能视为已经完成历史核实。常显设计层仍有 3 个缺口：Assembly、XSLT、Zig；另有 5 项年代提示。

这些数字只描述当前固定输入和审计状态，不表示已经找全所有语言、所有上游或所有历史关系。可以从 [关系状态](docs/audit/RELATIONSHIP_STATUS.md) 和 [研究待办](data/audit/research-gap-report.json) 查看细节。

## 运行环境和边界

- 浏览器中的 JavaScript 使用 Worker 执行，并有输出和时间限制。
- Python 的本地模式使用固定版本 Pyodide；Lua 使用 Wasmoon/Lua 5.4.5；Scheme 使用 BiwaScheme 0.8.3。它们都明确说明兼容范围，不冒充完整系统环境。
- C、C++、Rust、Go、Java、Python 和 Ruby 的远端执行使用私有令牌和受限容器；源码只在任务期间进入临时执行容器，不提供匿名公共沙箱。
- 尚未接入网页运行时的语言不会显示伪造的运行结果；本机通过也不等于网页或生产环境已经接入。
- Worker 和普通容器都不是对抗恶意代码的完整安全边界，只应运行信任的短程序。

完整的运行范围、版本、资源限制和本机/生产边界见 [执行说明](docs/EXECUTOR.md) 与 [本机环境说明](docs/LOCAL_ENVIRONMENT.md)。

## 正在推进的事项

- 继续为常显标签和高价值关系寻找可回溯的一手资料，减少“只有来源字段”的关系。
- 研究 XSLT、Zig 和具体汇编方言的历史设计来源；不把参考文献、ABI、编译目标或语法相似性直接当成继承关系。
- 继续区分馆藏原始字段、人工校订、设计证据和实现/生态证据。
- 逐步补充更多真实运行环境，但保持每种语言的版本、许可、限制和核验记录可见。

研究过程见 [项目上下文与交接](docs/PROJECT_CONTEXT.md) 以及 [关系研究记录](docs/audit/)。

## 从源码运行

需要 Node.js 22 或更高版本。构建不需要联网下载数据，也不需要先执行 `npm install`：固定的运行时资源已经纳入项目输入。

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

正式网站的“出处与说明”页提供返回本 README 和 [GitHub 源码仓库](https://github.com/glwang-g/codemuseum) 的链接；README 也提供 [正式网站](https://codemuseum.freexlib.com) 入口。网站内容以实际发布版本为准，源码中的构建、审计和历史记录则保留完整复现依据。
