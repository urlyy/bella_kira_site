# AGENTS.md

## Project

This repository is the current implementation of an unofficial, non-commercial fan/support site for A-SOUL member 贝拉kira. The experience should remain affectionate, character-led, playful, and visually authored rather than reading like a corporate product or generic game portal.

The canonical user-facing name is `贝拉kira`. The current header wordmark renders the Latin portion as `Kira`, while page titles, metadata, labels, and prose use `贝拉kira`.

## Working Agreement

- Treat the implementation in `src/` and the content files in `src/content/` as the source of truth. Update this document only with durable architecture, behavior, content, and maintenance rules; do not use it as a research log or brainstorm backlog.
- Keep documentation scoped and synchronized: `README.md` is the user-facing setup, maintenance, and deployment guide; `AGENTS.md` records durable implementation and acceptance constraints; asset-local source records preserve attribution. Remove superseded guidance instead of retaining parallel or historical versions.
- Preserve the modular page structure. `src/pages/index.astro` is a thin home-page assembly surface; each chapter, the persistent header, and page navigation live in focused components.
- Do not display decorative full-page labels in the `数字 / ENGLISH NAME` format. Functional pagination, content indices, and section numbers are allowed.
- Reuse the Bella-themed toast treatment for actions that copy, generate, unlock, obtain, succeed, or fail. Do not rely only on silent completion or temporary button text.

## Verification and Acceptance

- A request to **verify**, **check**, **review**, or otherwise validate work requires both code verification and rendered visual verification whenever the result can affect the site. Neither track can substitute for the other, and a passing build alone is not a complete acceptance result.
- Code verification must cover the checks relevant to the change: formatting, optimized-asset consistency, Astro/TypeScript diagnostics, production build, and affected behavior or accessibility. Use `npm run format:check`, `npm run optimize:check`, `npm run check`, and/or `npm run build` in proportion to the change.
- Visual verification must use the rendered site, not source inspection alone. Inspect affected routes and states at desktop and mobile sizes in both dark and light themes, and include short-height and landscape viewports when layout or full-screen navigation can be affected. Review composition, contrast, hierarchy, spacing, clipping, proportions, responsive behavior, interactions, and readability over changing media.
- Exercise the relevant interaction path, not only the initial frame: chapter wipes and internal scrolling, menus and dialogs, loading/error/empty states, media controls, keyboard/touch behavior, and reduced-motion alternatives as applicable.
- If either verification track is blocked or genuinely not applicable, state that explicitly with the reason and list exactly what was and was not checked. Do not report the work as fully verified while leaving one applicable track unexamined.

## Stack and Repository Layout

- The site is a static Astro project. Astro owns routes and content assembly; React is used for stateful islands such as the D3 timeline; Three.js handles the PMX model stage; native DOM, Canvas, Web Audio, and GSAP support the remaining interactions.
- Source code lives in `src/`; deployable media and models live in `public/assets/`; browser experiences live at `src/pages/games/<slug>/`. Do not recreate retired `research/` or `prototypes/` directories.
- Content is maintained in:
    - `src/content/recommended-videos.json`
    - `src/content/stickers.json`
    - `src/content/fan-fiction.json`
    - `src/content/timeline-events.ts`
    - `src/content/interactive-experiences.ts`
- Astro, JSON, JavaScript, and TypeScript use Prettier with tabs and a tab width of four. Run `npm run format` and `npm run format:check` as appropriate.
- Every `*:optimize` command must have a corresponding read-only `*:check` command. Optimize scripts use source-content hashes and committed manifests for incremental generation and validation, not filesystem timestamps. Pages append manifest-derived output hashes to optimized asset URLs for automatic browser/CDN cache invalidation. `npm run optimize` generates all optimized assets, while `npm run optimize:check` validates them without modifying files.
- `npm run build` first runs the write-mode formatter, then `optimize:check`, Astro/TypeScript checks, and the static build. Use the individual `*:check` commands when verification must remain read-only. Husky runs `gallery:check` before commits and the complete build before pushes; GitHub Actions runs the same build on pushes and pull requests.

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
- The unified visual identity is `暮色星轨档案`: all home chapters except the full-screen video hero share a night-purple, warm-white, support-coral, and restrained starlight-gold system, with a coordinated light-theme counterpart. Character artwork and chapter media provide individuality, while backgrounds, headings, borders, cards, and controls remain recognizably part of the same visual world.
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

