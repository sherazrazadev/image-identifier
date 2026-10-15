/**
 * @param {{
 *   selection: {
 *     fileName: string;
 *     mimeType: string | null;
 *     width: number | null;
 *     height: number | null;
 *     sizeBytes: number;
 *     jobId: string;
 *   };
 *   provenance: import('../../lib/c2pa/mapStore.js').ProvenanceResult | null;
 *   provenanceStatus: string;
 *   metadata: import('../../lib/metadata/extract.js').MetadataResult | null;
 *   metadataStatus: string;
 *   statistical?: import('../../lib/ml/interpret.js').StatisticalResult | null;
 *   statisticalStatus?: string;
 * }} props
 */
export default function TechnicalPanel({
  selection,
  provenance,
  provenanceStatus,
  metadata,
  metadataStatus,
  statistical = null,
  statisticalStatus = "skipped",
}) {
  const rows = [
    ["File name", selection.fileName],
    ["Format", selection.mimeType || "—"],
    [
      "Dimensions",
      selection.width != null && selection.height != null
        ? `${selection.width} × ${selection.height}px`
        : "—",
    ],
    ["File size", formatBytes(selection.sizeBytes)],
    ["Credentials check", provenanceStatus],
    ["Credentials duration", provenance ? `${provenance.durationMs} ms` : "—"],
    ["Details check", metadataStatus],
    ["Details duration", metadata ? `${metadata.durationMs} ms` : "—"],
    ["Details fields", metadata ? String(metadata.fields?.length ?? 0) : "—"],
    ["Statistical check", statisticalStatus],
    ["Statistical runtime", statistical?.runtime || "—"],
    ["Statistical duration", statistical ? `${statistical.durationMs} ms` : "—"],
  ];

  return (
    <div className="text-sm text-left">
      <table className="w-full text-left">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-border/70">
              <th className="py-2 pr-3 font-medium text-muted w-[40%]">{label}</th>
              <td className="py-2 text-fg break-words">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** @param {number} bytes */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
