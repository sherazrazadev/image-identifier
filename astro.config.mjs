import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://image.tommyfx.pk",
  vite: {
    plugins: [tailwindcss()],
    assetsInclude: ["**/*.wasm"],
    optimizeDeps: {
      exclude: ["@contentauth/c2pa-web", "@huggingface/transformers"],
    },
    worker: {
      format: "es",
    },
  },
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes("/404"),
    }),
  ],
});
