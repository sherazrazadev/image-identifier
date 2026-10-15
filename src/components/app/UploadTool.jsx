import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { AlertCircle, ImagePlus } from "lucide-react";
import {
  ACCEPT_DROPZONE,
  FORMAT_LABEL,
  MAX_FILE_MB,
} from "../../lib/validation/limits.js";
import {
  createJobId,
  revokeObjectUrl,
  validateImageFile,
} from "../../lib/validation/imageFile.js";
import { AnalysisJobClient } from "../../lib/workers/jobClient.js";
import { StatisticalJobClient } from "../../lib/ml/mlClient.js";
import { isStaleJob, isTerminalStatus } from "../../lib/workers/contract.js";
import ResultsDashboard from "./ResultsDashboard.jsx";

/** @typedef {'idle' | 'validating' | 'analyzing' | 'ready' | 'error'} ToolPhase */
/** @typedef {'idle' | 'running' | 'success' | 'not_found' | 'failed' | 'skipped'} ModuleStatus */

/**
 * @typedef {object} SelectionState
 * @property {string} jobId
 * @property {string} fileName
 * @property {string} objectUrl
 * @property {number | null} width
 * @property {number | null} height
 * @property {string | null} mimeType
 * @property {number} sizeBytes
 */

const PRIVACY_LINE =
  "Analyzes locally in your browser — selected image bytes are not uploaded to an application backend. The site may still load assets over the network. See Privacy.";

