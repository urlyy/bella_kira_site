# AGENTS.md

## Project

This repository is the current implementation of an unofficial, non-commercial fan/support site for A-SOUL member 贝拉kira. The experience should remain affectionate, character-led, playful, and visually authored rather than reading like a corporate product or generic game portal.

The canonical user-facing name is `贝拉kira`. The current header wordmark renders the Latin portion as `Kira`, while page titles, metadata, labels, and prose use `贝拉kira`.

## Working Agreement

- Treat the implementation in `src/` and the content files in `src/content/` as the source of truth. Update this document only with durable architecture, behavior, content, and maintenance rules; do not use it as a research log or brainstorm backlog.
- Preserve the modular page structure. `src/pages/index.astro` is a thin home-page assembly surface; each chapter, the persistent header, and page navigation live in focused components.
- After visual changes, inspect the rendered result at desktop and mobile sizes in both dark and light themes, including short and landscape viewports. Review composition, contrast, hierarchy, spacing, proportions, and readability over changing media—not only whether the project builds.
- Do not display decorative full-page labels in the `数字 / ENGLISH NAME` format. Functional pagination, content indices, and section numbers are allowed.
- Reuse the Bella-themed toast treatment for actions that copy, generate, unlock, obtain, succeed, or fail. Do not rely only on silent completion or temporary button text.

## Stack and Repository Layout

- The site is a static Astro project. Astro owns routes and content assembly; React is used for stateful islands such as the D3 timeline; Three.js handles the PMX model stage; native DOM, Canvas, Web Audio, and GSAP support the remaining interactions.
- Source code lives in `src/`; deployable media and models live in `public/assets/`; browser experiences live at `src/pages/games/<slug>/`. Do not recreate retired `research/` or `prototypes/` directories.
- Content is maintained in:
    - `src/content/recommended-videos.json`
    - `src/content/stickers.json`
    - `src/content/fan-fiction.json`
    - `src/content/timeline-events.ts`
    - `src/content/interactive-experiences.ts`
- JSON, JavaScript, and TypeScript use Prettier with tabs and a tab width of four. Run `npm run format` and `npm run format:check` as appropriate.
- Every `*:optimize` command must have a corresponding read-only `*:check` command. Optimize scripts use source-content hashes and committed manifests for incremental generation and validation, not filesystem timestamps. Pages append manifest-derived output hashes to optimized asset URLs for automatic browser/CDN cache invalidation. `npm run optimize` generates all optimized assets, while `npm run optimize:check` validates them without modifying files.
- `npm run build` runs `optimize:check`, Astro/TypeScript checks, and the static build. Husky runs `gallery:check` before commits and the complete build before pushes; GitHub Actions runs the same build on pushes and pull requests.

## Routes and Navigation

The fixed home sequence and hashes are:

1. `首页` — `#home`
2. `关于贝拉` — `#about`
3. `应援指南` — `#support`
4. `一路繁花` — `#timeline`
5. `服装展示` — `#outfits`
6. `推荐视频` — `#watch`
7. `表情包` — `#stickers`
8. `画廊` — `#gallery`
9. `同人文` — `#fiction`
10. `枝江路标` — `#corner`
11. `互动空间` — `#space`
12. `站点公告` — `#notice`

`站点公告` is the final home chapter and uses the same wheel/swipe wipe navigation as the other chapters. The legacy `/notice/` route redirects to `/#notice`. `/games/` is the standalone interactive-space lobby. From non-game routes, the persistent `互动空间` link returns to `/#space`; routes already under `/games/` may link to `/games/`. The legacy `/timeline` route redirects to `/#timeline`.

When chapter order changes, update all of these together: `src/pages/index.astro`, the hash list and numeric page state in `PageNavigator.astro`, desktop/mobile links in `SiteHeader.astro`, and cross-chapter controls such as the gallery’s `前往同人文` link.

## Home Navigation Behavior

