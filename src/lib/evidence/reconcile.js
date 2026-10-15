/**
 * Evidence reconciliation (SOP §9) — labels only, no invented certainty.
 * Pure functions; safe to unit test without the browser.
 */

/** @typedef {'idle' | 'running' | 'success' | 'not_found' | 'failed' | 'skipped'} ModuleStatus */

/**
 * @typedef {object} ModuleSummary
 * @property {string} id
 * @property {string} label
 * @property {ModuleStatus} status
 */

/**
 * @typedef {object} ReconcileInput
 * @property {import('../c2pa/mapStore.js').ProvenanceResult | null} [provenance]
 * @property {ModuleStatus} [provenanceStatus]
 * @property {import('../metadata/extract.js').MetadataResult | null} [metadata]
 * @property {ModuleStatus} [metadataStatus]
 * @property {{ status?: ModuleStatus; flagsPossibleAi?: boolean; score?: number | null } | null} [statistical]
 */

/**
 * @typedef {object} ReconcileOutput
 * @property {string} primaryLabel
 * @property {string[]} labels
 * @property {string[]} keyEvidence
 * @property {string[]} warnings
 * @property {boolean} hasConflict
 * @property {ModuleSummary[]} modules
 */

const DISCLAIMER =
  "AI-image detection is statistical and can produce false positives and false negatives. Metadata and provenance information may be missing, altered, or incomplete. Results should be treated as supporting evidence, not definitive proof of an image's origin or authenticity.";

/**
 * @param {ReconcileInput} input
 * @returns {ReconcileOutput}
 */
export function reconcileEvidence(input) {
  const provenance = input.provenance ?? null;
  const metadata = input.metadata ?? null;
  const provenanceStatus = input.provenanceStatus ?? deriveStatus(provenance);
  const metadataStatus = input.metadataStatus ?? deriveStatus(metadata);
  const statistical = input.statistical ?? { status: "skipped" };
  const statisticalStatus = statistical.status ?? "skipped";

  /** @type {string[]} */
  const labels = [];
  /** @type {string[]} */
  const keyEvidence = [];
  /** @type {string[]} */
  const warnings = [];

  const aiProvenance = hasAiProvenanceSignal(provenance);
  const cameraProvenance = hasCameraProvenanceSignal(provenance);
  const cameraMetadata = hasCameraMetadata(metadata);
  const aiMetadata = (metadata?.clueCount ?? 0) > 0;
  const statisticalAi =
    statisticalStatus === "success" && statistical.flagsPossibleAi === true;

  if (aiProvenance) {
    labels.push("AI-generation provenance recorded");
    keyEvidence.push("Recorded credentials describe AI-generation provenance.");
  } else if (cameraProvenance) {
    labels.push("Camera provenance recorded");
    keyEvidence.push("Recorded credentials describe camera-related provenance.");
  } else if (provenance?.manifest === "found") {
    keyEvidence.push("Content credentials were found in the file.");
  } else if (provenanceStatus === "not_found") {
    warnings.push("Missing credentials do not prove authenticity.");
  }

  if (aiMetadata) {
    labels.push("AI-generation metadata detected");
    keyEvidence.push("File details include possible generation-related clues (not proof).");
  }

  if (cameraMetadata) {
    keyEvidence.push("Camera-related details were found in the file.");
    warnings.push("Ordinary camera details do not prove the image is unedited or authentic.");
  }

  if (statisticalAi) {
    labels.push("Statistical detector flags possible AI generation");
    keyEvidence.push("Optional statistical check flagged possible AI generation.");
  }

  if (statisticalStatus === "skipped" || statisticalStatus === "idle") {
    labels.push("Statistical analysis unavailable");
  }

  if (provenance?.signature === "invalid") {
    warnings.push("An invalid signature is not proof that the image is AI-generated.");
  }
  if (provenance?.trust === "unconfirmed" || provenance?.trust === "unknown") {
    if (provenance?.manifest === "found") {
      warnings.push("An untrusted or unconfirmed signer is not proof of forgery.");
    }
  }
  if (provenanceStatus === "failed" || metadataStatus === "failed") {
    labels.push("Analysis incomplete");
    warnings.push("At least one check failed; other results may still be useful.");
  }

  const hasConflict = detectConflict({
    aiProvenance,
    cameraProvenance,
    cameraMetadata,
    aiMetadata,
    statisticalAi,
  });

  if (hasConflict) {
    if (!labels.includes("Conflicting evidence")) {
      labels.unshift("Conflicting evidence");
    }
    warnings.push("Conflicting signals were preserved — none were discarded.");
  }

  // Deduplicate while preserving order
  const uniqueLabels = [...new Set(labels)];

  const decisive = uniqueLabels.filter(
    (l) =>
      l !== "Statistical analysis unavailable" &&
      l !== "Analysis incomplete" &&
      l !== "Conflicting evidence",
  );

  let primaryLabel = "No decisive provenance evidence";
  if (uniqueLabels.includes("Conflicting evidence")) {
    primaryLabel = "Conflicting evidence";
  } else if (decisive.length > 0) {
    primaryLabel = decisive[0];
  } else if (uniqueLabels.includes("Analysis incomplete")) {
    primaryLabel = "Analysis incomplete";
  } else if (
    provenanceStatus === "not_found" &&
    (metadataStatus === "not_found" || (metadata?.fields?.length ?? 0) === 0)
  ) {
    primaryLabel = "No decisive provenance evidence";
  }

  if (primaryLabel === "No decisive provenance evidence" && !uniqueLabels.includes(primaryLabel)) {
    uniqueLabels.unshift(primaryLabel);
  }

  if (provenance?.warnings?.length) {
    for (const w of provenance.warnings) warnings.push(w);
  }
  if (metadata?.warnings?.length) {
    for (const w of metadata.warnings) warnings.push(w);
  }

  return {
    primaryLabel,
    labels: uniqueLabels,
    keyEvidence: [...new Set(keyEvidence)],
    warnings: [...new Set(warnings)],
    hasConflict,
    modules: [
      {
        id: "credentials",
        label: "Credentials",
        status: normalizeModuleStatus(provenanceStatus),
      },
      {
        id: "details",
        label: "Details",
        status: normalizeModuleStatus(metadataStatus),
      },
      {
        id: "statistical",
        label: "Statistical",
        status: normalizeModuleStatus(statisticalStatus),
      },
    ],
  };
}

