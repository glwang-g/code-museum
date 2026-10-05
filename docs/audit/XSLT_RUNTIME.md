# XSLT 1.0 本机核验

## 范围与结果

2026-10-04 使用已安装的 `/usr/bin/xsltproc`，报告版本为 libxml 2.9.13、libxslt 1.1.35、libexslt 0.8.20。没有安装工具或接入网页运行时。

两份原创 XSLT 1.0 转换均使用固定 XML 输入（10 至 1 的十个数）：

- `sum(museum/n)` 实际输出 `55`。
- 数值排序后以条件筛出大于 7 的节点，实际输出 `8,9,10,`。
- XML 合法但含非法 XPath 表达式 `1 +` 的样式表被处理器拒绝，保存非零退出码及真实错误。

这些样例证明具体程序在这个处理器上执行，不证明完整标准符合性、全部方言或 XSLT 2.0/3.0。

## 离线复现

```sh
python3 scripts/verify-xslt.py
npm run audit
```

脚本仅使用已安装的 xsltproc，在临时目录写入原创输入和样式表，以 `--nonet` 执行，成功后更新 `data/audit/xslt-runtime-checks.json`。没有外部实体、导入或网络资源；`--nonet` 本身不等于任意不可信 XSLT 的安全沙箱。工具未安装、输出错误或未拒绝非法表达式时不替换先前记录。

证据保存源程序、输入和 SHA-256、命令模板、版本、输出及错误。馆藏审计核验哈希与输出一致性后合并为 XSLT 的本机执行状态；默认构建不依赖 xsltproc。默认测试验证证据拒绝规则，不启动本机处理器。

## 语法与实现来源

- [W3C XSLT 1.0，1999-11-16 Recommendation](https://www.w3.org/TR/1999/REC-xslt-19991116)：定义模板、表达式、变量、参数、条件和结果树语义。1999 是此标准发布事件，暂不替换馆藏 1998 年出现值。
- [GNOME libxslt 1.1.35 源码附带简介](https://raw.githubusercontent.com/GNOME/libxslt/v1.1.35/doc/intro.html)：确认实际 XSLT C 处理器及 libxml/XPath 依赖。

来源阅读时间、响应状态、字节哈希与摘录保存在 `data/audit/reviews.json` 的 `xslt` 审查中。标准使用 XPath 表达式、引用 DSSSL，不足以单独证明设计继承。
