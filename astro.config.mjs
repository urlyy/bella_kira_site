import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
	integrations: [react()],
	output: "static",
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