- Home chapters occupy the same fixed viewport and transition with an 800 ms directional clipping wipe. Scrolling down reveals the next page from the right; scrolling up reveals the previous page from the left. Only the centered `public/assets/贝极星.png` marks the moving boundary; there is no visible connector line.
- Transition timing, clipping, page state, input lock, and the mascot marker must stay synchronized. Navigation unlocks as soon as the wipe ends.
- Scrollable chapters use their own scroll surface. While content can still scroll in the requested direction, wheel input remains within that surface; once it reaches the top or bottom boundary, the next directional wheel input moves directly to the adjacent chapter without a secondary edge gate.
- On touch devices, deliberate vertical swipes move non-scrollable chapters. Scrollable chapters move only when a gesture starts at the relevant content boundary. Links, buttons, form controls, dialogs, and the timeline panel must not trigger chapter navigation.
- At widths up to 760 px, the header shows the brand, current chapter, and a 44 px menu control. The full chapter list moves into a right-side panel, with standalone destinations separated. Mobile keeps full-screen chapter identity and uses `100dvh`, safe-area insets, and native scrolling where required.
- Every page owns a strict paint-clipping boundary. Apply blur, scale, and filters to inner visual layers so media cannot bleed into another chapter during a wipe.

## Global Presentation and Input

- The site uses the bundled LXGW WenKai Mono Lite font and Bella’s support color `#DB7D74` as a key accent.
- The unified visual identity is `暮色星轨档案`: all home chapters except the full-screen video hero use one deep night-purple, warm-white, support-coral, and restrained starlight-gold system. Character artwork and chapter media provide individuality, while backgrounds, headings, borders, cards, and controls remain recognizably part of the same dusk visual world.
- The desktop header floats over the current chapter without a large dark or frosted block. Its active state is a delicate stage/jewelry ornament close to the text, and the navigation is centered against the viewport rather than the remaining space beside the brand.
- Persistent header text uses warm white with a dark edge/shadow treatment strong enough to remain readable on both dusk chapters and bright moving hero frames; the active item shifts to a high-contrast warm coral tint. Do not return to low-contrast purple navigation text.
- Fine-pointer movement creates a non-interactive purple, white, warm-yellow, and coral star trail. It is disabled for coarse pointers and `prefers-reduced-motion`.
- Site images are not natively draggable. Add `draggable="false"`, retain the global `-webkit-user-drag: none` safeguard, and keep the global `dragstart` prevention in `SiteLayout.astro`.
- Preserve keyboard focus behavior, dialog escape/close behavior, reduced-motion alternatives, lazy loading, and asynchronous image decoding when extending existing components.

## Implemented Home Chapters

### 首页

- The hero is the full-viewport video `public/assets/请停止你的浏览！然后下载并且使用这一款风格多变的动态壁纸！！.mp4` with no foreground marketing copy or CTA.
- Lower-left controls toggle play/pause and playback speed. A deliberate user pause persists across navigation.
- Before pausing or leaving home, the current decoded frame is copied to a canvas overlay. The video stays paused through a return wipe and resumes only after home settles; the overlay is removed after a fresh frame is presented. Do not add `backdrop-filter` to these controls.

### 关于贝拉与应援指南

- The profile uses `public/assets/角色介绍bg.png` and shows the implemented facts, nicknames/spoilers, 贝极星 fan identity, Bilibili profile, live-room card, and external schedule link. Dates are plain text.
- The support color control displays `#DB7D74` and copies it with toast feedback. The slogan is exactly two lines: `A-SOUL时代，` and `沸腾期待！`. The lyric-support list links to the three current official tutorials.

### 一路繁花

- The timeline chapter's confirmed user-facing title is exactly `一路繁花`; do not call it `时光` in navigation, page headings, or accessibility labels.
- The timeline uses a dusk/night `暮色星轨档案` treatment rather than a pale generic analytics dashboard. Its follower curve reads as a luminous star track in a dark open canvas; axes and grids stay restrained, milestones read as lit stars, event details resemble observation records, and playback belongs to a thin timeline rail rather than a bright generic dashboard control.
- The animated point traveling along the follower curve uses a small `public/assets/贝极星.png` mascot image rather than a generic circular marker.

- `FollowerTimeline.tsx` is a React/D3 island backed by `/api/fans?name=贝拉kira` and editorial events from `timeline-events.ts`. Development proxies the same-origin endpoint to the configured worker; production must provide `/api/fans` at the hosting layer.
- The chart supports loading/error/retry states, nearest-sample pointer inspection, a seekable 12-second narrative playback, play/pause/replay, and editorial event callouts. The first visit auto-plays once; reduced-motion users see the completed chart.
- Before a page wipe leaves the timeline, finish the visualization synchronously and stop its playback so no chart animation runs under the transition.

### 服装展示

