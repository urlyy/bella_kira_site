# 贝拉kira

一个为 A-SOUL 成员贝拉kira 打造的非官方、非商业粉丝应援站。

网站希望让第一次认识贝拉的人快速感受到她的魅力，也为贝极星留下一处可以反复回来看看舞台、一路繁花、表情包、同人作品与互动内容的地方。

> 本项目与 A-SOUL、贝拉及其官方运营方不存在隶属或合作关系。角色形象、官方图片、音视频、模型与其他相关素材的权利归各自权利方所有，详见站内「站点公告」。

## 站点内容

首页采用全屏章节式浏览，并以贝极星作为页面切换标记。目前包含：

- 首页视频、贝拉介绍、应援指南、「一路繁花」粉丝轨迹与服装展示
- 推荐视频、表情包、光影画廊与同人文书架
- 枝江相关主页和站外资源导航
- 包含模型舞台、角色拼装、拼图与轻量小游戏的互动空间
- 作为首页最后一章的站点公告、素材使用说明与反馈入口

互动空间当前提供 7 个浏览器端体验：

| 路由                       | 内容                       |
| -------------------------- | -------------------------- |
| `/games/model-stage/`      | PMX 模型舞台与姿势编辑     |
| `/games/memory-match/`     | 记忆翻牌                   |
| `/games/hair-stop/`        | 枝江角色组件拼装           |
| `/games/stage-puzzle/`     | 滑块拼图                   |
| `/games/jigsaw-puzzle/`    | 不规则自由拼图             |
| `/games/link-match/`       | 连连看                     |
| `/games/pet-pet/`          | 浏览器本地 PetPet GIF 制作 |

## 技术栈