- The outfit archive is a closed horizontal ring. The active full-body cutout is dominant at center with two visible neighbors on each side, nonlinear depth falloff, a raised foot baseline, and a star-filled elliptical stage. Character cutouts do not render mirrored floor reflections.
- Dragging or previous/next controls rotate the ring without reusing the page wipe. The selected wallpaper crossfades independently. Portrait wallpapers use a complete clear artwork layer over a dim blurred cover-fill backing; landscape entries remain full bleed.
- Outfit names are not shown. Each entry needs only a character cutout plus its background and fit metadata. The ring maintains at least nine planes when the archive is small and lazy-loads distant character images through `data-src`.
- Outfit cutouts under `public/assets/clothes/` and wallpapers under `public/assets/cloth_bg/` are converted to versioned WebP assets by `npm run clothes:optimize` and `npm run cloth-bg:optimize`; commit source images, optimized files, and manifests together.

### 推荐视频、表情包、画廊与同人文

- Recommended collections and items render strictly in JSON array order. `publishedAt` is displayed verbatim. Covers are local files under `public/assets/recommended-videos/covers/`, remain clipped to 16:9, and titles clamp to two lines. An optional `coverWarning` produces the synchronized blurred-cover/title-spoiler treatment.
- Recommended-video covers are converted to versioned 640×360 WebP assets by `npm run recommended-covers:optimize`; commit the source images, optimized files, and manifest together.
- Sticker groups come from `stickers.json`. Official and managed fan-made groups are independent, initially collapsed accordions whose DOM is created on first open. Grouped images use `data-src` plus an observer rooted to the sticker scroll surface. Closing a large group uses a short opacity/clip transition followed by a single collapse rather than animated grid height.
- Loose fan-made images are discovered only from the root of `public/assets/stickers/fan-made/`, laid out with ratio-driven CSS Grid masonry, and paginated 20 at a time. Their accordion state and page are stored in session storage. Grouped fan works keep source attribution; official sticker commerce actions use the labels configured in JSON.
- The gallery scans original images from `public/assets/gallery/`, uses generated WebP previews and a calculated two-column CSS Grid masonry, and opens originals in a full-viewport lightbox. Run `npm run gallery:optimize` after adding or changing originals, and commit the originals, previews, and manifest together.
- The fan-fiction library reads `fan-fiction.json`, renders four physical books per shelf row on desktop and mobile, and scrolls vertically as rows grow. Each row has a complete wooden shelf board. The full-viewport reader provides chapter navigation, source/related-video links, a native mobile chapter select, and safe-area-aware controls.

### 枝江路标

- This chapter contains only `枝江虚拟偶像` and `站外资源`. Idol/resource links are authored directly in `BeyondOrbitPage.astro`.
- The idol set is 贝拉、嘉然、乃琳、心宜、思诺, shown as equal illuminated profile links rather than orbiting Bella. Resource links use flatter direction-sign cards. Do not duplicate the schedule link or site notice here.

### 互动空间

- The home chapter and `/games/` lobby render the same ordered entries from `interactive-experiences.ts`. There are currently 7 experiences: model stage, memory match, character assembly, stage puzzle, jigsaw puzzle, link match, and PetPet GIF maker.
- Character assembly keeps its legacy `/games/hair-stop/` route. Its source PSD files live under `public/assets/psd/`; browser-ready transparent parts and the assembly manifest live under `public/assets/character-assembly/`. User-facing source names are mapped from PSD filenames in `src/content/character-assembly-names.json`. Handwear, legwear, and footwear are split into independent left/right screen-side pieces during export. Face, nose, mouth, eye white, eyebrow, eyelash, and iris layers are combined into one recognizable `面部` piece per PSD; ears remain separate. The library exposes parts from every PSD together so players can mix sources freely, move, scale, rotate, delete, and reorder pieces while their transformed bounds stay inside the square assembly area. Library cards do not add pieces on click; players drag a card into the assembly area and the piece is placed at the drop position. Touch users drag from the card handle so normal page and library scrolling remain available. Players can multi-select with modifier-click, Ctrl/Cmd+A, or the touch-friendly multi-select mode; movement and toolbar transforms apply to the whole selection. A single selected piece can be deformed through a 3×3 mesh with nine draggable, keyboard-accessible control points. Ctrl/Cmd+Z and the visible undo control reverse canvas and mesh mutations. The current composition exports as a 1280×1280 transparent PNG with layer order, mesh deformation, rotation, and scale preserved. There is no target character, snap position, or completion judgment.
- Each experience is a first-class route under `/games/<slug>/` with its own asset bundle and a `← 互动空间` return control. Do not iframe the current DOM/Canvas experiences. Engine-exported games may later use a site-owned shell and iframe when isolation is required.
- The PMX model stage is a pose editor. Beginner mode exposes curated body parts, named poses, expressions, axis rotation, per-part reset, full reset, and help. Advanced mode exposes the complete source-order bone list, search, raw XYZ rotation, selected-bone skeleton highlighting, parent/child links, a projected label, and global/local axes.
- PMX pose updates must solve all rotation grants, including leg D chains, arm/wrist twists, accessories, eyes, and waist-cancel bones. Camera instructions are input-specific: mouse language on desktop; one-finger rotate, pinch zoom, and two-finger pan on touch devices.

