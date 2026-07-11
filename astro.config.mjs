import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  output: "static",
  vite: {
    server: {
      proxy: {
        "/api/fans": {
          target: "http://bella-kira.site:8787",
          changeOrigin: true,
        },
      },
    },
    build: {
      assetsInlineLimit: 0,
    },
  },
});
