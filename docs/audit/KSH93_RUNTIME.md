# ksh93 本机核验

## 实际结果与范围

2026-10-04 使用已安装的 `/bin/ksh`，通过 `ksh -c 'print -r -- "${.sh.version}"'` 得到 `Version AJM 93u+ 2012-08-01`，退出码为 0。这个程序的 `--version` 输出版本但退出码为 2，因此复现脚本使用 `.sh.version`，不把非零的版本查询当作执行失败。

两份原创程序均先通过 `ksh -n`，再真实执行：

- 算术循环计算 1 至 10 的和，输出 `55`。
- 索引数组传值给函数并乘以 2，输出 `12`。
- 非法 `if then` 程序被语法检查拒绝，保留非零退出码与错误文本。

证据仅支持本次 ksh93u+ 程序，不代表运行了1988/1993原始二进制、所有版本的兼容性或完整标准符合性；网站未接入 ksh 在线运行。

## 离线复现

```sh
python3 scripts/verify-ksh93.py
npm run audit
```

脚本不下载或安装工具，在临时目录写入原创程序，清除 `ENV`、`FPATH`、`KSH_ENV` 后调用已安装的 ksh。不存在工具、不能确认 ksh93、样例输出不符或非法程序未被拒绝时不替换已有证据。

`data/audit/ksh93-runtime-checks.json` 保存程序、SHA-256、版本查询、语法检查、执行命令、实际输出及错误。馆藏审计验证这些字段后合并本机执行状态。默认构建不依赖 ksh；默认测试验证证据拒绝规则，不调用这个本机处理器。

## 与历史关系的区别

[David G. Korn，USENIX 1994 全文](https://www.usenix.org/legacy/publications/library/proceedings/vhll/full_papers/korn.ksh.a) §2 叙述从修改 Bourne shell 的表单脚本系统形成 ksh，加入 C shell 历史、别名及作业控制，并以 C 表达式的小子集实现算术。§5.1 进一步说明 ksh93 的 C 算术运算符和类似 C 的 for 语句。其完整函数/数组程序与发行叙述支持历史语言审查。

这些设计论证独立于本机执行证据。解释器用 C 编写、使用 Algol-like C 源码形式以及与 awk/perl/tcl 的功能比较，不自动成为设计继承；论文关于 System V、ksh88/ksh93 的兼容叙述也不扩大为所有现代版本的严格超集。
