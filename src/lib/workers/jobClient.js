import { createJobId } from "../validation/imageFile.js";
import { createWorkerRequest, isStaleJob } from "./contract.js";

/** @type {Promise<typeof import("../c2pa/client.js")> | null} */
let c2paModulePromise = null;

/** Credentials SDK is loaded on first analysis, not on first paint. */
function loadC2paClient() {
  if (!c2paModulePromise) {
    c2paModulePromise = import("../c2pa/client.js");
  }
  return c2paModulePromise;
}

/**
 * Orchestrates off-main-thread metadata + main-thread credentials with shared jobId,
 * cancel, and stale-response protection.
 *
 * Credentials stay on the main thread: the SDK already uses its own worker/WASM runtime
 * and nesting it inside our analysis worker is unreliable. Metadata uses our worker.
 */
export class AnalysisJobClient {
  constructor() {
    /** @type {Worker | null} */
    this._worker = null;
    /** @type {string | null} */
    this._activeJobId = null;
    /** @type {Set<string>} */
    this._cancelled = new Set();
    /** @type {((msg: import('./contract.js').WorkerResponse) => void) | null} */
    this._onMessage = null;
  }

  /**
   * @param {(msg: import('./contract.js').WorkerResponse) => void} handler
   */
  setHandler(handler) {
    this._onMessage = handler;
  }

  /** @returns {Worker} */
  _ensureWorker() {
    if (this._worker) return this._worker;

    const worker = new Worker(new URL("./analysis.worker.js", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event) => {
      const msg = /** @type {import('./contract.js').WorkerResponse} */ (event.data);
      if (!msg || typeof msg !== "object") return;
      this._dispatch(msg);
    };

    worker.onerror = () => {
      const jobId = this._activeJobId;
      if (!jobId) return;
      this._dispatch({
        jobId,
        module: "metadata",
        status: "failed",
        durationMs: 0,
        warnings: ["Background worker error."],
        errorCode: "worker_error",
      });
    };

    this._worker = worker;
    return worker;
  }

  /**
   * @param {import('./contract.js').WorkerResponse} msg
   */
  _dispatch(msg) {
    if (msg.module === "session") {
      return;
    }

    if (isStaleJob(this._activeJobId, msg.jobId) || this._cancelled.has(msg.jobId)) {
      return;
    }

    this._onMessage?.(msg);
  }

  /**
   * Start analysis. Returns jobId synchronously so the UI can bind before work begins.
   * Silently cancels any previous in-flight job.
   * @param {File} file
   * @param {string} mimeType
   * @returns {string}
   */
  start(file, mimeType) {
    const previous = this._activeJobId;
    if (previous) {
      this._cancelled.add(previous);
      if (this._worker) {
        this._worker.postMessage(createWorkerRequest(previous, "cancel"));
      }
    }

    const jobId = createJobId();
    this._activeJobId = jobId;
    this._cancelled.delete(jobId);
    this._ensureWorker();
    void this._run(jobId, file, mimeType);
    return jobId;
  }

  /**
   * @param {string} jobId
   * @param {File} file
   * @param {string} mimeType
   */
  async _run(jobId, file, mimeType) {
    try {
      const metadataBuffer = await file.arrayBuffer();
      if (isStaleJob(this._activeJobId, jobId) || this._cancelled.has(jobId)) {
        return;
      }

      const worker = this._ensureWorker();
      worker.postMessage(
        createWorkerRequest(jobId, "metadata:extract", { buffer: metadataBuffer }),
        [metadataBuffer],
      );

      void this._runCredentials(jobId, file, mimeType);
    } catch {
      if (isStaleJob(this._activeJobId, jobId) || this._cancelled.has(jobId)) {
        return;
      }
      this._dispatch({
        jobId,
        module: "metadata",
        status: "failed",
        durationMs: 0,
        errorCode: "buffer_read_failed",
        warnings: ["Could not read the image for background analysis."],
      });
      this._dispatch({
        jobId,
        module: "credentials",
        status: "failed",
        durationMs: 0,
        errorCode: "buffer_read_failed",
        warnings: ["Could not read the image for credentials analysis."],
      });
    }
  }

  /**
   * @param {string} jobId
   * @param {File} file
   * @param {string} mimeType
   */
  async _runCredentials(jobId, file, mimeType) {
    this._dispatch({
      jobId,
      module: "credentials",
      status: "running",
      durationMs: 0,
    });

    const started = performance.now();
    try {
      if (this._cancelled.has(jobId) || isStaleJob(this._activeJobId, jobId)) {
        return;
      }

      const { readProvenance } = await loadC2paClient();
      if (this._cancelled.has(jobId) || isStaleJob(this._activeJobId, jobId)) {
        return;
      }

      const result = await readProvenance(file, mimeType);

      if (this._cancelled.has(jobId) || isStaleJob(this._activeJobId, jobId)) {
        return;
      }

      this._dispatch({
        jobId,
        module: "credentials",
        status:
          result.status === "success" || result.status === "not_found" || result.status === "failed"
            ? result.status
            : "failed",
        durationMs: result.durationMs ?? Math.round(performance.now() - started),
        data: result,
        warnings: result.warnings ?? [],
        errorCode: result.errorCode ?? null,
      });
    } catch {
      if (this._cancelled.has(jobId) || isStaleJob(this._activeJobId, jobId)) {
        return;
      }
      this._dispatch({
        jobId,
        module: "credentials",
        status: "failed",
        durationMs: Math.round(performance.now() - started),
        errorCode: "credentials_exception",
        warnings: ["Credentials check failed."],
      });
    }
  }

  /**
   * Cancel a job (defaults to active). Stale completions are ignored.
   * @param {string} [jobId]
   */
  cancel(jobId) {
    const id = jobId ?? this._activeJobId;
    if (!id) return;

    this._cancelled.add(id);
    if (this._activeJobId === id) {
      this._activeJobId = null;
    }

    if (this._worker) {
      this._worker.postMessage(createWorkerRequest(id, "cancel"));
    }
  }

  /** Invalidate active job without requiring a specific id. */
  invalidate() {
    if (this._activeJobId) {
      this.cancel(this._activeJobId);
    }
  }

  /** @returns {string | null} */
  get activeJobId() {
    return this._activeJobId;
  }

  dispose() {
    this.invalidate();
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    this._onMessage = null;
    this._cancelled.clear();
  }
}
