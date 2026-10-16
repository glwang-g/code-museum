# 插画资产

- `history-river.0992af42abfd.webp`：当前语言长河使用的压缩背景，640 × 427，9,064 字节。文件名包含内容 SHA-256 前 12 位；构建校验哈希及小于 10,000 字节的预算。原始插画保留在 `archive/assets/history-river-original.png`，不进入站点构建。
  压缩命令：`cwebp -resize 640 0 -size 10000 -pass 8 -m 6 -metadata none archive/assets/history-river-original.png -o <目标.webp>`。压缩后的固定字节随源码保存，构建无需安装 cwebp。
- `language-world-tree.png`：早期古树版本插画，保留用于历史追溯。

两张插画均为本项目通过内置图像生成工具创作的资产，必须随源码保存。构建只复制文件，不调用生成模型；不能依赖重新生成获得相同像素。

长河的生成提示以山川长河图卷为目标：从左侧群山流向右侧落日海面，宽阔曲折的碧色河流、支流汇合、河岛与白色激流，科学考察地图与山水长卷的风格，无文字和界面。
