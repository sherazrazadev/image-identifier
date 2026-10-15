import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, MapPin, Search } from "lucide-react";

/**
 * @param {{
 *   result: import('../../lib/metadata/extract.js').MetadataResult | null;
 *   status: 'idle' | 'running' | 'success' | 'not_found' | 'failed' | 'skipped';
 * }} props
 */
export default function MetadataPanel({ result, status }) {
  const [query, setQuery] = useState("");
  const [showGps, setShowGps] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  const filteredGroups = useMemo(() => {
    if (!result?.groups) return [];
    const q = query.trim().toLowerCase();

    return result.groups
      .map((group) => {
        const fields = group.fields.filter((f) => {
          if (f.isGps && !showGps) return false;
          if (f.technical && !showTechnical) return false;
          if (!q) return true;
          return (
            f.label.toLowerCase().includes(q) ||
            f.key.toLowerCase().includes(q) ||
            f.value.toLowerCase().includes(q)
          );
        });
        return { ...group, fields };
      })
      .filter((g) => g.fields.length > 0);
  }, [result, query, showGps, showTechnical]);

  if (status === "running") {
    return (
      <p className="text-sm text-muted m-0" aria-live="polite">
        Reading file details…
      </p>
    );
  }

  if (status === "failed") {
    return (
      <div
        className="flex gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm"
        role="alert"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
        <p className="m-0">
          Could not read details from this file. You can still try another image.
        </p>
      </div>
    );
  }

  if (status === "not_found" || (result && result.fields.length === 0)) {
    return (
      <p className="text-sm text-muted m-0">
        No readable details were found in this file. That alone does not prove anything about
        authenticity.
      </p>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-4 text-left">
      {result.clueCount > 0 && (
        <div className="flex gap-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2.5 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
          <p className="m-0">
            {result.clueCount} possible generation{" "}
            {result.clueCount === 1 ? "clue" : "clues"} found — clues are not proof.
          </p>
        </div>
      )}

      {result.hasGps && !showGps && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm">
          <MapPin className="h-4 w-4 text-muted" aria-hidden="true" />
          <span className="text-muted flex-1">
            This file may include location data. Hidden by default.
          </span>
          <button
            type="button"
            onClick={() => setShowGps(true)}
            className="min-h-11 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm font-semibold text-fg cursor-pointer"
          >
            Show location fields
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">Filter fields</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter fields…"
            className="w-full min-h-11 rounded-xl border border-border bg-bg pl-9 pr-3 text-sm text-fg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showTechnical}
            onChange={(e) => setShowTechnical(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Technical fields
        </label>
      </div>

      <div className="space-y-3">
        {filteredGroups.map((group) => (
          <details key={group.id} open className="rounded-xl border border-border bg-bg-elevated/80">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 font-display text-sm font-semibold text-fg">
              <ChevronDown className="h-4 w-4 text-muted details-open" aria-hidden="true" />
              <span className="flex-1">{group.label}</span>
              <span className="text-xs font-normal text-muted">{group.fields.length}</span>
            </summary>
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-muted">
                    <th className="px-3 py-2 font-medium w-[28%]">Field</th>
                    <th className="px-3 py-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {group.fields.map((field) => (
                    <tr key={field.key} className="border-t border-border/70 align-top">
                      <td className="px-3 py-2 text-fg font-medium">
                        <span>{field.label}</span>
                        {field.isClue && (
                          <span className="ml-2 inline-block rounded-md bg-warn/15 px-1.5 py-0.5 text-[11px] font-semibold text-warn">
                            Clue
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted break-words whitespace-pre-wrap">
                        {field.value}
                        {field.clueNote && (
                          <span className="block mt-1 text-xs text-warn">{field.clueNote}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>

      {filteredGroups.length === 0 && (
        <p className="text-sm text-muted m-0 flex items-center gap-2">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          No fields match this filter.
        </p>
      )}
    </div>
  );
}
