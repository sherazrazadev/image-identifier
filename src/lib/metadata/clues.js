/**
 * Field / value patterns treated as generation *clues* (not proof).
 * Matching is case-insensitive on keys and selected values.
 */

const CLUE_KEY_PATTERNS = [
  /^prompt$/i,
  /^negative.?prompt$/i,
  /^parameters$/i,
  /^sampler$/i,
  /^steps$/i,
  /^cfg.?scale$/i,
  /^seed$/i,
  /^model$/i,
  /^checkpoint/i,
  /^sd.?model/i,
  /^schedule.?type$/i,
  /^denoising.?strength$/i,
  /^hires/i,
  /^controlnet/i,
  /^lora/i,
  /^aesthetic.?score$/i,
  /^clip.?skip$/i,
  /^software$/i,
];

const CLUE_VALUE_PATTERNS = [
  /stable.?diffusion/i,
  /\bcomfyui\b/i,
  /\bautomatic1111\b/i,
  /\ba1111\b/i,
  /\bmidjourney\b/i,
  /\bdall.?e\b/i,
  /\bniji\b/i,
  /\binvokeai\b/i,
  /\bnovelai\b/i,
  /\bfooocus\b/i,
  /\bforge\b/i,
  /ai generated/i,
];

const SOFTWARE_CLUE_VALUES = [
  /stable.?diffusion/i,
  /comfyui/i,
  /automatic1111/i,
  /midjourney/i,
  /dall.?e/i,
  /invokeai/i,
  /novelai/i,
  /fooocus/i,
];

/**
 * @param {string} key
 * @param {string} value
 * @returns {{ isClue: boolean; reason: string | null }}
 */
export function classifyClue(key, value) {
  const k = String(key || "");
  const v = String(value || "");

  for (const re of CLUE_KEY_PATTERNS) {
    if (re.test(k)) {
      // Generic "Software" alone is only a clue when value matches generators
      if (/^software$/i.test(k)) {
        if (SOFTWARE_CLUE_VALUES.some((r) => r.test(v))) {
          return { isClue: true, reason: "Generation-related software name (clue, not proof)" };
        }
        return { isClue: false, reason: null };
      }
      return { isClue: true, reason: "Generation-related field (clue, not proof)" };
    }
  }

  for (const re of CLUE_VALUE_PATTERNS) {
    if (re.test(v)) {
      return { isClue: true, reason: "Value resembles known generation tooling (clue, not proof)" };
    }
  }

  return { isClue: false, reason: null };
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isGpsField(key) {
  return /^(GPS|gps)/.test(key) || /latitude|longitude|altitude/i.test(key);
}
