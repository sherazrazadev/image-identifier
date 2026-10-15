import { AlertTriangle, Loader2, Play, Square } from "lucide-react";
import { getEvidenceDisclaimer } from "../../lib/evidence/reconcile.js";
import { ML_MODEL_DISPLAY_NAME, ML_MODEL_ID } from "../../lib/ml/config.js";

/**
 * @param {{
 *   status: 'idle' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';
 *   result: import('../../lib/ml/interpret.js').StatisticalResult | null;
 *   stage?: string | null;
 *   canRun: boolean;
 *   onRun: () => void;
 *   onCancel?: () => void;
 * }} props
 */
export default function StatisticalPanel({
  status,
  result,
  stage = null,
  canRun,
  onRun,
  onCancel,
}) {
  const running = status === "running";

  return (
    <div className="space-y-4 text-sm text-left">
      <div className="space-y-2">
        <p className="m-0 font-medium text-fg">Optional statistical check</p>
        <p className="m-0 text-muted">
          Runs only if you start it. Downloads a local model the first time. This is a statistical
          signal — not proof.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {!running && (
          <button
            type="button"
            onClick={onRun}
            disabled={!canRun || status === "running"}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-bg px-4 py-2 text-sm font-semibold text-fg hover:border-accent/50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {status === "success" || status === "failed" ? "Run again" : "Run statistical check"}
          </button>
        )}
        {running && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-bg px-4 py-2 text-sm font-semibold text-fg hover:border-accent/50 cursor-pointer"
          >
            <Square className="h-4 w-4" aria-hidden="true" />
            Cancel
          </button>
        )}
      </div>

      {running && (
        <div className="flex items-center gap-2 text-muted" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
          <span>
            {stage === "loading_model"
              ? "Loading model (first run may take a while)…"
              : stage === "running_inference"
                ? "Running local check…"
                : "Starting statistical check…"}
          </span>
        </div>
      )}

      {status === "failed" && (
        <div
          className="flex gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
          <div className="space-y-1">
            <p className="m-0 text-fg">
              Statistical check could not finish. Other results are unchanged.
            </p>
            {result?.warnings?.length ? (
              <ul className="m-0 pl-4 text-xs text-muted">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      )}

      {status === "success" && result && (
        <div className="space-y-3 stage-enter">
          <dl className="grid gap-2 m-0">
            <Row label="Model" value={`${result.modelDisplayName}`} />
            <Row label="Model id" value={result.modelId} />
            <Row label="Runtime" value={result.runtime} />
            <Row
              label="Top label"
              value={
                result.topLabel != null && result.topScore != null
                  ? `${result.topLabel} · model score ${formatScore(result.topScore)}`
                  : "—"
              }
            />
            <Row
              label="Signal"
              value={
                result.flagsPossibleAi
                  ? "Model leans toward AI-generated (statistical only)"
                  : "Model does not lean toward AI-generated (statistical only)"
              }
            />
          </dl>

          {result.scores.length > 0 && (
            <div>
              <p className="m-0 mb-2 font-medium text-fg">Model scores</p>
              <ul className="m-0 list-none space-y-1.5 p-0">
                {result.scores.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3 py-2"
                  >
                    <span className="text-fg font-medium">{row.label}</span>
                    <span className="text-muted tabular-nums">{formatScore(row.score)}</span>
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-2 text-xs text-muted">
                Scores are model outputs, not authenticity percentages.
              </p>
            </div>
          )}

          <div>
            <p className="m-0 mb-1.5 font-medium text-fg">Limitations</p>
            <ul className="m-0 pl-5 text-xs text-muted space-y-1">
              {result.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {(status === "idle" || status === "skipped") && (
        <p className="m-0 text-xs text-muted">
          Model: {ML_MODEL_DISPLAY_NAME} ({ML_MODEL_ID}). Not loaded until you run the check.
        </p>
      )}

      <p className="m-0 rounded-xl border border-border bg-bg px-3 py-3 text-xs text-muted leading-relaxed">
        {getEvidenceDisclaimer()}
      </p>
    </div>
  );
}

/** @param {{ label: string; value: string }} props */
function Row({ label, value }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 sm:grid-cols-[9rem_1fr]">
      <dt className="text-muted m-0">{label}</dt>
      <dd className="text-fg m-0 break-words">{value}</dd>
    </div>
  );
}

/** @param {number} score */
function formatScore(score) {
  return score.toFixed(3);
}
