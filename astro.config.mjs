import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { rm } from "node:fs/promises";

const unpublishedAssets = [
	"assets/请停止你的浏览！然后下载并且使用这一款风格多变的动态壁纸！！.mp4",
	"assets/optimized/video/hero-1080p.mp4",
	"assets/optimized/video/hero-720p.mp4",
	"assets/fonts/LXGWWenKaiMonoLite-Light.ttf",
	"assets/fonts/LXGWWenKaiMonoLite-Regular.ttf",
	"assets/fonts/LXGWWenKaiMonoLite-Medium.ttf",
	"assets/psd",
	"assets/贝拉头像.png",
	"assets/角色介绍bg.png",
	"assets/cloth_bg",
	"assets/recommended-videos/covers",
];

const excludeSourceAssets = {
	name: "exclude-source-assets",
	hooks: {
		"astro:build:done": async ({ dir }) => {
			await Promise.all(
				unpublishedAssets.map((asset) =>
					rm(new URL(asset, dir), { force: true, recursive: true }),
				),
			);
		},
	},
};

export default defineConfig({
	integrations: [react(), excludeSourceAssets],
	output: "static",
	devToolbar: {
		enabled: false,
	},
	vite: {
		server: {
			proxy: {
				"/api/fans": {
					target: "https://bella-kira.site",
					changeOrigin: true,
				},
			},
		},
		build: {
			assetsInlineLimit: 0,
		},
	},
});
