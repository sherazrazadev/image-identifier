import { useMemo } from "react";
import { Bot, Camera, CircleHelp, Loader2, RotateCcw, Square, X } from "lucide-react";
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
  const VerdictIcon = tone.Icon;
  const shortLabel =
    verdict.kind === "ai" ? "AI-generated" : verdict.kind === "real" ? "Real" : "Unclear";
  // "Likely" moves into the eyebrow so the title does not repeat the big label.
  const hedged = verdict.kind === "ai" || verdict.kind === "real";
  const showTitle = !hedged && verdict.title !== "Unclear";

  return (
    <div className="stage-enter space-y-4 results-dashboard">
      {/* Verdict first: the answer is the first thing seen. */}
      <div
        className={`rounded-[var(--radius)] border border-border border-t-[6px] px-4 py-8 text-center shadow-sm transition-colors duration-300 sm:px-10 sm:py-12 ${tone.panel}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy={checking}
      >
        {checking ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-accent-link" aria-hidden="true" />
            <div>
              <p className="font-display text-2xl font-bold text-fg m-0 sm:text-3xl">
                {verdict.title}
              </p>
              <p className="text-base text-muted m-0 mt-2 max-w-md mx-auto">{verdict.detail}</p>
            </div>
            <div className="checking-bar w-full max-w-xs" aria-hidden="true" />
          </div>
        ) : (
          <div key={verdict.kind} className="verdict-reveal flex flex-col items-center">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-xl ${tone.badge}`}
              aria-hidden="true"
            >
              <VerdictIcon className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted m-0 mt-4">
              {hedged ? "Likely" : "Result"}
            </p>
            <h2 className="font-display text-4xl font-extrabold text-fg m-0 mt-2 leading-none tracking-tight sm:text-7xl">
              {shortLabel}
            </h2>
            {showTitle ? (
              <p className="text-xl font-semibold text-fg m-0 mt-4 text-balance">{verdict.title}</p>
            ) : null}
            <p className="text-base text-muted m-0 mt-4 max-w-lg leading-relaxed text-balance">
              {verdict.detail}
            </p>
          </div>
        )}
      </div>

      {/* Actions sit right under the verdict (in flow, not floating) so they never cover content. */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center no-print">
        {checking ? (
          onCancel ? <ActionButton onClick={onCancel} icon={Square} label="Cancel" /> : null
        ) : (
          <>
            <ActionButton onClick={onClear} icon={X} label="Clear" />
            <ActionButton onClick={onAnalyzeAnother} icon={RotateCcw} label="Check another" primary />
          </>
        )}
      </div>

      {/* Selected file: object-contain so the preview never crops. */}
      <div className="flex items-center gap-4 rounded-[var(--radius)] border border-border bg-bg-elevated p-3 sm:p-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-bg sm:h-32 sm:w-32">
          <img
            src={selection.objectUrl}
            alt={`Preview of ${selection.fileName}`}
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted m-0">
            Your image
          </p>
          <p className="m-0 mt-1 truncate font-semibold text-fg" title={selection.fileName}>
            {selection.fileName}
          </p>
          <p className="text-sm text-muted m-0 mt-1">{formatBytes(selection.sizeBytes)}</p>
        </div>
      </div>

      <p className="m-0 rounded-[var(--radius)] border border-border bg-bg-elevated px-4 py-3 text-sm text-muted leading-relaxed text-center">
        {getSimpleDisclaimer()}{" "}
        <a href="/faq/" className="text-accent-link">
          FAQ
        </a>
        {" · "}
        <a href="/terms/" className="text-accent-link">
          Terms
        </a>
      </p>

    </div>
  );
}

/** @param {number} bytes */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Colour is never the only signal: each verdict also has an icon and a text label.
 * @param {import('../../lib/evidence/simpleVerdict.js').VerdictKind} kind
 */
function verdictTone(kind) {
  if (kind === "ai") {
    return { panel: "border-t-warn bg-bg-elevated", badge: "bg-warn/15 text-warn", Icon: Bot };
  }
  if (kind === "real") {
    return { panel: "border-t-ok bg-bg-elevated", badge: "bg-ok/15 text-ok", Icon: Camera };
  }
  if (kind === "checking") {
    return { panel: "border-t-accent bg-bg-elevated", badge: "", Icon: Loader2 };
  }
  return {
    panel: "border-t-muted bg-bg-elevated",
    badge: "bg-muted/15 text-muted",
    Icon: CircleHelp,
  };
}

/**
 * Five states: default, hover (border/brightness), active (scale), focus (global ring), disabled.
 * @param {{ onClick: () => void; icon: import('lucide-react').LucideIcon; label: string; disabled?: boolean; primary?: boolean }} props
 */
function ActionButton({ onClick, icon: Icon, label, disabled = false, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex min-h-12 w-full sm:w-auto sm:min-w-40 items-center justify-center gap-2 rounded-xl px-6 py-2 text-base font-semibold cursor-pointer border transition active:scale-[0.98]",
        primary
          ? "border-transparent bg-accent text-accent-fg shadow-sm hover:brightness-95"
          : "border-border bg-bg-elevated text-fg hover:border-accent",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
