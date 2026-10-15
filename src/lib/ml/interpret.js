import { ML_LABEL_FAKE, ML_LABEL_REAL, ML_MODEL_DISPLAY_NAME, ML_MODEL_ID } from "./config.js";

/**
 * @typedef {object} ClassificationRow
 * @property {string} label
 * @property {number} score
 */

/**
 * @typedef {object} StatisticalResult
 * @property {'success' | 'failed' | 'cancelled' | 'unsupported'} status
 * @property {boolean} flagsPossibleAi
 * @property {string | null} topLabel
 * @property {number | null} topScore
 * @property {ClassificationRow[]} scores
 * @property {string} modelId
 * @property {string} modelDisplayName
 * @property {string} runtime
 * @property {string[]} limitations
 * @property {string[]} warnings
 * @property {string | null} errorCode
 * @property {number} durationMs
 */

/**
 * Map Transformers.js image-classification output → app statistical result.
 * Does not invent certainty copy — scores are model outputs only.
 *
 * @param {unknown} raw
 * @param {{ runtime?: string; durationMs?: number; warnings?: string[] }} [opts]
 * @returns {StatisticalResult}
 */
export function interpretClassification(raw, opts = {}) {
  const rows = normalizeRows(raw);
  const top = rows[0] || null;
  const topLabel = top ? String(top.label).toUpperCase() : null;
  const topScore = top && Number.isFinite(top.score) ? top.score : null;

  const fakeRow = rows.find((r) => String(r.label).toUpperCase() === ML_LABEL_FAKE);
  const fakeScore = fakeRow && Number.isFinite(fakeRow.score) ? fakeRow.score : null;

  const flagsPossibleAi =
    (topLabel === ML_LABEL_FAKE && (topScore ?? 0) >= 0.5) ||
    (fakeScore != null && fakeScore >= 0.5 && topLabel === ML_LABEL_FAKE);

  return {
    status: "success",
    flagsPossibleAi: Boolean(flagsPossibleAi),
    topLabel,
    topScore,
    scores: rows,
    modelId: ML_MODEL_ID,
    modelDisplayName: ML_MODEL_DISPLAY_NAME,
    runtime: opts.runtime || "unknown",
    limitations: defaultLimitations(),
    warnings: opts.warnings || [],
    errorCode: null,
    durationMs: opts.durationMs ?? 0,
  };
}

/**
 * @param {string} errorCode
 * @param {string[]} [warnings]
 * @param {number} [durationMs]
 * @returns {StatisticalResult}
 */
export function failedStatistical(errorCode, warnings = [], durationMs = 0) {
  return {
    status: errorCode === "cancelled" ? "cancelled" : "failed",
    flagsPossibleAi: false,
    topLabel: null,
    topScore: null,
    scores: [],
    modelId: ML_MODEL_ID,
    modelDisplayName: ML_MODEL_DISPLAY_NAME,
    runtime: "none",
    limitations: defaultLimitations(),
    warnings,
    errorCode,
    durationMs,
  };
}

/**
 * @param {unknown} raw
 * @returns {ClassificationRow[]}
 */
function normalizeRows(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  /** @type {ClassificationRow[]} */
  const rows = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const label = /** @type {Record<string, unknown>} */ (item).label;
    const score = /** @type {Record<string, unknown>} */ (item).score;
    if (typeof label !== "string") continue;
    const n = typeof score === "number" ? score : Number(score);
    if (!Number.isFinite(n)) continue;
    rows.push({ label, score: n });
  }
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

function defaultLimitations() {
  return [
    "Statistical only — false positives and false negatives happen.",
    "Trained largely on older generators; newer tools may be misclassified.",
    "Heavy compression and very small images reduce reliability.",
    "Not proof of authenticity or AI generation by itself.",
  ];
}

export { ML_LABEL_FAKE, ML_LABEL_REAL };
