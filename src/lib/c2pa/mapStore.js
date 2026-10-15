/**
 * Pure mapping from SDK ManifestStore-shaped objects → app result model.
 * Only uses fields the SDK documents (validation_state, signature_info, etc.).
 */

/**
 * @typedef {'not_found' | 'found' | 'failed' | 'unsupported'} ManifestPresence
 * @typedef {'valid' | 'invalid' | 'unknown' | 'not_applicable'} SignatureStatus
 * @typedef {'trusted' | 'unconfirmed' | 'unknown' | 'not_applicable'} TrustStatus
 */

/**
 * @typedef {object} ProvenanceAction
 * @property {string} action
 * @property {string | null} softwareAgent
 * @property {string | null} when
 */

/**
 * @typedef {object} ProvenanceIngredient
 * @property {string | null} title
 * @property {string | null} format
 * @property {string | null} relationship
 */

/**
 * @typedef {object} ProvenanceResult
 * @property {'success' | 'not_found' | 'failed' | 'unsupported'} status
 * @property {ManifestPresence} manifest
 * @property {SignatureStatus} signature
 * @property {TrustStatus} trust
 * @property {string | null} validationState
 * @property {string | null} claimGenerator
 * @property {string | null} title
 * @property {string | null} signerIssuer
 * @property {string | null} signerCommonName
 * @property {string | null} signedAt
 * @property {ProvenanceAction[]} actions
 * @property {ProvenanceIngredient[]} ingredients
 * @property {{ code: string; explanation: string | null; level: string }[]} validationMessages
 * @property {string[]} warnings
 * @property {string | null} errorCode
 * @property {number} durationMs
 */

/**
 * @param {unknown} store
 * @param {{ durationMs?: number; warnings?: string[] }} [opts]
 * @returns {ProvenanceResult}
 */
export function mapManifestStore(store, opts = {}) {
  const durationMs = opts.durationMs ?? 0;
  /** @type {string[]} */
  const warnings = [...(opts.warnings || [])];

  if (!store || typeof store !== "object") {
    return baseResult({
      status: "not_found",
      manifest: "not_found",
      signature: "not_applicable",
      trust: "not_applicable",
      durationMs,
      warnings,
    });
  }

  const s = /** @type {Record<string, unknown>} */ (store);
  const manifests = /** @type {Record<string, unknown> | null} */ (s.manifests || null);
  const activeLabel =
    typeof s.active_manifest === "string"
      ? s.active_manifest
      : typeof s.activeManifest === "string"
        ? s.activeManifest
        : null;

  const manifestCount = manifests ? Object.keys(manifests).length : 0;
  if (manifestCount === 0 && !activeLabel) {
    return baseResult({
      status: "not_found",
      manifest: "not_found",
      signature: "not_applicable",
      trust: "not_applicable",
      durationMs,
      warnings,
    });
  }

  const active =
    (activeLabel && manifests && /** @type {Record<string, unknown>} */ (manifests[activeLabel])) ||
    (manifests && Object.values(manifests)[0]) ||
    null;

  const validationState =
    typeof s.validation_state === "string"
      ? s.validation_state
      : typeof s.validationState === "string"
        ? s.validationState
        : null;

  const { signature, trust } = mapValidationState(validationState);
  const validationMessages = collectValidationMessages(s);
  const mappedActive = mapActiveManifest(active);

  if (validationState === "Invalid") {
    warnings.push("Signature checks reported a problem with the recorded credentials.");
  } else if (validationState === "Valid") {
    warnings.push("Credentials passed signature checks; trust in the signer was not confirmed.");
  }

  return {
    status: "success",
    manifest: "found",
    signature,
    trust,
    validationState,
    ...mappedActive,
    validationMessages,
    warnings,
    errorCode: null,
    durationMs,
  };
}

/**
 * @param {string | null} validationState
 * @returns {{ signature: SignatureStatus; trust: TrustStatus }}
 */
export function mapValidationState(validationState) {
  if (validationState === "Trusted") {
    return { signature: "valid", trust: "trusted" };
  }
  if (validationState === "Valid") {
    return { signature: "valid", trust: "unconfirmed" };
  }
  if (validationState === "Invalid") {
    return { signature: "invalid", trust: "unknown" };
  }
  return { signature: "unknown", trust: "unknown" };
}

/**
 * @returns {ProvenanceResult}
 */
export function notFoundResult(durationMs = 0) {
  return baseResult({
    status: "not_found",
    manifest: "not_found",
    signature: "not_applicable",
    trust: "not_applicable",
    durationMs,
    warnings: [],
  });
}

/**
 * @returns {ProvenanceResult}
 */
export function failedResult(durationMs = 0, errorCode = "read_failed") {
  return {
    ...baseResult({
      status: "failed",
      manifest: "failed",
      signature: "unknown",
      trust: "unknown",
      durationMs,
      warnings: ["Could not finish reading credentials for this file."],
    }),
    errorCode,
  };
}

/**
 * @param {unknown} active
 */
