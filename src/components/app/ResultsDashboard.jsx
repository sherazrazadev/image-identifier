import { useMemo } from "react";
import { Loader2, RotateCcw, Square, X } from "lucide-react";
import { getSimpleDisclaimer, getSimpleVerdict } from "../../lib/evidence/simpleVerdict.js";

// Detail panels (credentials / file details / statistical / technical) are kept
// in the codebase but not shown — they expose how the check works.
// import ProvenancePanel from "./ProvenancePanel.jsx";
// import MetadataPanel from "./MetadataPanel.jsx";
// import StatisticalPanel from "./StatisticalPanel.jsx";
// import TechnicalPanel from "./TechnicalPanel.jsx";
// import { reconcileEvidence, getEvidenceDisclaimer } from "../../lib/evidence/reconcile.js";
// import { buildAnalysisReport, downloadAnalysisReport } from "../../lib/evidence/exportReport.js";

/**
 * @param {{
 *   selection: {
 *     jobId: string;
 *     fileName: string;
 *     objectUrl: string;
 *     width: number | null;
 *     height: number | null;
 *     mimeType: string | null;
 *     sizeBytes: number;
 *   };
 *   phase: 'analyzing' | 'ready';
 *   provenanceResult: import('../../lib/c2pa/mapStore.js').ProvenanceResult | null;
 *   provenanceStatus: import('../../lib/evidence/reconcile.js').ModuleStatus;
 *   detailsResult: import('../../lib/metadata/extract.js').MetadataResult | null;
 *   detailsStatus: import('../../lib/evidence/reconcile.js').ModuleStatus;
 *   statisticalResult?: import('../../lib/ml/interpret.js').StatisticalResult | null;
 *   statisticalStatus?: import('../../lib/evidence/reconcile.js').ModuleStatus;
 *   statisticalStage?: string | null;
 *   onRunStatistical?: () => void;
 *   onCancelStatistical?: () => void;
 *   onAnalyzeAnother: () => void;
 *   onClear: () => void;
 *   onCancel?: () => void;
 * }} props
 */
export default function ResultsDashboard({
  selection,
  phase,
  provenanceResult,
  provenanceStatus,
  detailsResult,
  detailsStatus,
  statisticalResult = null,
  statisticalStatus = "skipped",
  onAnalyzeAnother,
  onClear,
  onCancel,
}) {
  const analyzing = phase === "analyzing";

  const verdict = useMemo(
    () =>
      getSimpleVerdict({
        analyzing,
        provenanceResult,
        provenanceStatus,
        detailsResult,
        detailsStatus,
        statisticalResult,
        statisticalStatus,
      }),
    [
      analyzing,
      provenanceResult,
      provenanceStatus,
      detailsResult,
      detailsStatus,
      statisticalResult,
      statisticalStatus,
    ],
  );

  const checking = verdict.kind === "checking";
  const tone = verdictTone(verdict.kind);

  return (
    <div className="stage-enter space-y-4 results-dashboard">
      <div className="rounded-[var(--radius)] border border-border bg-bg-elevated/90 p-4 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="mx-auto sm:mx-0 w-full max-w-[180px] shrink-0 overflow-hidden rounded-xl border border-border bg-bg aspect-square flex items-center justify-center">
            <img
              src={selection.objectUrl}
              alt={`Preview of ${selection.fileName}`}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left space-y-3" aria-live="polite">
            {checking ? (
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-accent shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-display text-2xl font-semibold text-fg m-0">{verdict.title}</p>
                  <p className="text-sm text-muted m-0 mt-1">{verdict.detail}</p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted m-0 mb-2">Result</p>
                <p className={`font-display text-3xl font-bold m-0 ${tone.title}`}>{verdict.title}</p>
                <p className="text-sm text-muted m-0 mt-2 max-w-md mx-auto sm:mx-0">{verdict.detail}</p>
                <span
                  className={`mt-4 inline-flex items-center rounded-xl border px-3 py-1.5 text-sm font-semibold ${tone.badge}`}
                >
                  {verdict.kind === "ai"
                    ? "AI-generated"
                    : verdict.kind === "real"
                      ? "Real"
                      : "Unclear"}
                </span>
              </div>
            )}
          </div>
        </div>

        <p className="mt-5 mb-0 rounded-xl border border-border bg-bg px-3 py-3 text-xs text-muted leading-relaxed text-center sm:text-left">
          {getSimpleDisclaimer()}
        </p>
      </div>

      {/*
        Advanced evidence tabs (commented — exposes detection surface):
        Credentials / Details / Statistical / Technical panels + export JSON.
      */}

      <div className="sticky bottom-3 z-10 no-print">
        <div className="flex flex-wrap gap-2 rounded-[var(--radius)] border border-border bg-bg-elevated/95 p-2 shadow-sm backdrop-blur-md">
          {checking && onCancel ? (
            <ActionButton onClick={onCancel} icon={Square} label="Cancel" />
          ) : null}
          <ActionButton onClick={onAnalyzeAnother} icon={RotateCcw} label="Check another" />
          <ActionButton onClick={onClear} icon={X} label="Clear" muted />
        </div>
      </div>
    </div>
  );
}

/** @param {import('../../lib/evidence/simpleVerdict.js').VerdictKind} kind */
function verdictTone(kind) {
  if (kind === "ai") {
    return {
      title: "text-fg",
      badge: "border-warn/45 bg-warn/15 text-fg",
    };
  }
  if (kind === "real") {
    return {
      title: "text-fg",
      badge: "border-ok/45 bg-ok/15 text-fg",
    };
  }
  return {
    title: "text-fg",
    badge: "border-border bg-bg text-muted",
  };
}

/**
 * @param {{ onClick: () => void; icon: import('lucide-react').LucideIcon; label: string; disabled?: boolean; muted?: boolean }} props
 */
function ActionButton({ onClick, icon: Icon, label, disabled = false, muted = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex min-h-11 flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold cursor-pointer border",
        muted
          ? "border-transparent bg-transparent text-muted hover:text-fg"
          : "border-border bg-bg text-fg hover:border-accent/50",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
