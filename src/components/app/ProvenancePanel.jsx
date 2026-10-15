import { AlertTriangle, CheckCircle2, HelpCircle, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";

/**
 * @param {{
 *   result: import('../../lib/c2pa/mapStore.js').ProvenanceResult | null;
 *   status: 'idle' | 'running' | 'success' | 'not_found' | 'failed' | 'skipped';
 * }} props
 */
export default function ProvenancePanel({ result, status }) {
  if (status === "running") {
    return (
      <p className="text-sm text-muted m-0" aria-live="polite">
        Checking credentials…
      </p>
    );
  }

  if (status === "failed" || result?.status === "failed") {
    return (
      <div
        className="flex gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm"
        role="alert"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
        <p className="m-0">
          Could not read credentials for this file. Other results are still available when present.
        </p>
      </div>
    );
  }

  if (status === "not_found" || result?.manifest === "not_found") {
    return (
      <div className="space-y-3 text-sm text-left">
        <StatusChip tone="muted" icon={HelpCircle} label="No credentials found" />
        <p className="m-0 text-muted">
          This file did not include readable content credentials. That does not prove the image is
          authentic or inauthentic.
        </p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-4 text-left text-sm">
      <div className="flex flex-wrap gap-2">
        <StatusChip tone="ok" icon={CheckCircle2} label="Credentials found" />
        <SignatureChip status={result.signature} />
        <TrustChip status={result.trust} />
      </div>

      <div className="rounded-xl border border-border bg-bg px-3 py-3 text-muted space-y-2">
        <p className="m-0">
          <span className="font-semibold text-fg">Signature</span> — a valid signature means the
          recorded data passed cryptographic checks. It does not prove the scene itself is real.
        </p>
        <p className="m-0">
          <span className="font-semibold text-fg">Trust</span> — a trusted signer means the signing
          identity matched a known trust source used by this check. It is not the same as a truthful
          image.
        </p>
      </div>

      <dl className="grid gap-2 m-0">
        <Row label="Title" value={result.title} />
        <Row label="Recorded by" value={result.claimGenerator} />
        <Row label="Signer" value={result.signerCommonName || result.signerIssuer} />
        <Row label="Issuer" value={result.signerIssuer} />
        <Row label="Signed at" value={result.signedAt} />
      </dl>

      {result.actions.length > 0 && (
        <section>
          <h3 className="font-display text-sm font-semibold text-fg m-0 mb-2">Recorded actions</h3>
          <ul className="m-0 list-none space-y-2 p-0">
            {result.actions.map((a, i) => (
              <li
                key={`${a.action}-${i}`}
                className="rounded-xl border border-border bg-bg-elevated/80 px-3 py-2"
              >
                <p className="m-0 font-medium text-fg">{humanizeAction(a.action)}</p>
                {(a.softwareAgent || a.when) && (
                  <p className="m-0 mt-1 text-xs text-muted">
                    {[a.softwareAgent, a.when].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.ingredients.length > 0 && (
        <section>
          <h3 className="font-display text-sm font-semibold text-fg m-0 mb-2">Source ingredients</h3>
          <ul className="m-0 list-none space-y-2 p-0">
            {result.ingredients.map((ing, i) => (
              <li
                key={`${ing.title || "ing"}-${i}`}
                className="rounded-xl border border-border bg-bg-elevated/80 px-3 py-2"
              >
                <p className="m-0 font-medium text-fg">{ing.title || "Untitled source"}</p>
                <p className="m-0 mt-1 text-xs text-muted">
                  {[ing.format, ing.relationship].filter(Boolean).join(" · ") || "Related source"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.validationMessages.filter((m) => m.level === "failure").length > 0 && (
        <section>
          <h3 className="font-display text-sm font-semibold text-fg m-0 mb-2">Validation notes</h3>
          <ul className="m-0 list-none space-y-1.5 p-0">
            {result.validationMessages
              .filter((m) => m.level === "failure")
              .slice(0, 8)
              .map((m) => (
                <li key={m.code} className="text-xs text-danger">
                  {m.explanation || m.code}
                </li>
              ))}
          </ul>
        </section>
      )}

      {result.warnings.map((w) => (
        <p key={w} className="m-0 text-xs text-muted">
          {w}
        </p>
      ))}
    </div>
  );
}

/**
 * @param {{ tone: 'ok' | 'warn' | 'danger' | 'muted'; icon: import('lucide-react').LucideIcon; label: string }} props
 */
function StatusChip({ tone, icon: Icon, label }) {
  const tones = {
    ok: "border-ok/40 bg-ok/10 text-fg",
    warn: "border-warn/40 bg-warn/10 text-fg",
    danger: "border-danger/40 bg-danger/10 text-fg",
    muted: "border-border bg-bg text-muted",
  };
  const iconTone = {
    ok: "text-ok",
    warn: "text-warn",
    danger: "text-danger",
    muted: "text-muted",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      <Icon className={`h-3.5 w-3.5 ${iconTone[tone]}`} aria-hidden="true" />
      {label}
    </span>
  );
}

/** @param {{ status: string }} props */
function SignatureChip({ status }) {
  if (status === "valid") return <StatusChip tone="ok" icon={ShieldCheck} label="Signature valid" />;
  if (status === "invalid")
    return <StatusChip tone="danger" icon={XCircle} label="Signature invalid" />;
  if (status === "not_applicable") return null;
  return <StatusChip tone="muted" icon={HelpCircle} label="Signature unknown" />;
}

/** @param {{ status: string }} props */
function TrustChip({ status }) {
  if (status === "trusted") return <StatusChip tone="ok" icon={ShieldCheck} label="Trust confirmed" />;
  if (status === "unconfirmed")
    return <StatusChip tone="warn" icon={ShieldAlert} label="Trust not confirmed" />;
  if (status === "not_applicable") return null;
  return <StatusChip tone="muted" icon={HelpCircle} label="Trust unknown" />;
}

/** @param {{ label: string; value: string | null }} props */
function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 sm:grid-cols-[10rem_1fr]">
      <dt className="text-muted m-0">{label}</dt>
      <dd className="text-fg m-0 break-words">{value}</dd>
    </div>
  );
}

/** @param {string} action */
function humanizeAction(action) {
  return action.replace(/^c2pa\./, "").replace(/[._]/g, " ");
}