function mapActiveManifest(active) {
  if (!active || typeof active !== "object") {
    return {
      claimGenerator: null,
      title: null,
      signerIssuer: null,
      signerCommonName: null,
      signedAt: null,
      actions: [],
      ingredients: [],
    };
  }

  const m = /** @type {Record<string, unknown>} */ (active);
  const claimGenerator = resolveClaimGenerator(m);
  const title = typeof m.title === "string" ? m.title : null;
  const sig = /** @type {Record<string, unknown> | null} */ (m.signature_info || m.signatureInfo || null);

  return {
    claimGenerator,
    title,
    signerIssuer: typeof sig?.issuer === "string" ? sig.issuer : null,
    signerCommonName: typeof sig?.common_name === "string" ? sig.common_name : null,
    signedAt: typeof sig?.time === "string" ? sig.time : null,
    actions: extractActions(m),
    ingredients: extractIngredients(m),
  };
}

/**
 * @param {Record<string, unknown>} m
 */
function resolveClaimGenerator(m) {
  if (typeof m.claim_generator === "string" && m.claim_generator) return m.claim_generator;
  const info = m.claim_generator_info || m.claimGeneratorInfo;
  if (Array.isArray(info) && info.length > 0) {
    const first = info[0];
    if (first && typeof first === "object") {
      const name = /** @type {Record<string, unknown>} */ (first).name;
      const version = /** @type {Record<string, unknown>} */ (first).version;
      if (typeof name === "string") {
        return typeof version === "string" && version ? `${name}/${version}` : name;
      }
    }
  }
  return null;
}

/**
 * @param {Record<string, unknown>} m
 * @returns {ProvenanceAction[]}
 */
function extractActions(m) {
  const assertions = Array.isArray(m.assertions) ? m.assertions : [];
  /** @type {ProvenanceAction[]} */
  const out = [];

  for (const assertion of assertions) {
    if (!assertion || typeof assertion !== "object") continue;
    const label = /** @type {Record<string, unknown>} */ (assertion).label;
    if (typeof label !== "string" || !label.includes("c2pa.actions")) continue;

    const data = /** @type {Record<string, unknown>} */ (assertion).data;
    if (!data || typeof data !== "object") continue;
    const list = /** @type {Record<string, unknown>} */ (data).actions;
    if (!Array.isArray(list)) continue;

    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const row = /** @type {Record<string, unknown>} */ (item);
      const action = typeof row.action === "string" ? row.action : null;
      if (!action) continue;

      let softwareAgent = null;
      const agent = row.softwareAgent ?? row.software_agent;
      if (typeof agent === "string") softwareAgent = agent;
      else if (agent && typeof agent === "object") {
        const n = /** @type {Record<string, unknown>} */ (agent).name;
        if (typeof n === "string") softwareAgent = n;
      }

      out.push({
        action,
        softwareAgent,
        when: typeof row.when === "string" ? row.when : null,
      });
    }
  }

  return out;
}

/**
 * @param {Record<string, unknown>} m
 * @returns {ProvenanceIngredient[]}
 */
function extractIngredients(m) {
  const list = Array.isArray(m.ingredients) ? m.ingredients : [];
  return list
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = /** @type {Record<string, unknown>} */ (item);
      return {
        title: typeof row.title === "string" ? row.title : null,
        format: typeof row.format === "string" ? row.format : null,
        relationship: typeof row.relationship === "string" ? row.relationship : null,
      };
    });
}

/**
 * @param {Record<string, unknown>} store
 */
function collectValidationMessages(store) {
  /** @type {{ code: string; explanation: string | null; level: string }[]} */
  const messages = [];

  const legacy = store.validation_status || store.validationStatus;
  if (Array.isArray(legacy)) {
    for (const item of legacy) {
      if (!item || typeof item !== "object") continue;
      const row = /** @type {Record<string, unknown>} */ (item);
      if (typeof row.code !== "string") continue;
      messages.push({
        code: row.code,
        explanation: typeof row.explanation === "string" ? row.explanation : null,
        level: row.success === false ? "failure" : "info",
      });
    }
  }

  const results = /** @type {Record<string, unknown> | null} */ (
    store.validation_results || store.validationResults || null
  );
  const active = results && /** @type {Record<string, unknown>} */ (results.activeManifest || results.active_manifest);
  if (active && typeof active === "object") {
    for (const level of ["failure", "informational", "success"]) {
      const arr = /** @type {unknown} */ (active[level]);
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (!item || typeof item !== "object") continue;
        const row = /** @type {Record<string, unknown>} */ (item);
        if (typeof row.code !== "string") continue;
        messages.push({
          code: row.code,
          explanation: typeof row.explanation === "string" ? row.explanation : null,
          level,
        });
      }
    }
  }

  return messages.slice(0, 40);
}

/**
 * @param {object} partial
 * @returns {ProvenanceResult}
 */
function baseResult(partial) {
  return {
    status: partial.status,
    manifest: partial.manifest,
    signature: partial.signature,
    trust: partial.trust,
    validationState: null,
    claimGenerator: null,
    title: null,
    signerIssuer: null,
    signerCommonName: null,
    signedAt: null,
    actions: [],
    ingredients: [],
    validationMessages: [],
    warnings: partial.warnings || [],
    errorCode: null,
    durationMs: partial.durationMs || 0,
  };
}
