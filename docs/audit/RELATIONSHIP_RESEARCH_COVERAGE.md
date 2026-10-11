# 关系研究覆盖盘点

由 npm run research:coverage 根据当前关系审计和研究台账生成。它只记录“哪些关系已经进入过研究批次”，不把来源字段当作历史证据，也不推断未记录关系。

## 当前分桶

- 全量关系：461
- 已有原文摘录（不属于当前待处理 280 条）：178
- 当前来源字段待核：280
- 待核中已研究但未升级：47
  - 已收口、没有合格来源：41
  - 来源或端点受阻：6
- 待核中从未进入已记录研究批次：233

“从未进入已记录研究批次”不等于历史上没有关系，只表示当前台账没有这条关系的研究记录。后续可以从这里挑选新批次；“已收口”项目除非满足 reopenWhen，不再重复搜索。

## 已研究但没有结果：已收口

| 关系 | 批次 | 结论 |
| --- | --- | --- |
| ada → chapel → influencedBy | 2026-10-11_BATCH-41 | The Chapel overview paper's primary-influence list (C, Modula, Fortran, C++, Java, C#, CLU, Scala, ML, Perl, Matlab) does not include Ada. |
| algol-60 → modula → influencedBy | 2026-10-10_BATCH-17 | Wirth-family continuity and later Modula documentation were not treated as proof of a direct ALGOL 60 design edge; no qualifying direct statement was secured in this batch. |
| algol-60 → oberon → influencedBy | 2026-10-10_BATCH-17 | The official Oberon report is useful for Oberon’s own specification, but this batch did not obtain a direct ALGOL 60 design-source statement; intervening Modula history is not collapsed into a direct edge. |
| c → jule → influencedBy | 2026-10-11_BATCH-40 | Jule's design mission page states C/C++ only as a first-class interoperability goal and compile target, not as an overall design influence. |
| c → mojo → influencedBy | 2026-10-11_BATCH-40 | Mojo's official documentation discusses lessons from other languages (e.g. Swift, C++, Rust, Zig) but does not list C as a design influence; scope is a missing listed influence, not proof of absence. |
| c → speedie → influencedBy | 2026-10-11_BATCH-40 | Speedie documentation only notes C-library integration and performance comparison, not C as an overall design source. |
| c → wa → influencedBy | 2026-10-11_BATCH-41 | The Wa README describes a WebAssembly-oriented design goal but states no C design influence. |
| cpp → jule → influencedBy | 2026-10-11_BATCH-40 | Jule's design mission page states C/C++ only as a first-class interoperability goal and compile target, not as an overall design influence. |
| cpp → particles → influencedBy | 2026-10-11_BATCH-41 | The Particles project page is a minimal index and states no C++ design influence. |
| cpp → speedie → influencedBy | 2026-10-11_BATCH-40 | Speedie documentation only compares against idiomatic C++ performance and notes C-library integration; it does not state C++ as an overall design source. |
| cpp → wa → influencedBy | 2026-10-11_BATCH-40 | The wa-lang README describes a WebAssembly-oriented design goal but does not state C++ as a design-influence source. |
| csharp → particles → influencedBy | 2026-10-11_BATCH-41 | The Particles project page is a minimal index and states no C# design influence. |
| fortran → balgol → influencedBy | 2026-10-12_BATCH-42 | Balgol history describes it as "an early dialect of the Algol-58 language"; the compiler focus "shifted from FORTRAN to Algol-58", so FORTRAN is not its design source. |
| fortran → explor → influencedBy | 2026-10-12_BATCH-42 | MINI-EXPLOR is described as "A FORTRAN-Coded Version of the EXPLOR Language": FORTRAN is the implementation language, not the design source of EXPLOR. |
| fortran → particles → influencedBy | 2026-10-12_BATCH-42 | The Particles project page is a minimal index and states no Fortran design influence. |
| go → wa → influencedBy | 2026-10-11_BATCH-41 | The Wa README describes a WebAssembly-oriented design goal but states no Go design influence. |
| javascript → amber → influencedBy | 2026-10-11_BATCH-41 | Amber's official README and docs describe a language compiled to Bash and state no JavaScript design influence. |
| javascript → scroll → influencedBy | 2026-10-11_BATCH-41 | Scroll's site presents the language for scientific writing and lists no design influences. |
| javascript → speedie → influencedBy | 2026-10-11_BATCH-41 | Speedie's README references JavaScript only as a negative comparison ("Doesn't infantilise you like Javascript or Java"), not as a design source. |
| lua → lil → influencedBy | 2026-10-11_BATCH-41 | Lil's documentation does not name Lua among its stated influences. |
| lua → speedie → influencedBy | 2026-10-11_BATCH-41 | Speedie's documentation does not name Lua as a design influence. |
| ocaml → mlscript → influencedBy | 2026-10-12_BATCH-42 | MLscript's README notes only that a paper "used v1 with an OCaml-syntax parser and heavily modified type checker", an implementation detail rather than an overall design influence. |
| prolog → gaea → supersetOf | 2026-10-12_BATCH-42 | The Gaea authors' ICMAS-96 paper describes Gaea as a logic programming language with "Prolog-like backward chain reasoning" but does not declare it a superset of Prolog; the superset claim appears only on PLDB. |
| prolog → progol → supersetOf | 2026-10-12_BATCH-42 | The Progol page describes an ILP system that "allows arbitrary Prolog programs as background knowledge"; it does not state that Progol is a superset of the Prolog language. |
| python → chapel → influencedBy | 2026-10-11_BATCH-40 | Chapel's official overview paper lists its primary influences (C, Modula, Fortran, C++, Java, C#, CLU, Scala, ML, Perl, Matlab) and does not include Python. |
| python → mojo → influencedBy | 2026-10-09_BATCH-16 | Official Mojo material supports Python interoperability and compatibility, not a sufficiently explicit design-influence claim. |
| python → mojo → supersetOf | 2026-10-09_BATCH-16 | Official Mojo material supports Python interoperability and compatibility, not a sufficiently explicit design-influence claim. |
| python → morloc → influencedBy | 2026-10-11_BATCH-40 | Morloc README/docs present cross-language interoperability as the goal and do not state Python as a design-influence source. |
| python → particles → influencedBy | 2026-10-11_BATCH-41 | The Particles project page is a minimal index and states no Python design influence. |
| python → scroll → influencedBy | 2026-10-11_BATCH-41 | Scroll's site presents the language for scientific writing and lists no design influences; the PLDB list mixes related notation/technology rather than design sources. |
| python → speedie → influencedBy | 2026-10-11_BATCH-40 | Speedie documentation only compares against Python (expressiveness) and notes one borrowed syntax form; it does not state Python as an overall design source. |
| r → particles → influencedBy | 2026-10-12_BATCH-42 | The Particles project page is a minimal index and states no R design influence. |
| rust → jule → influencedBy | 2026-10-11_BATCH-40 | Jule's mission page describes an immutable-by-default model 'similar to Rust' as a comparison and states Jule is not functional; it does not declare Rust as a design-influence source. |
| rust → mlscript → influencedBy | 2026-10-11_BATCH-40 | The MLscript README frames the language around type inference, soundness, and pattern matching and does not state Rust as a design-influence source. |
| sql → lil → influencedBy | 2026-10-11_BATCH-41 | Lil's documentation lists APL, J, K and Q as vector-oriented influences and describes its query syntax as only resembling SQL. |
| sql → particles → influencedBy | 2026-10-12_BATCH-42 | The Particles project page is a minimal index and states no SQL design influence. |
| sql → sequel-2 → influencedBy | 2026-10-10_BATCH-17 | The IBM SEQUEL 2 paper identity is present, but the batch could not obtain a stable readable primary copy that directly supports the SQL endpoint claim; the PLDB field remains unupgraded. |
| sql → square → influencedBy | 2026-10-12_BATCH-42 | The SQUARE data sublanguage (Boyce & Chamberlin, 1973) predates SEQUEL/SQL, and the IBM Research entries read do not state that SQUARE was influenced by SQL; the recorded direction is chronologically reversed. |
| sql → tql → influencedBy | 2026-10-11_BATCH-41 | TQL's page compares itself to SQL (plain-text vs binary databases) but states no SQL design influence. |
| typescript → assemblyscript → influencedBy | 2026-10-10_BATCH-17 | AssemblyScript official homepage says TypeScript-like and highlights similarity, but this batch found no explicit design-source statement sufficient to upgrade the field relation. |
| visual-basic → speedie → influencedBy | 2026-10-12_BATCH-42 | Speedie's README lists its influences and does not name Visual Basic as a design source. |