export default function UploadTool() {
  const inputId = useId();
  const errorId = useId();
  const objectUrlRef = useRef(/** @type {string | null} */ (null));
  const jobIdRef = useRef(/** @type {string | null} */ (null));
  const validationTokenRef = useRef(/** @type {string | null} */ (null));
  const clientRef = useRef(/** @type {AnalysisJobClient | null} */ (null));
  const mlClientRef = useRef(/** @type {StatisticalJobClient | null} */ (null));
  const sourceFileRef = useRef(/** @type {File | null} */ (null));
  const modulesDoneRef = useRef(/** @type {Set<string>} */ (new Set()));

  const [phase, setPhase] = useState(/** @type {ToolPhase} */ ("idle"));
  const [errorMessage, setErrorMessage] = useState(/** @type {string | null} */ (null));
  const [selection, setSelection] = useState(/** @type {SelectionState | null} */ (null));
  const [detailsStatus, setDetailsStatus] = useState(/** @type {ModuleStatus} */ ("idle"));
  const [detailsResult, setDetailsResult] = useState(
    /** @type {import('../../lib/metadata/extract.js').MetadataResult | null} */ (null),
  );
  const [provenanceStatus, setProvenanceStatus] = useState(/** @type {ModuleStatus} */ ("idle"));
  const [provenanceResult, setProvenanceResult] = useState(
    /** @type {import('../../lib/c2pa/mapStore.js').ProvenanceResult | null} */ (null),
  );
  const [statisticalStatus, setStatisticalStatus] = useState(/** @type {ModuleStatus} */ ("skipped"));
  const [statisticalResult, setStatisticalResult] = useState(
    /** @type {import('../../lib/ml/interpret.js').StatisticalResult | null} */ (null),
  );
  const [statisticalStage, setStatisticalStage] = useState(/** @type {string | null} */ (null));

  const clearObjectUrl = useCallback(() => {
    revokeObjectUrl(objectUrlRef.current);
    objectUrlRef.current = null;
  }, []);

  const resetResults = useCallback(() => {
    setDetailsStatus("idle");
    setDetailsResult(null);
    setProvenanceStatus("idle");
    setProvenanceResult(null);
    setStatisticalStatus("skipped");
    setStatisticalResult(null);
    setStatisticalStage(null);
    modulesDoneRef.current = new Set();
  }, []);

  const resetAll = useCallback(() => {
    clientRef.current?.invalidate();
    mlClientRef.current?.cancel();
    sourceFileRef.current = null;
    jobIdRef.current = null;
    validationTokenRef.current = null;
    clearObjectUrl();
    setSelection(null);
    setErrorMessage(null);
    resetResults();
    setPhase("idle");
  }, [clearObjectUrl, resetResults]);

  const cancelJob = useCallback(() => {
    clientRef.current?.cancel(jobIdRef.current ?? undefined);
    mlClientRef.current?.cancel();
    sourceFileRef.current = null;
    jobIdRef.current = null;
    validationTokenRef.current = null;
    resetResults();
    clearObjectUrl();
    setSelection(null);
    setErrorMessage(null);
    setPhase("idle");
  }, [clearObjectUrl, resetResults]);

  const runStatistical = useCallback(() => {
    const file = sourceFileRef.current;
    const jobId = jobIdRef.current;
    const mime = selection?.mimeType;
    if (!file || !jobId || !mime || !mlClientRef.current) return;
    setStatisticalStatus("running");
    setStatisticalStage("loading_model");
    setStatisticalResult(null);
    void mlClientRef.current.run(file, mime, `${jobId}:stat`);
  }, [selection?.mimeType]);

  const cancelStatistical = useCallback(() => {
    mlClientRef.current?.cancel();
    setStatisticalStatus("skipped");
    setStatisticalStage(null);
    setStatisticalResult(null);
  }, []);

  useEffect(() => {
    const client = new AnalysisJobClient();
    clientRef.current = client;
    const mlClient = new StatisticalJobClient();
    mlClientRef.current = mlClient;

    mlClient.setHandler((msg) => {
      if (!jobIdRef.current) return;
      // Statistical jobs use `${analysisJobId}:stat`
      if (!String(msg.jobId).startsWith(jobIdRef.current)) return;

      if (msg.status === "running") {
        setStatisticalStatus("running");
        setStatisticalStage(msg.stage || null);
        return;
      }
      if (msg.status === "cancelled") {
        setStatisticalStatus("skipped");
        setStatisticalStage(null);
        return;
      }
      if (msg.status === "success") {
        setStatisticalResult(/** @type {any} */ (msg.data) ?? null);
        setStatisticalStatus("success");
        setStatisticalStage(null);
        return;
      }
      if (msg.status === "failed") {
        setStatisticalResult(/** @type {any} */ (msg.data) ?? null);
        setStatisticalStatus("failed");
        setStatisticalStage(null);
      }
    });

    client.setHandler((msg) => {
      if (isStaleJob(jobIdRef.current, msg.jobId)) return;

      if (msg.module === "metadata") {
        if (msg.status === "running") {
          setDetailsStatus("running");
          return;
        }
        if (msg.status === "cancelled") return;
        if (msg.status === "success" || msg.status === "not_found") {
          setDetailsResult(/** @type {any} */ (msg.data) ?? null);
          setDetailsStatus(msg.status);
        } else if (msg.status === "failed") {
          setDetailsResult(null);
          setDetailsStatus("failed");
        }
        if (isTerminalStatus(msg.status)) {
          modulesDoneRef.current.add("metadata");
        }
      }

      if (msg.module === "credentials") {
        if (msg.status === "running") {
          setProvenanceStatus("running");
          return;
        }
        if (msg.status === "cancelled") return;
        if (msg.status === "success" || msg.status === "not_found") {
          setProvenanceResult(/** @type {any} */ (msg.data) ?? null);
          setProvenanceStatus(msg.status);
        } else if (msg.status === "failed") {
          setProvenanceResult(null);
          setProvenanceStatus("failed");
        }
        if (isTerminalStatus(msg.status)) {
          modulesDoneRef.current.add("credentials");
        }
      }

      if (
        modulesDoneRef.current.has("metadata") &&
        modulesDoneRef.current.has("credentials") &&
        jobIdRef.current === msg.jobId
      ) {
        setPhase("ready");
      }
    });

    return () => {
      client.dispose();
      mlClient.dispose();
      clientRef.current = null;
      mlClientRef.current = null;
      sourceFileRef.current = null;
      revokeObjectUrl(objectUrlRef.current);
      objectUrlRef.current = null;
    };
  }, []);

  const runPipeline = useCallback(
    async (file) => {
      clientRef.current?.invalidate();
      mlClientRef.current?.cancel();
      sourceFileRef.current = null;
      jobIdRef.current = null;

      const validationToken = createJobId();
      validationTokenRef.current = validationToken;

      clearObjectUrl();
      resetResults();

      const previewUrl = URL.createObjectURL(file);
      objectUrlRef.current = previewUrl;

      setErrorMessage(null);
      setSelection({
        jobId: validationToken,
        fileName: file.name || "image",
        objectUrl: previewUrl,
        width: null,
        height: null,
        mimeType: null,
        sizeBytes: file.size,
      });
      setPhase("validating");

      const validated = await validateImageFile(file);

      if (validationTokenRef.current !== validationToken) {
        if (validated.ok) revokeObjectUrl(validated.data.objectUrl);
        return;
      }

      if (!validated.ok) {
        clearObjectUrl();
        sourceFileRef.current = null;
        setSelection(null);
        setErrorMessage(validated.error.message);
        setPhase("error");
        return;
      }

      revokeObjectUrl(objectUrlRef.current);
      objectUrlRef.current = validated.data.objectUrl;
      sourceFileRef.current = validated.data.file;

      const client = clientRef.current;
      if (!client) {
        setSelection({
          jobId: validationToken,
          fileName: validated.data.file.name || "image",
          objectUrl: validated.data.objectUrl,
          width: validated.data.width,
          height: validated.data.height,
          mimeType: validated.data.mimeType,
          sizeBytes: validated.data.file.size,
        });
        setDetailsStatus("failed");
        setProvenanceStatus("failed");
        setPhase("ready");
        return;
      }

      const analysisJobId = client.start(validated.data.file, validated.data.mimeType);
      jobIdRef.current = analysisJobId;

      setSelection({
        jobId: analysisJobId,
        fileName: validated.data.file.name || "image",
        objectUrl: validated.data.objectUrl,
        width: validated.data.width,
        height: validated.data.height,
        mimeType: validated.data.mimeType,
        sizeBytes: validated.data.file.size,
      });
      setPhase("analyzing");
      setDetailsStatus("running");
      setProvenanceStatus("running");
      setStatisticalStatus("skipped");
    },
    [clearObjectUrl, resetResults],
  );

  const onDrop = useCallback(
    (acceptedFiles, fileRejections) => {
      if (fileRejections?.length) {
        clientRef.current?.invalidate();
        mlClientRef.current?.cancel();
        sourceFileRef.current = null;
        jobIdRef.current = null;
        validationTokenRef.current = null;
        clearObjectUrl();
        setSelection(null);
        resetResults();
        const code = fileRejections[0]?.errors?.[0]?.code;
        if (code === "file-too-large") {
          setErrorMessage(`File is larger than ${MAX_FILE_MB} MB. Choose a smaller image.`);
        } else if (code === "file-invalid-type") {
          setErrorMessage("Unsupported file type. Use JPEG or PNG.");
        } else {
          setErrorMessage("Could not accept that file. Use JPEG or PNG under 15 MB.");
        }
        setPhase("error");
        return;
      }

      const next = acceptedFiles?.[0];
      if (next) void runPipeline(next);
    },
    [clearObjectUrl, resetResults, runPipeline],
  );

  const busy = phase === "validating" || phase === "analyzing";

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPT_DROPZONE,
    maxSize: MAX_FILE_MB * 1024 * 1024,
    multiple: false,
    disabled: busy,
  });

  const showDropzone = phase === "idle" || phase === "error";
  const showDashboard =
    (phase === "analyzing" || phase === "ready") && selection != null;

  return (
    <div className="w-full max-w-[min(var(--max-tool),40rem)] mx-auto sm:max-w-3xl">
      {showDropzone && (
        <div
          {...getRootProps({
            className: [
              "relative rounded-[var(--radius)] border-2 border-dashed border-border bg-bg-elevated/80",
              "px-4 py-10 sm:px-8 sm:py-12 text-center transition-colors",
              "min-h-[12.5rem] flex flex-col items-center justify-center gap-4",
              "cursor-pointer touch-manipulation no-print",
              isDragActive ? "dropzone-drag" : "hover:border-accent/50",
            ]
              .filter(Boolean)
              .join(" "),
            "aria-label": `Select an image file. Supported formats: ${FORMAT_LABEL}. Maximum size ${MAX_FILE_MB} megabytes.`,
            "aria-describedby": errorMessage ? errorId : undefined,
            "aria-invalid": errorMessage ? true : undefined,
          })}
        >
          <input {...getInputProps({ id: inputId })} />

          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent pointer-events-none"
            aria-hidden="true"
          >
            <ImagePlus className="h-7 w-7" strokeWidth={1.75} />
          </div>

          <div className="space-y-1 pointer-events-none">
            <p className="font-display text-lg font-semibold text-fg m-0">
              {isDragActive ? "Drop image to inspect" : "Drop an image here"}
            </p>
            <p className="text-sm text-muted m-0">
              or <span className="font-semibold text-accent underline-offset-2">browse files</span>
            </p>
          </div>

          <p className="text-xs text-muted m-0 pointer-events-none">
            Supported: {FORMAT_LABEL} · Max {MAX_FILE_MB} MB
          </p>
        </div>
      )}

      {errorMessage && (
        <div
          id={errorId}
          role="alert"
          className="mt-3 flex gap-2 rounded-[var(--radius)] border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-fg stage-enter no-print"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-left">
            <p className="m-0">{errorMessage}</p>
            {phase === "error" && (
              <button
                type="button"
                onClick={() => open()}
                className="mt-2 min-h-11 inline-flex items-center rounded-xl border border-border bg-bg px-3 py-2 text-sm font-semibold text-fg hover:border-accent/50 cursor-pointer"
              >
                Try another file
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "validating" && selection && (
        <div
          className="mt-3 flex items-center gap-2 rounded-[var(--radius)] border border-border bg-bg-elevated/80 px-4 py-3 text-sm text-muted stage-enter no-print"
          aria-live="polite"
        >
          Checking your image…
        </div>
      )}

      {showDashboard && (
        <ResultsDashboard
          selection={selection}
          phase={phase === "analyzing" ? "analyzing" : "ready"}
          provenanceResult={provenanceResult}
          provenanceStatus={provenanceStatus}
          detailsResult={detailsResult}
          detailsStatus={detailsStatus}
          statisticalResult={statisticalResult}
          statisticalStatus={statisticalStatus}
          statisticalStage={statisticalStage}
          onRunStatistical={phase === "ready" ? runStatistical : undefined}
          onCancelStatistical={cancelStatistical}
          onAnalyzeAnother={resetAll}
          onClear={resetAll}
          onCancel={cancelJob}
        />
      )}

      <p className="mt-4 text-center text-xs text-muted leading-relaxed m-0 px-1 no-print">
        {PRIVACY_LINE}{" "}
        <a href="/privacy/" className="text-accent">
          Privacy
        </a>
        .
      </p>
    </div>
  );
}
