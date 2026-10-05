# ALGOL 60 本机样例核验

核验日期：2026-10-04。此记录验证 GNU MARST 2.8 在本机的少量实际执行，不是网页运行时或完整语言符合性认证。

## 来源与构建

官方归档：<https://ftp.gnu.org/gnu/marst/marst-2.8.tar.gz>，1,400,370 字节，完整压缩响应的 SHA-256：

```text
d77f4703b0b44b50be57908f9d556ee6c3bedd97d638c42949d6aec84f8070ba
```

下载字节与人工审查记录一致；解包限制为安全相对路径的文件和目录。MARST README 声明实现 1976 Modified Report 的 Level 0 硬件表示，不能把它等同于所有 ALGOL 60 历史版本。

在解包后的源码目录执行：

```sh
./configure --prefix=/tmp/codemuseum-marst-2.8-install CC=/usr/bin/clang
make -j2
```

未执行 `make install`，未修改系统编译器或全局工具安装。网站不保存或引用临时目录中的二进制；离线构建仍仅依赖项目输入。重新核验需要自行取得并构建该版本工具链。

## 执行与原始记录

```sh
python3 scripts/verify-algol60.py \
  --runtime-dir /tmp/codemuseum-marst-2.8-source/marst-2.8 \
  --archive-sha256 d77f4703b0b44b50be57908f9d556ee6c3bedd97d638c42949d6aec84f8070ba
```

核验器不会下载或安装。归档哈希参数是调用者单独核对后提供的取得来源声明；核验器自身计算翻译器、静态库、头文件及样例哈希，不会从编译产物反推归档一致性。

每个原创程序依次经过 MARST 翻译、Clang `-std=c89` 编译及原生执行，每个进程限时30 秒。

|样例|预期及实际输出|结果|
|---|---|---|
|1 到10 求和|55|三步退出0|
|递归阶乘6|720|三步退出0|
|传名调用求数组之和|6|三步退出0，编译有警告|
|错误输入 `begin integer ; end`|翻译拒绝|退出1，保存诊断|

环境为 macOS arm64、Apple Clang 21.0.0。完整程序、输出（包含尾部空白）、命令、诊断及版本见 [原始 JSON](../../data/audit/algol60-runtime-checks.json)。审计将该记录与既有本机记录合并，累计14 个语言样例通过；既有 Lua 架构错误保留。

## 结果边界

传名调用生成的 C 对 `global_dsa` 存在多个未排序修改，Clang 给出 `-Wunsequenced` 警告。当前默认编译条件下输出正确，不证明优化后、其他平台或编译器结果一致。构建旧工具本身的警告也不能因样例通过而视为已修复。

三个正例及一个反例只证明这些输入在本机的行为；未验证完整标准、所有语法、运行库或跨平台兼容。实验台仍未启用 ALGOL 60 执行。该运行记录也不能证明 ALGOL 60 与 Pascal、Simula、Oberon 等具体历史影响关系，关系仍按独立史料分层审查。
