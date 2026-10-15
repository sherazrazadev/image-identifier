import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

/**
 * Cloudflare Pages rejects assets over 25 MiB. onnxruntime-web's asyncify
 * WASM is ~26 MiB; Vite would emit it via `new URL(..., import.meta.url)`.
 * Transformers.js loads that WASM from jsDelivr at runtime instead.
 */
function omitOrtWasmFromBundle() {
  return {
    name: "omit-ort-wasm-from-bundle",
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (/ort-wasm.*\.wasm$/i.test(fileName)) {
          delete bundle[fileName];
        }
      }
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: "https://image.tommyfx.pk",
  vite: {
    plugins: [tailwindcss(), omitOrtWasmFromBundle()],
    assetsInclude: ["**/*.wasm"],
    optimizeDeps: {
      exclude: ["@contentauth/c2pa-web", "@huggingface/transformers"],
    },
    worker: {
      format: "es",
      plugins: () => [omitOrtWasmFromBundle()],
    },
  },
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes("/404"),
    }),
  ],
});
