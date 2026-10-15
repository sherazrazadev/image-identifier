import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  HelpCircle,
  Loader2,
  Printer,
  RotateCcw,
  Square,
  X,
  XCircle,
} from "lucide-react";
import { reconcileEvidence, getEvidenceDisclaimer } from "../../lib/evidence/reconcile.js";
import { buildAnalysisReport, downloadAnalysisReport } from "../../lib/evidence/exportReport.js";
import ProvenancePanel from "./ProvenancePanel.jsx";
import MetadataPanel from "./MetadataPanel.jsx";
import StatisticalPanel from "./StatisticalPanel.jsx";
import TechnicalPanel from "./TechnicalPanel.jsx";

const TABS = [
  { id: "provenance", label: "Credentials" },
  { id: "details", label: "Details" },
  { id: "statistical", label: "Statistical" },
  { id: "technical", label: "Technical" },
];

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
  statisticalStage = null,
  onRunStatistical,
  onCancelStatistical,
  onAnalyzeAnother,
  onClear,
  onCancel,
}) {
  const [tab, setTab] = useState("provenance");
  const busy = phase === "analyzing";

  const summary = useMemo(
    () =>
      reconcileEvidence({
        provenance: provenanceResult,
        provenanceStatus,
        metadata: detailsResult,
        metadataStatus: detailsStatus,
        statistical: {
          status: statisticalStatus,
          flagsPossibleAi: statisticalResult?.flagsPossibleAi,
          score: statisticalResult?.topScore ?? null,
        },
      }),
    [
      provenanceResult,
      provenanceStatus,
      detailsResult,
      detailsStatus,
      statisticalStatus,
      statisticalResult,
    ],
  );

  const onExport = () => {
    const report = buildAnalysisReport({
      file: {
        name: selection.fileName,
        mimeType: selection.mimeType,
        width: selection.width,
        height: selection.height,
        sizeBytes: selection.sizeBytes,
      },
      summary,
      provenance: provenanceResult,
      provenanceStatus,
      metadata: detailsResult,
      metadataStatus: detailsStatus,
      statistical: statisticalResult,
      statisticalStatus,
    });
    downloadAnalysisReport(report);
  };

  const onPrint = () => {
    window.print();
  };

  const onTabKeyDown = (event, index) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TABS.length - 1;
    setTab(TABS[next].id);
    const el = document.getElementById(`result-tab-${TABS[next].id}`);
    el?.focus();
  };

  return (
    <div className="stage-enter space-y-4 results-dashboard">
      <div className="rounded-[var(--radius)] border border-border bg-bg-elevated/90 p-4 sm:p-5 print:border-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="mx-auto sm:mx-0 w-full max-w-[200px] shrink-0 overflow-hidden rounded-xl border border-border bg-bg aspect-square flex items-center justify-center print:max-w-[140px]">
            <img
              src={selection.objectUrl}
              alt={`Preview of ${selection.fileName}`}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-3 text-left">
            <div>
              <p className="font-display font-semibold text-fg m-0 truncate" title={selection.fileName}>
                {selection.fileName}
              </p>
              <p className="text-sm text-muted m-0 mt-1">
                {selection.width != null && selection.height != null
                  ? `${selection.width} × ${selection.height}px · `
                  : null}
                {formatBytes(selection.sizeBytes)}
                {selection.mimeType
                  ? ` · ${selection.mimeType === "image/png" ? "PNG" : "JPEG"}`
                  : null}
              </p>
            </div>

            {busy ? (
              <div className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
                Reviewing your image…
              </div>
            ) : (
              <div className="space-y-3" aria-live="polite">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted m-0 mb-1.5">Evidence summary</p>
                  <div className="flex flex-wrap gap-2">
                    <EvidenceChip label={summary.primaryLabel} emphasis />
                    {summary.labels
                      .filter((l) => l !== summary.primaryLabel)
                      .map((l) => (
                        <EvidenceChip key={l} label={l} />
                      ))}
                  </div>
                </div>

                {summary.keyEvidence.length > 0 && (
                  <ul className="m-0 list-disc pl-5 text-sm text-muted space-y-1">
                    {summary.keyEvidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}

                {summary.warnings.length > 0 && (
                  <div className="space-y-1.5">
                    {summary.warnings.slice(0, 6).map((w) => (
                      <div
                        key={w}
                        className="flex gap-2 rounded-xl border border-warn/35 bg-warn/10 px-3 py-2 text-xs text-fg"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warn mt-0.5" aria-hidden="true" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {summary.modules.map((m) => (
                    <ModulePill key={m.id} module={m} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[var(--radius)] border border-border bg-bg-elevated/90 p-4 sm:p-5 print-results-body">
        <div
          role="tablist"
          aria-label="Results"
          className="flex flex-wrap gap-2 border-b border-border pb-3 mb-4 overflow-x-auto no-print"
        >
          {TABS.map((t, index) => (
            <button
              key={t.id}
              id={`result-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`result-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKeyDown(e, index)}
              className={[
                "min-h-11 rounded-xl px-3 py-1.5 text-sm font-semibold cursor-pointer border whitespace-nowrap",
                tab === t.id
                  ? "border-accent bg-accent/10 text-fg"
                  : "border-transparent bg-transparent text-muted hover:text-fg",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Print: show all panels */}
        <div className="hidden print:block space-y-6">
          <section>
            <h3 className="font-display font-semibold text-fg">Credentials</h3>
            <ProvenancePanel result={provenanceResult} status={provenanceStatus} />
          </section>
          <section>
            <h3 className="font-display font-semibold text-fg">Details</h3>
            <MetadataPanel result={detailsResult} status={detailsStatus} />
          </section>
          <section>
            <h3 className="font-display font-semibold text-fg">Statistical</h3>
            <StatisticalPanel
              status={statisticalStatus}
              result={statisticalResult}
              stage={statisticalStage}
              canRun={Boolean(onRunStatistical) && !busy}
              onRun={() => onRunStatistical?.()}
              onCancel={onCancelStatistical}
            />
          </section>
          <section>
            <h3 className="font-display font-semibold text-fg">Technical</h3>
            <TechnicalPanel
              selection={selection}
              provenance={provenanceResult}
              provenanceStatus={provenanceStatus}
              metadata={detailsResult}
              metadataStatus={detailsStatus}
              statistical={statisticalResult}
              statisticalStatus={statisticalStatus}
            />
          </section>
        </div>

        <div className="print:hidden">
          <div
            id={`result-panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`result-tab-${tab}`}
          >
            {tab === "provenance" && (
              <ProvenancePanel result={provenanceResult} status={provenanceStatus} />
            )}
            {tab === "details" && (
              <MetadataPanel result={detailsResult} status={detailsStatus} />
            )}
            {tab === "statistical" && (
              <StatisticalPanel
                status={statisticalStatus}
                result={statisticalResult}
                stage={statisticalStage}
                canRun={Boolean(onRunStatistical) && !busy}
                onRun={() => onRunStatistical?.()}
                onCancel={onCancelStatistical}
              />
            )}
            {tab === "technical" && (
              <TechnicalPanel
                selection={selection}
                provenance={provenanceResult}
                provenanceStatus={provenanceStatus}
                metadata={detailsResult}
                metadataStatus={detailsStatus}
                statistical={statisticalResult}
                statisticalStatus={statisticalStatus}
              />
            )}
          </div>
        </div>

        <p className="mt-5 mb-0 rounded-xl border border-border bg-bg px-3 py-3 text-xs text-muted leading-relaxed results-disclaimer">
          {getEvidenceDisclaimer()}
        </p>
      </div>

      <div className="sticky bottom-3 z-10 no-print">
        <div className="flex flex-wrap gap-2 rounded-[var(--radius)] border border-border bg-bg-elevated/95 p-2 shadow-sm backdrop-blur-md">
          {busy && onCancel ? (
            <ActionButton onClick={onCancel} icon={Square} label="Cancel" />
          ) : (
            <>
              <ActionButton onClick={onExport} disabled={busy} icon={Download} label="Export JSON" />
              <ActionButton onClick={onPrint} disabled={busy} icon={Printer} label="Print" />
            </>
          )}
          <ActionButton onClick={onAnalyzeAnother} icon={RotateCcw} label="Analyze another" />
          <ActionButton onClick={onClear} icon={X} label="Clear" muted />
        </div>
      </div>
    </div>
  );
}

/** @param {{ label: string; emphasis?: boolean }} props */
function EvidenceChip({ label, emphasis = false }) {
  const conflict = /conflict/i.test(label);
  const incomplete = /incomplete|unavailable/i.test(label);
  const tone = conflict
    ? "border-warn/45 bg-warn/10"
    : incomplete
      ? "border-border bg-bg"
      : emphasis
        ? "border-accent/40 bg-accent/10"
        : "border-border bg-bg";

  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold text-fg ${tone}`}
    >
      {label}
    </span>
  );
}

/** @param {{ module: { id: string; label: string; status: string } }} props */
function ModulePill({ module }) {
  const status = module.status;
  let Icon = HelpCircle;
  let text = `${module.label}: unknown`;
  let cls = "border-border text-muted";

  if (status === "running") {
    Icon = Loader2;
    text = `${module.label}: running`;
    cls = "border-accent/40 text-fg";
  } else if (status === "success") {
    Icon = CheckCircle2;
    text = `${module.label}: ran`;
    cls = "border-ok/40 text-fg";
  } else if (status === "not_found") {
    Icon = HelpCircle;
    text = `${module.label}: nothing found`;
    cls = "border-border text-muted";
  } else if (status === "failed") {
    Icon = XCircle;
    text = `${module.label}: failed`;
    cls = "border-danger/40 text-fg";
  } else if (status === "skipped") {
    Icon = HelpCircle;
    text = `${module.label}: skipped`;
    cls = "border-border text-muted";
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium ${cls}`}>
      <Icon
        className={`h-3.5 w-3.5 ${status === "running" ? "animate-spin text-accent" : ""}`}
        aria-hidden="true"
      />
      {text}
    </span>
  );
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

/** @param {number} bytes */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
