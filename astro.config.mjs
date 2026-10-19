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
  // Live Pages URL until custom domain (image.tommyfx.pk) is attached.
  site: "https://image-identifier.pages.dev",
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
      filter: (page) => {
        if (page.includes("/404")) return false;
        // Keep internal methodology pages out of the public sitemap.
        if (page.includes("/guides/")) return false;
        if (page.includes("/methodology")) return false;
        if (page.includes("/limits")) return false;
        if (page.includes("/how-it-works")) return false;
        return true;
      },
    }),
  ],
});
