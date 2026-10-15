import ExifReader from "exifreader";
import { CATEGORY_LABELS, CATEGORY_ORDER, categorizeKey } from "./categories.js";
import { classifyClue, isGpsField } from "./clues.js";

/** Tags ExifReader uses for bookkeeping — skip from user table. */
const SKIP_KEYS = new Set([
  "Thumbnail",
  "thumbnail",
  "Images",
  "FileType",
  "FileTypeExtension",
  "MIMEType",
]);

/**
 * @typedef {'success' | 'not_found' | 'unsupported' | 'failed'} ModuleStatus
 */

/**
 * @typedef {object} MetadataField
 * @property {string} key
 * @property {string} label
 * @property {string} value
 * @property {string} category
 * @property {boolean} isClue
 * @property {string | null} clueNote
 * @property {boolean} isGps
 * @property {boolean} technical
 */

/**
 * @typedef {object} MetadataResult
 * @property {ModuleStatus} status
 * @property {MetadataField[]} fields
 * @property {{ id: string; label: string; fields: MetadataField[] }[]} groups
 * @property {number} clueCount
 * @property {boolean} hasGps
 * @property {string[]} warnings
 * @property {string | null} errorCode
 * @property {number} durationMs
 */

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function formatTagValue(raw) {
  if (raw == null) return "";
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return String(raw);
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) => formatTagValue(item))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof raw === "object") {
    if ("description" in raw && raw.description != null) {
      return String(/** @type {{ description: unknown }} */ (raw).description);
    }
    if ("value" in raw) {
      return formatTagValue(/** @type {{ value: unknown }} */ (raw).value);
    }
    try {
      return JSON.stringify(raw);
    } catch {
      return String(raw);
    }
  }
  return String(raw);
}

/**
 * Map ExifReader tags object into categorized fields (pure; unit-testable).
 * @param {Record<string, unknown> | null | undefined} tags
 * @returns {MetadataField[]}
 */
export function mapTagsToFields(tags) {
  if (!tags || typeof tags !== "object") return [];

  /** @type {MetadataField[]} */
  const fields = [];

  for (const [key, tag] of Object.entries(tags)) {
    if (SKIP_KEYS.has(key)) continue;
    if (tag == null) continue;

    const value = formatTagValue(tag);
    if (!value || value === "[object Object]") continue;

    const { isClue, reason } = classifyClue(key, value);
    const gps = isGpsField(key);
    const resolvedCategory = gps ? "location" : categorizeKey(key, isClue);

    fields.push({
      key,
      label: humanizeKey(key),
      value,
      category: resolvedCategory,
      isClue,
      clueNote: reason,
      isGps: gps,
      technical: isTechnicalKey(key),
    });
  }

  return fields;
}

/**
 * @param {MetadataField[]} fields
 */
export function groupFields(fields) {
  /** @type {Map<string, MetadataField[]>} */
  const map = new Map();
  for (const id of CATEGORY_ORDER) map.set(id, []);

  for (const field of fields) {
    const id = CATEGORY_ORDER.includes(field.category) ? field.category : "other";
    map.get(id)?.push(field);
  }

  return CATEGORY_ORDER.filter((id) => (map.get(id) || []).length > 0).map((id) => ({
    id,
    label: CATEGORY_LABELS[id] || id,
    fields: map.get(id) || [],
  }));
}

/**
 * Extract metadata from an ArrayBuffer (browser or Node with file bytes).
 * @param {ArrayBuffer} buffer
 * @returns {Promise<MetadataResult>}
 */
export async function extractMetadata(buffer) {
  const started = performance.now();
  /** @type {string[]} */
  const warnings = [];

  if (!buffer || buffer.byteLength === 0) {
    return emptyResult("not_found", started, warnings, "empty_buffer");
  }

  try {
    const tags = ExifReader.load(buffer, { expanded: false });
    const fields = mapTagsToFields(tags);

    if (fields.length === 0) {
      return {
        status: "not_found",
        fields: [],
        groups: [],
        clueCount: 0,
        hasGps: false,
        warnings,
        errorCode: null,
        durationMs: Math.round(performance.now() - started),
      };
    }

    const clueCount = fields.filter((f) => f.isClue).length;
    const hasGps = fields.some((f) => f.isGps);

    return {
      status: "success",
      fields,
      groups: groupFields(fields),
      clueCount,
      hasGps,
      warnings,
      errorCode: null,
      durationMs: Math.round(performance.now() - started),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push("Metadata parsing failed for this file.");
    void message;
    return {
      status: "failed",
      fields: [],
      groups: [],
      clueCount: 0,
      hasGps: false,
      warnings,
      errorCode: "parse_failed",
      durationMs: Math.round(performance.now() - started),
    };
  }
}

/**
 * @param {ModuleStatus} status
 * @param {number} started
 * @param {string[]} warnings
 * @param {string | null} errorCode
 * @returns {MetadataResult}
 */
function emptyResult(status, started, warnings, errorCode) {
  return {
    status,
    fields: [],
    groups: [],
    clueCount: 0,
    hasGps: false,
    warnings,
    errorCode,
    durationMs: Math.round(performance.now() - started),
  };
}

/**
 * @param {string} key
 */
function humanizeKey(key) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\bJpg\b/g, "JPEG");
}

/**
 * @param {string} key
 */
function isTechnicalKey(key) {
  return /Offset|Pointer|Version|Length|Count|Bits|Compression|Interoperability/i.test(key);
}
