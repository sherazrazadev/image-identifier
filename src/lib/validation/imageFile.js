import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  MAX_DIMENSION_PX,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
  MAX_PIXEL_COUNT,
} from "./limits.js";

/**
 * @typedef {'empty' | 'too_large' | 'unsupported_type' | 'decode_failed' | 'dimensions' | 'pixels'} ValidationErrorCode
 */

/**
 * @typedef {object} ValidationError
 * @property {ValidationErrorCode} code
 * @property {string} message
 */

/**
 * @typedef {object} ValidatedImage
 * @property {File} file
 * @property {string} objectUrl
 * @property {number} width
 * @property {number} height
 * @property {string} mimeType
 */

/**
 * @param {File | undefined | null} file
 * @returns {string | null}
 */
function sniffExtension(file) {
  if (!file?.name) return null;
  const i = file.name.lastIndexOf(".");
  if (i < 0) return null;
  return file.name.slice(i).toLowerCase();
}

/**
 * Read magic bytes for JPEG / PNG. Does not trust extension or MIME alone.
 * @param {File} file
 * @returns {Promise<'image/jpeg' | 'image/png' | null>}
 */
export async function detectImageMime(file) {
  const buf = await file.slice(0, 16).arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}

/**
 * @param {string} objectUrl
 * @returns {Promise<{ width: number; height: number }>}
 */
function decodeDimensions(objectUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error("decode_failed"));
    };
    img.src = objectUrl;
  });
}

/**
 * Validate a selected image file. Caller owns revoking any previous object URL.
 * On failure, any temporary object URL created here is revoked before return.
 *
 * @param {File | undefined | null} file
 * @returns {Promise<{ ok: true; data: ValidatedImage } | { ok: false; error: ValidationError }>}
 */
export async function validateImageFile(file) {
  if (!file || file.size === 0) {
    return {
      ok: false,
      error: {
        code: "empty",
        message: "The selected file is empty. Choose a JPEG or PNG image.",
      },
    };
  }

  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: {
        code: "too_large",
        message: `File is larger than ${MAX_FILE_MB} MB. Choose a smaller image.`,
      },
    };
  }

  const ext = sniffExtension(file);
  const claimedMime = (file.type || "").toLowerCase();
  const claimedOk =
    ACCEPTED_MIME_TYPES.includes(claimedMime) ||
    (ext !== null && ACCEPTED_EXTENSIONS.includes(ext));

  if (!claimedOk && claimedMime && !claimedMime.startsWith("image/")) {
    return {
      ok: false,
      error: {
        code: "unsupported_type",
        message: "Unsupported file type. Use JPEG or PNG (WebP support comes later).",
      },
    };
  }

  let sniffed;
  try {
    sniffed = await detectImageMime(file);
  } catch {
    return {
      ok: false,
      error: {
        code: "decode_failed",
        message: "Could not read the file. It may be corrupted.",
      },
    };
  }

  if (!sniffed) {
    return {
      ok: false,
      error: {
        code: "unsupported_type",
        message: "Unsupported or unrecognized image. Use JPEG or PNG.",
      },
    };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const { width, height } = await decodeDimensions(objectUrl);

    if (!width || !height) {
      URL.revokeObjectURL(objectUrl);
      return {
        ok: false,
        error: {
          code: "decode_failed",
          message: "Could not decode image dimensions.",
        },
      };
    }

    if (width > MAX_DIMENSION_PX || height > MAX_DIMENSION_PX) {
      URL.revokeObjectURL(objectUrl);
      return {
        ok: false,
        error: {
          code: "dimensions",
          message: `Image dimensions exceed ${MAX_DIMENSION_PX}px on a side.`,
        },
      };
    }

    const pixels = width * height;
    if (pixels > MAX_PIXEL_COUNT) {
      URL.revokeObjectURL(objectUrl);
      return {
        ok: false,
        error: {
          code: "pixels",
          message: "Image pixel count is too large to analyze safely in the browser.",
        },
      };
    }

    return {
      ok: true,
      data: {
        file,
        objectUrl,
        width,
        height,
        mimeType: sniffed,
      },
    };
  } catch {
    URL.revokeObjectURL(objectUrl);
    return {
      ok: false,
      error: {
        code: "decode_failed",
        message: "Could not decode this image. It may be corrupted or unsupported.",
      },
    };
  }
}

/**
 * @param {string | null | undefined} objectUrl
 */
export function revokeObjectUrl(objectUrl) {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * @returns {string}
 */
export function createJobId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
