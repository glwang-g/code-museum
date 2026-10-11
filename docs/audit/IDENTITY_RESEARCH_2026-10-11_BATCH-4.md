# 身份别名批次 4

日期：2026-10-11

本批处理工具/框架/编辑器与语言混淆的四个明确别名，不修改 PLDB 原始快照：

| 记录 | 排除别名 | 核读结论 | 来源与读取哈希 |
| --- | --- | --- | --- |
| Markdown (`markdown`) | `pandoc` | Pandoc 官方称自身为 universal document converter；它是转换工具，不是 Markdown 语言。 | `https://pandoc.org/`；SHA-256 `6b2b1908be4907f849344967b87562160c2afffc090046a8797f323c8b03356a` |
| Batchfile (`batch`) | `winbatch` | WinBatch 官方称其为 Windows 宏脚本语言并使用 WIL；与 Batchfile 是不同语言。 | `https://www.winbatch.com/`；SHA-256 `d15e1981fb121d3184811643c4967d58f5cbd708f13ae428818d5298cda055cb` |
| Vim script (`vim-script`) | `vim` | Vim 手册把 Vim script 定义为脚本语言；Vim 本身是编辑器。 | `https://vimhelp.org/usr_41.txt.html`；SHA-256 `a929c55077daf13847f2c0385d3ed87fb9ff10a03314bdb9cd72fb5fa4ac5ec7` |
| Jinja (`jinja`) | `django` | Django 官方文档把自身模板系统称为 DTL，并把 Jinja2 列为独立模板后端；框架名不能直接等价为 Jinja。 | `https://docs.djangoproject.com/en/stable/topics/templates/`；SHA-256 `69e1d4c4fe6e4f6df640f4f4cff705d24c97fa7b966dd666702dd82a555d1aa9` |

身份问题总线索仍为 126 行；未决身份由 115 降至 111，已明确处理的误别名由 11 增至 15。
