# 画廊闪卡

- 每张卡直接引用 `public/assets/gallery/` 中对应的原画，保留构图、比例和图内签名。没有采用 AI 重绘人物。
- 原文件未附可核实的作者链接时，不新增作者归属声明。原画权利归原作者及相关权利人，软件许可不覆盖原画。
- `manifest.json` 记录原文件、源内容哈希和生成资源哈希。每张卡的 `card-config.json` 指向原图和同源提取的轮廓层。
- 卡牌场景与 Three.js 查看器改编自 RuiC-card-skill（HRuiCcc，MIT）。本站用固定 UV 展示完整原画，纸面与镭射反光由 GLSL 实现；没有分离人物与画内背景。
- 网站根据原图比例调整共用矩形卡体，四角轻微柔化。参考卡高 9.45 cm、角半径约 0.6 mm、纸芯厚约 0.6 mm，侧边为非金属暖白色。纸面带细微粗糙纹理，保留随角度变化的彩色镭射；不附加标题、编号、装饰边框或亮边，原图自带文字保持不变。
- 可编辑源模型和示例图层：`artifacts/flash-cards/bella-kira/card.blend`。`uv run python scripts/build-flash-card.py --render` 重建纸卡并导出共享模型。生成全画廊资源：`npm run cards:generate`；只读校验：`npm run cards:check`。
- Blender 节点材质在浏览器中以 GLSL 重建，两端不保证逐像素一致。
- 用途：非官方、非商业粉丝展示。

- 新增三种材质的分层尺寸、位移倍率及交互手感参考 Simon Goellner 的 [Pokémon Cards CSS](https://github.com/simeydotme/pokemon-cards-css)。本站独立实现 GLSL 与交互代码，没有引入参考站的卡图、纹理文件或复制其实现；参考项目本身使用 GPL-3.0。
- `subject-mask.png` 与 `background-mask.png` 使用 [rembg](https://github.com/danielgatis/rembg) 的 isnet-anime 模型从本站原图生成，只用于 Trainer Gallery 的效果区域保护。`mask-source.json` 记录模型名、原图和产物内容哈希；原图文件保持不变，遮罩不赋予任何原画使用权。
