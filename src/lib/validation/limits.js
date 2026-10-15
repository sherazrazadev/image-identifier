/** Configurable validation limits (SOP §5.3). */

export const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_FILE_MB = 15;

/** JPEG / PNG only for v1; WebP deferred until C2PA + metadata paths verified. */
export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png"];
export const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png"];

export const ACCEPT_DROPZONE = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

/** Soft caps to avoid excessive memory use when decoding. */
export const MAX_DIMENSION_PX = 16384;
export const MAX_PIXEL_COUNT = 50_000_000; // ~50 MP

export const FORMAT_LABEL = "JPEG, PNG";