## 已研究但没有结果：受阻

| 关系 | 批次 | 重开条件 |
| --- | --- | --- |
| cpp → real-time-concurrent-c → supersetOf | 2026-10-11_BATCH-40 | A hashable primary copy (paper PDF or abstract page) stating Real-Time Concurrent C's superset relation to C++ is obtained. |
| java → deesel → supersetOf | 2026-10-11_BATCH-41 | A hashable primary Deesel/G page or paper stating the superset relation to Java is obtained. |
| javascript → objective-j → supersetOf | 2026-10-09_BATCH-16 | A stable official Objective-J source or fixed repository revision is available. |
| perl → slash → influencedBy | 2026-10-12_BATCH-42 | A hashable Slash language primary source (project site, docs or paper) is obtained. |
| php → slash → influencedBy | 2026-10-11_BATCH-41 | A hashable Slash language primary source (project site, docs or paper) is obtained. |
| ruby → slash → influencedBy | 2026-10-12_BATCH-42 | A hashable Slash language primary source (project site, docs or paper) is obtained. |

## 全量逐条清单

完整的 233 条“从未研究”和 178 条“已有结果”逐条记录在 [机器可读清单](../../data/audit/relationship-research-coverage.json)。以后生成研究候选时，应排除 researchedNoResultClosed 和 researchedNoResultBlocked，除非满足对应重开条件。