export function getEvidenceDisclaimer() {
  return DISCLAIMER;
}

/**
 * @param {object} flags
 */
function detectConflict(flags) {
  const cameraSide = flags.cameraProvenance || flags.cameraMetadata;
  const aiSide = flags.aiProvenance || flags.aiMetadata || flags.statisticalAi;
  return Boolean(cameraSide && aiSide);
}

/**
 * @param {import('../c2pa/mapStore.js').ProvenanceResult | null} provenance
 */
function hasAiProvenanceSignal(provenance) {
  if (!provenance || provenance.manifest !== "found") return false;
  const blob = JSON.stringify({
    actions: provenance.actions,
    ingredients: provenance.ingredients,
    claimGenerator: provenance.claimGenerator,
  }).toLowerCase();
  return /trainedalgorithmic|algorithmicmedia|generativeai|ai[- ]?generated|synthetic/.test(blob);
}

/**
 * @param {import('../c2pa/mapStore.js').ProvenanceResult | null} provenance
 */
function hasCameraProvenanceSignal(provenance) {
  if (!provenance || provenance.manifest !== "found") return false;
  if (hasAiProvenanceSignal(provenance)) return false;
  const blob = JSON.stringify({
    actions: provenance.actions,
    ingredients: provenance.ingredients,
    claimGenerator: provenance.claimGenerator,
  }).toLowerCase();
  return /digitalcapture|computationalcapture|camera|nikon|canon|sony|fuji|leica|iphone|pixel/.test(
    blob,
  );
}

/**
 * @param {import('../metadata/extract.js').MetadataResult | null} metadata
 */
function hasCameraMetadata(metadata) {
  if (!metadata?.fields?.length) return false;
  return metadata.fields.some((f) => {
    if (f.isClue) return false;
    return (
      f.category === "camera" ||
      /^(Make|Model|LensModel|LensMake)$/i.test(f.key)
    );
  });
}

/**
 * @param {ModuleStatus} status
 * @returns {ModuleStatus}
 */
function normalizeModuleStatus(status) {
  if (status === "idle") return "skipped";
  return status;
}

/**
 * @param {{ status?: string } | null} result
 * @returns {ModuleStatus}
 */
function deriveStatus(result) {
  if (!result) return "skipped";
  if (result.status === "success") return "success";
  if (result.status === "not_found") return "not_found";
  if (result.status === "failed") return "failed";
  return "skipped";
}
