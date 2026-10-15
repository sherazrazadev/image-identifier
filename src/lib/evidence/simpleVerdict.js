import { reconcileEvidence } from "./reconcile.js";

/**
 * @typedef {'checking' | 'ai' | 'real' | 'unclear'} VerdictKind
 *
 * @typedef {object} SimpleVerdict
 * @property {VerdictKind} kind
 * @property {string} title
 * @property {string} detail
 */

const SIMPLE_DISCLAIMER =
  "This is a free estimate and can be wrong. It is not proof for legal, newsroom, or forensic use.";

/**
 * User-facing verdict only. Internal signals stay out of the copy.
 *
 * @param {{
 *   analyzing: boolean;
 *   provenanceResult: import('../c2pa/mapStore.js').ProvenanceResult | null;
 *   provenanceStatus: import('./reconcile.js').ModuleStatus;
 *   detailsResult: import('../metadata/extract.js').MetadataResult | null;
 *   detailsStatus: import('./reconcile.js').ModuleStatus;
 *   statisticalResult: import('../ml/interpret.js').StatisticalResult | null;
 *   statisticalStatus: import('./reconcile.js').ModuleStatus;
 * }} input
 * @returns {SimpleVerdict}
 */
export function getSimpleVerdict(input) {
  const {
    analyzing,
    provenanceResult,
    provenanceStatus,
    detailsResult,
    detailsStatus,
    statisticalResult,
    statisticalStatus,
  } = input;

  const stillWorking =
    analyzing ||
    statisticalStatus === "running" ||
    statisticalStatus === "idle" ||
    provenanceStatus === "running" ||
    detailsStatus === "running";

  if (stillWorking) {
    return {
      kind: "checking",
      title: "Checking your image…",
      detail: "Runs in your browser. Usually takes a few seconds.",
    };
  }

  const summary = reconcileEvidence({
    provenance: provenanceResult,
    provenanceStatus,
    metadata: detailsResult,
    metadataStatus: detailsStatus,
    statistical: {
      status: statisticalStatus,
      flagsPossibleAi: statisticalResult?.flagsPossibleAi,
      score: statisticalResult?.topScore ?? null,
    },
  });

  const aiFromCheck =
    statisticalStatus === "success" && statisticalResult?.flagsPossibleAi === true;
  const realFromCheck =
    statisticalStatus === "success" && statisticalResult?.flagsPossibleAi === false;
  const aiFromOther = summary.labels.some((l) =>
    /AI-generation|Statistical detector flags possible AI/i.test(l),
  );
  const realFromOther = summary.labels.some((l) => /Camera provenance/i.test(l));

  if (summary.hasConflict) {
    return {
      kind: "unclear",
      title: "Unclear",
      detail: "We could not confidently say AI-generated or real for this image.",
    };
  }

  if (aiFromCheck || aiFromOther) {
    return {
      kind: "ai",
      title: "Likely AI-generated",
      detail: "This image looks like it may have been created or heavily altered by AI.",
    };
  }

  if (realFromCheck || realFromOther) {
    return {
      kind: "real",
      title: "Likely real",
      detail: "This image looks more like a real photo than AI-generated.",
    };
  }

  if (statisticalStatus === "failed" || statisticalStatus === "skipped") {
    return {
      kind: "unclear",
      title: "Couldn’t finish the check",
      detail: "Try again, or use another JPEG or PNG.",
    };
  }

  return {
    kind: "unclear",
    title: "Unclear",
    detail: "Not enough signal to say AI-generated or real.",
  };
}

export function getSimpleDisclaimer() {
  return SIMPLE_DISCLAIMER;
}