- [Astro](https://astro.build/)：静态页面、路由与内容组织
- [React](https://react.dev/)：需要状态管理的交互岛
- [TypeScript](https://www.typescriptlang.org/)
- [Three.js](https://threejs.org/)：PMX / 3D 模型舞台
- [GSAP](https://gsap.com/)：章节切换与叙事动效
- [D3](https://d3js.org/)：粉丝数据时间线
- Web Audio API、Canvas 与原生 DOM：各类浏览器端互动

项目输出为纯静态站点，构建产物位于 `dist/`。

## 本地开发

### 环境要求

- Node.js `>= 22.12.0`
- npm `>= 9.6.5`

仓库包含较多图片、GIF、视频与模型资源，完整检出和首次安装需要预留足够的磁盘空间。

### 启动

```bash
npm ci
npm run dev
```

开发服务器默认运行在 `http://localhost:4321`。

### 常用命令

| 命令                     | 用途                                         |
| ------------------------ | -------------------------------------------- |
| `npm run dev`            | 启动 Astro 开发服务器                        |
| `npm run check`          | 执行 Astro / TypeScript 检查                 |
| `npm run format`         | 写入 Prettier 格式化结果                     |
| `npm run format:check`   | 只读检查 Prettier 格式                       |
| `npm run optimize`       | 统一生成或更新全部优化资源                   |
| `npm run optimize:check` | 只读检查全部优化资源是否缺失或过期           |
| `npm run build`          | 先写入格式化，再检查资源与代码并生成静态站点 |
| `npm run preview`        | 本地预览 `dist/` 构建结果                    |

预览构建产物时，推荐运行 `npm run preview`。如果使用 VS Code Live
Server，本仓库已将其站点根目录配置为 `dist/`；请先运行 `npm run build`，
再启动 Live Server，并访问 `/`，不要以仓库根目录访问 `/dist/index.html`。
构建页面中的 `/_astro/` 和 `/assets/` 都是相对于站点根目录的绝对路径。

提交前至少运行：

```bash
npm run build
```

`npm run build` 会调用 `npm run format` 并可能修改源文件。如果只需要不写入文件的检查，请组合使用 `npm run format:check`、`npm run optimize:check` 和 `npm run check`。

## 验证与验收

对会影响站点输出的改动，「verify / check / review」必须同时包含代码检查和实际渲染的视觉检查，不能只完成其中一边。

- 代码侧：根据改动范围检查格式、优化资源、Astro / TypeScript 诊断、生产构建、相关功能与可访问性。
- 视觉侧：在渲染后的页面中检查受影响的路由和交互状态；桌面端、移动端、深色、浅色都要覆盖，布局相关改动还需检查矮视口和横屏。
- 自动化命令通过不代表视觉验收完成，页面看起来正常也不代表代码已经通过检查。某一侧无法执行或确实不适用时，必须明确说明原因和未验证范围。

## 项目结构

```text
.
├── public/assets/              # 可直接部署的图片、字体、视频、模型等资源
├── scripts/                    # 资源处理脚本
├── src/components/home/        # 首页各章节与页面导航
├── src/components/timeline/    # React + D3 粉丝时间线
├── src/content/                # 推荐视频、表情包、同人文及互动入口数据
├── src/features/               # 可复用的客户端功能
├── src/layouts/                # 全站页面布局
├── src/pages/                  # Astro 路由
│   ├── games/                  # 互动空间及各独立游戏
│   └── notice/                 # 旧公告路由跳转到 /#notice
└── src/styles/                 # 全局样式
```

`src/pages/index.astro` 只负责组装首页章节；具体视觉与交互应继续放在对应组件中。互动内容统一维护在 `src/pages/games/<slug>/`，静态资源统一放在 `public/assets/`。

## 内容维护

### 推荐视频

编辑 `src/content/recommended-videos.json`。合集与视频会严格按照 JSON 数组顺序展示；封面应保存到：

```text
public/assets/recommended-videos/covers/
```

不要直接引用 Bilibili CDN 封面，以免因防盗链导致加载失败。

### 表情包

配置位于 `src/content/stickers.json`：

- 官方资源：`public/assets/stickers/official/`
- 粉丝创作：`public/assets/stickers/fan-made/`

受管理的粉丝创作合集应在 JSON 中保留作者、原始页面或授权信息。直接放在 `fan-made/` 根目录的散图会被构建时自动发现，不需要登记进 JSON；散图浏览器每页显示 20 张。公开资源目录名应尽量使用 URL 安全的 ASCII 名称。

### 画廊

将原图加入 `public/assets/gallery/` 后运行：

```bash
npm run gallery:optimize
```

脚本会在 `public/assets/gallery/previews/` 中生成最长边不超过 1200px 的 WebP 预览图，并维护 `manifest.json`。原图、预览图和清单需要一起提交。

### 优化图片资源

这些源素材都有对应的 WebP 优化产物与清单：

| 素材         | 生成命令                              | 只读检查                           |
| ------------ | ------------------------------------- | ---------------------------------- |
| 画廊预览     | `npm run gallery:optimize`            | `npm run gallery:check`            |
| 服装立绘     | `npm run clothes:optimize`            | `npm run clothes:check`            |
| 服装背景     | `npm run cloth-bg:optimize`           | `npm run cloth-bg:check`           |
| 推荐视频封面 | `npm run recommended-covers:optimize` | `npm run recommended-covers:check` |
| 表情包       | `npm run stickers:optimize`           | `npm run stickers:check`           |

新增、替换或删除源素材后，运行对应的生成命令，并将源文件、优化产物和清单一起提交。

### 同人文与互动入口

- 同人文：`src/content/fan-fiction.json`
- 互动入口：`src/content/interactive-experiences.ts`

转载或展示同人作品前，请确认来源和授权边界，并保留原作者署名与原文链接。

## 数据接口与部署

静态页面可以部署到任意支持 Astro 静态产物的平台。部署时应将 `dist/` 作为站点根目录，并确保服务器能正确提供中文文件名和较大的媒体文件。

粉丝时间线会请求同源接口：

```text
GET /api/fans?name=贝拉kira
```

开发环境已在 `astro.config.mjs` 中配置代理。生产环境需要由反向代理、边缘函数或其他后端服务提供同一路径；仅上传静态文件时，时间线接口不可用，但站点其余静态内容仍可访问。

## 素材与版权

本仓库没有为全部内容授予统一的开源或再分发许可。

- 角色形象、官方图片、标识、影音等权利归原权利方所有。
- 同人图片与文字作品的权利归各自创作者所有。
- MMD / PMX 模型须遵守模型目录内随附的使用规则，不得从本站提取或再分发。
- PetPet 手部帧来自 ISC 许可的 `pet-pet-gif@1.0.9`，页面仅在浏览器本地处理用户图片。

如需补充署名、修正来源或移除内容，请通过站内「站点公告」所列方式联系维护者。
