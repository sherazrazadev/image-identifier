/**
 * WASM strategy (T03-01):
 * Host the package WASM via Vite `?url` so the binary is emitted into `dist/`
 * and loaded same-origin (works on Cloudflare Pages). Prefer this over:
 * - inline WASM (huge JS bundle), or
 * - third-party CDN (version drift / privacy).
 *
 * Do not invent SDK APIs — only createC2pa + Reader.fromBlob per current docs.
 */

import { createC2pa, Reader } from "@contentauth/c2pa-web";
import wasmSrc from "@contentauth/c2pa-web/resources/c2pa.wasm?url";
import { failedResult, mapManifestStore, notFoundResult } from "./mapStore.js";

/** @type {Promise<import('@contentauth/c2pa-web').C2pa> | null} */
let c2paPromise = null;

/**
 * @returns {Promise<import('@contentauth/c2pa-web').C2pa>}
 */
export function getC2pa() {
  if (!c2paPromise) {
    c2paPromise = createC2pa({ wasmSrc });
  }
  return c2paPromise;
}

/**
 * Read provenance credentials from a browser File/Blob.
 * @param {Blob} blob
 * @param {string} mimeType
 * @returns {Promise<import('./mapStore.js').ProvenanceResult>}
 */
export async function readProvenance(blob, mimeType) {
  const started = performance.now();
  /** @type {import('@contentauth/c2pa-web').Reader | null} */
  let reader = null;

  try {
    const c2pa = await getC2pa();
    reader = await Reader.fromBlob(c2pa, mimeType || undefined, blob);

    if (!reader) {
      return notFoundResult(Math.round(performance.now() - started));
    }

    const store = await reader.manifestStore();
    return mapManifestStore(store, {
      durationMs: Math.round(performance.now() - started),
    });
  } catch {
    return failedResult(Math.round(performance.now() - started), "read_failed");
  } finally {
    if (reader) {
      try {
        await reader.free();
      } catch {
        // ignore dispose errors
      }
    }
  }
}