- The outfit archive is a closed horizontal ring. The active full-body cutout is dominant at center with two visible neighbors on each side, nonlinear depth falloff, raised foot baseline, attached reflection, and a star-filled elliptical stage.
- Dragging or previous/next controls rotate the ring without reusing the page wipe. The selected wallpaper crossfades independently. Portrait wallpapers use a complete clear artwork layer over a dim blurred cover-fill backing; landscape entries remain full bleed.
- Outfit names are not shown. Each entry needs only a character cutout plus its background and fit metadata. The current implementation repeats a small archive to maintain at least nine ring planes and lazy-loads distant character/reflection images through `data-src`.
- Outfit cutouts under `public/assets/clothes/` are converted to versioned WebP assets by `npm run clothes:optimize`; commit the source images, optimized files, and manifest together.

### 推荐视频、表情包、画廊与同人文

- Recommended collections and items render strictly in JSON array order. `publishedAt` is displayed verbatim. Covers are local files under `public/assets/recommended-videos/covers/`, remain clipped to 16:9, and titles clamp to two lines. An optional `coverWarning` produces the synchronized blurred-cover/title-spoiler treatment.
- Sticker groups come from `stickers.json`. Official and managed fan-made groups are independent, initially collapsed accordions whose DOM is created on first open. Grouped images use `data-src` plus an observer rooted to the sticker scroll surface. Closing a large group uses a short opacity/clip transition followed by a single collapse rather than animated grid height.
- Loose fan-made images are discovered only from the root of `public/assets/stickers/fan-made/`, laid out with ratio-driven CSS Grid masonry, and paginated 20 at a time. Their accordion state and page are stored in session storage. Grouped fan works keep source attribution; official sticker commerce actions use the labels configured in JSON.
- The gallery scans original images from `public/assets/gallery/`, uses generated WebP previews and a calculated two-column CSS Grid masonry, and opens originals in a full-viewport lightbox. Run `npm run gallery:optimize` after adding or changing originals, and commit the originals, previews, and manifest together.
- The fan-fiction library reads `fan-fiction.json`, renders four physical books per shelf row on desktop and mobile, and scrolls vertically as rows grow. Each row has a complete wooden shelf board. The full-viewport reader provides chapter navigation, source/related-video links, a native mobile chapter select, and safe-area-aware controls.

### 枝江路标

- This chapter contains only `枝江虚拟偶像` and `站外资源`. Idol/resource links are authored directly in `BeyondOrbitPage.astro`.
- The idol set is 贝拉、嘉然、乃琳、心宜、思诺, shown as equal illuminated profile links rather than orbiting Bella. Resource links use flatter direction-sign cards. Do not duplicate the schedule link or site notice here.

### 互动空间

- The home chapter and `/games/` lobby render the same ordered entries from `interactive-experiences.ts`. There are currently 11 experiences: model stage, memory match, star hit, hair stop, stage puzzle, jigsaw puzzle, merge, link match, bubble shooter, listen-stars, and PetPet GIF maker.
- Each experience is a first-class route under `/games/<slug>/` with its own asset bundle and a `← 互动空间` return control. Do not iframe the current DOM/Canvas experiences. Engine-exported games may later use a site-owned shell and iframe when isolation is required.
- The PMX model stage is a pose editor. Beginner mode exposes curated body parts, named poses, expressions, axis rotation, per-part reset, full reset, and help. Advanced mode exposes the complete source-order bone list, search, raw XYZ rotation, selected-bone skeleton highlighting, parent/child links, a projected label, and global/local axes.
- PMX pose updates must solve all rotation grants, including leg D chains, arm/wrist twists, accessories, eyes, and waist-cancel bones. Camera instructions are input-specific: mouse language on desktop; one-finger rotate, pinch zoom, and two-finger pan on touch devices.

## Standalone Notice and Rights

- `/notice/` uses the kicker `SITE NOTICE · ABOUT THIS SITE` and two numbered sections: `01 版权与使用说明` and `02 建议与反馈`; it does not include an update-log section.
- The `贝拉的舞台` card in `互动空间` uses the same tone-based abstract card background system as the other experiences; it does not use a photographic background image.
- Updates are maintained in one data block and shown in a collapsed panel with bounded internal scrolling. The four rights/usage items form one two-by-two card grid. Feedback links to Bilibili UID `36733462`.
- Keep the notice explicit that this is an unofficial non-commercial project with no official affiliation. Official identities and media remain with their rights holders; credited fan works remain with their creators; PMX/MMD use follows bundled author rules and does not imply redistribution permission; fan fiction retains author attribution; rights holders may request correction, attribution, or removal.
