import { getEvidenceDisclaimer, reconcileEvidence } from "./reconcile.js";

/**
 * Build a downloadable analysis report (not a certificate).
 * Never includes image bytes.
 *
 * @param {object} opts
 * @param {object} opts.file
 * @param {import('./reconcile.js').ReconcileOutput} [opts.summary]
 * @param {import('../c2pa/mapStore.js').ProvenanceResult | null} opts.provenance
 * @param {string} opts.provenanceStatus
 * @param {import('../metadata/extract.js').MetadataResult | null} opts.metadata
 * @param {string} opts.metadataStatus
 * @param {import('../ml/interpret.js').StatisticalResult | null} [opts.statistical]
 * @param {string} [opts.statisticalStatus]
 */
export function buildAnalysisReport(opts) {
  const statisticalStatus = opts.statisticalStatus ?? (opts.statistical ? opts.statistical.status : "skipped");
  const summary =
    opts.summary ||
    reconcileEvidence({
      provenance: opts.provenance,
      provenanceStatus: /** @type {any} */ (opts.provenanceStatus),
      metadata: opts.metadata,
      metadataStatus: /** @type {any} */ (opts.metadataStatus),
      statistical: {
        status: /** @type {any} */ (statisticalStatus),
        flagsPossibleAi: opts.statistical?.flagsPossibleAi,
        score: opts.statistical?.topScore ?? null,
      },
    });

  return {
    reportType: "analysis_report",
    title: "Image Identifier — Analysis Report",
    notACertificate: true,
    disclaimer: getEvidenceDisclaimer(),
    generatedAt: new Date().toISOString(),
    file: {
      name: opts.file?.name ?? null,
      mimeType: opts.file?.mimeType ?? null,
      width: opts.file?.width ?? null,
      height: opts.file?.height ?? null,
      sizeBytes: opts.file?.sizeBytes ?? null,
    },
    summary: {
      primaryLabel: summary.primaryLabel,
      labels: summary.labels,
      keyEvidence: summary.keyEvidence,
      warnings: summary.warnings,
      hasConflict: summary.hasConflict,
      modules: summary.modules,
    },
    modules: {
      credentials: {
        status: opts.provenanceStatus,
        result: opts.provenance
          ? {
              manifest: opts.provenance.manifest,
              signature: opts.provenance.signature,
              trust: opts.provenance.trust,
              validationState: opts.provenance.validationState,
              claimGenerator: opts.provenance.claimGenerator,
              title: opts.provenance.title,
              signerIssuer: opts.provenance.signerIssuer,
              signerCommonName: opts.provenance.signerCommonName,
              signedAt: opts.provenance.signedAt,
              actions: opts.provenance.actions,
              ingredients: opts.provenance.ingredients,
              validationMessages: opts.provenance.validationMessages,
              warnings: opts.provenance.warnings,
              durationMs: opts.provenance.durationMs,
            }
          : null,
      },
      details: {
        status: opts.metadataStatus,
        result: opts.metadata
          ? {
              status: opts.metadata.status,
              clueCount: opts.metadata.clueCount,
              hasGps: opts.metadata.hasGps,
              fieldCount: opts.metadata.fields?.length ?? 0,
              fields: opts.metadata.fields,
              warnings: opts.metadata.warnings,
              durationMs: opts.metadata.durationMs,
            }
          : null,
      },
      statistical: {
        status: statisticalStatus,
        result: opts.statistical
          ? {
              flagsPossibleAi: opts.statistical.flagsPossibleAi,
              topLabel: opts.statistical.topLabel,
              topScore: opts.statistical.topScore,
              scores: opts.statistical.scores,
              modelId: opts.statistical.modelId,
              modelDisplayName: opts.statistical.modelDisplayName,
              runtime: opts.statistical.runtime,
              limitations: opts.statistical.limitations,
              warnings: opts.statistical.warnings,
              durationMs: opts.statistical.durationMs,
              errorCode: opts.statistical.errorCode,
            }
          : null,
        note:
          statisticalStatus === "skipped" || statisticalStatus === "idle"
            ? "Statistical analysis was not run for this report."
            : null,
      },
    },
  };
}

/**
 * Trigger a browser download of the analysis report JSON.
 * @param {ReturnType<typeof buildAnalysisReport>} report
 * @param {string} [filename]
 */
export function downloadAnalysisReport(report, filename) {
  const name =
    filename ||
    `image-identifier-report-${(report.file?.name || "image").replace(/[^\w.-]+/g, "_")}.json`;
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