## Notice and Rights

- The final home chapter uses the kicker `SITE NOTICE · ABOUT THIS SITE` and two numbered sections: `01 版权与使用说明` and `02 建议与反馈`; it does not include an update-log section. `/notice/` is only a legacy redirect to `/#notice`.
- The `贝拉姿势编辑器` card in `互动空间` uses the same tone-based abstract card background system as the other experiences; it does not use a photographic background image.
- The four rights/usage items form one two-by-two card grid. Feedback links to Bilibili UID `36733462`.
- Keep the notice explicit that this is an unofficial non-commercial project with no official affiliation. Official identities and media remain with their rights holders; credited fan works remain with their creators; PMX/MMD use follows bundled author rules and does not imply redistribution permission; fan fiction retains author attribution; rights holders may request correction, attribution, or removal.

## Gallery Flash Cards

- Clicking a gallery image opens a native dialog with an interactive Three.js flash card in the current page. Keep `/cards/<id>/` links for direct visits and modified-click navigation, and preserve each image's separate original-lightbox action. The shared `FlashCardViewer.astro` and disposable `mountFlashCard` renderer serve both surfaces. Gallery tiles remain static WebP previews; import the renderer and load the original only on opening. Closing or switching cards must cancel listeners and pending work, stop animation, release GPU resources, and preserve gallery scroll/focus. The legacy `/cards/bella-kira/` redirects to `/cards/gallery-005/`.
- Keep complete artwork, aspect ratio, and existing signatures. Only show the front face. Do not add card-face text, reverse-face controls, or decorative borders. The artwork is one complete image plane, not an extracted character; never describe it as independently moving foreground and background.
- The card keeps a rectangular paper silhouette with subtly softened 0.6 mm corners and a warm-white, nonmetallic 0.35 mm paper core (9.45 cm reference height). Avoid both needle-sharp digital corners and large rounded corners. The print uses fixed full-image UVs. Fine paper grain should be perceptible, especially in reflections, and fades below pixel resolution. Preserve colorful, angle-dependent holographic foil over the paper; do not replace it with neutral gloss. Neither the grain nor foil may displace the art, add a decorative rim, or animate independently of the card.
- Keep the flash-card header minimal with only the return-to-gallery link. Do not restore the auto-rotate, reset, artwork-info, or save toolbar; direct interaction and keyboard shortcuts remain available. Use perspective projection and make the front face follow the pointer consistently in all four quadrants.
- Keep flash cards comfortably inside the viewing area with visible margins. Default card height is capped at 620 CSS pixels and fits within 80% of the stage's width and height; the stage reserves room for close/return and bottom controls. Keep browsing and material controls compact at the viewer edge; do not add depth-adjustment controls for complete reference artwork.
- `scripts/generate-gallery-cards.mjs` creates per-image contours/configuration and a content-hash manifest in `public/assets/flash-cards/`. All cards reuse the borderless Blender geometry. Run `npm run cards:generate` after gallery changes; `npm run cards:check` is read-only and participates in the build.
- Editable geometry and sample layers live in `artifacts/flash-cards/bella-kira/`. `uv run python scripts/build-flash-card.py --render` rebuilds the paper geometry/materials and exports the shared GLB; run `npm run cards:generate` afterward to refresh hashes. Preserve attribution and RuiC's MIT license. Python generation commands use `uv`.
- Keep return/previous/next links, persisted theme, mouse following and drag, keyboard/touch controls, reduced-motion behavior, WebGL fallback, and Bella-themed feedback. Device orientation is opt-in with an explicit control; handle denied permissions and missing data. Manual drag disables orientation control. All user-facing sensor wording uses `陀螺仪`.
- The desktop chapter navigation supports horizontal mouse dragging when it overflows. Movement below 6 px remains a click; completed drags must not activate chapter links. Preserve touch scrolling and the mobile menu.
