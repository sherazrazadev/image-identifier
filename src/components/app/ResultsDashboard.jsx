import { useMemo } from "react";
import { Loader2, RotateCcw, Square, X } from "lucide-react";
import { getSimpleDisclaimer, getSimpleVerdict } from "../../lib/evidence/simpleVerdict.js";

// Detail panels kept in repo but not shown (would expose detection surface).

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
  const shortLabel =
    verdict.kind === "ai" ? "AI-generated" : verdict.kind === "real" ? "Real" : verdict.kind === "checking" ? "Checking" : "Unclear";

  return (
    <div className="stage-enter space-y-4 results-dashboard">
      <div className="rounded-[var(--radius)] border border-border bg-bg-elevated/90 p-4 sm:p-5">
        <div className="mx-auto w-full max-w-[220px] overflow-hidden rounded-xl border border-border bg-bg aspect-square flex items-center justify-center">
          <img
            src={selection.objectUrl}
            alt={`Preview of ${selection.fileName}`}
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <p className="mt-3 mb-0 text-center text-sm text-muted truncate" title={selection.fileName}>
          {selection.fileName}
        </p>
      </div>

      <div
        className={`rounded-[var(--radius)] border-2 px-5 py-8 sm:px-8 sm:py-10 text-center ${tone.panel}`}
        aria-live="polite"
      >
        {checking ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className={`h-10 w-10 animate-spin ${tone.icon}`} aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] m-0 opacity-80">Working</p>
              <p className={`font-display text-3xl sm:text-4xl font-extrabold m-0 mt-2 ${tone.headline}`}>
                {verdict.title}
              </p>
              <p className={`text-base m-0 mt-3 max-w-md mx-auto ${tone.detail}`}>{verdict.detail}</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] m-0 opacity-80">Result</p>
            <p
              className={`font-display text-4xl sm:text-5xl font-extrabold m-0 mt-3 leading-tight tracking-tight ${tone.headline}`}
            >
              {shortLabel}
            </p>
            <p className={`text-lg sm:text-xl font-semibold m-0 mt-3 ${tone.sub}`}>
              {verdict.title}
            </p>
            <p className={`text-sm sm:text-base m-0 mt-3 max-w-lg mx-auto leading-relaxed ${tone.detail}`}>
              {verdict.detail}
            </p>
          </div>
        )}
      </div>

      <p className="m-0 rounded-[var(--radius)] border border-border bg-bg-elevated/80 px-4 py-3 text-xs text-muted leading-relaxed text-center">
        {getSimpleDisclaimer()}{" "}
        <a href="/faq/" className="text-accent">
          FAQ
        </a>
        {" · "}
        <a href="/terms/" className="text-accent">
          Terms
        </a>
      </p>

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
      panel: "border-warn/50 bg-warn/12",
      headline: "text-fg",
      sub: "text-fg",
      detail: "text-muted",
      icon: "text-warn",
    };
  }
  if (kind === "real") {
    return {
      panel: "border-ok/50 bg-ok/12",
      headline: "text-fg",
      sub: "text-fg",
      detail: "text-muted",
      icon: "text-ok",
    };
  }
  if (kind === "checking") {
    return {
      panel: "border-accent/40 bg-accent/10",
      headline: "text-fg",
      sub: "text-fg",
      detail: "text-muted",
      icon: "text-accent",
    };
  }
  return {
    panel: "border-border bg-bg-elevated/90",
    headline: "text-fg",
    sub: "text-fg",
    detail: "text-muted",
    icon: "text-muted",
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
