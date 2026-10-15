import { createJobId } from "../validation/imageFile.js";
import { createWorkerRequest, isStaleJob } from "../workers/contract.js";

/**
 * On-demand statistical worker client. Does not construct the worker until run().
 */
export class StatisticalJobClient {
  constructor() {
    /** @type {Worker | null} */
    this._worker = null;
    /** @type {string | null} */
    this._activeJobId = null;
    /** @type {Set<string>} */
    this._cancelled = new Set();
    /** @type {((msg: import('../workers/contract.js').WorkerResponse) => void) | null} */
    this._onMessage = null;
  }

  /**
   * @param {(msg: import('../workers/contract.js').WorkerResponse) => void} handler
   */
  setHandler(handler) {
    this._onMessage = handler;
  }

  _ensureWorker() {
    if (this._worker) return this._worker;

    const worker = new Worker(new URL("./ml.worker.js", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event) => {
      const msg = /** @type {import('../workers/contract.js').WorkerResponse} */ (event.data);
      if (!msg || typeof msg !== "object") return;
      if (msg.module === "session") return;
      if (isStaleJob(this._activeJobId, msg.jobId) || this._cancelled.has(msg.jobId)) return;
      this._onMessage?.(msg);
    };

    worker.onerror = () => {
      const jobId = this._activeJobId;
      if (!jobId) return;
      this._onMessage?.({
        jobId,
        module: "statistical",
        status: "failed",
        durationMs: 0,
        errorCode: "worker_error",
        warnings: ["Statistical worker failed to start."],
        data: null,
      });
    };

    this._worker = worker;
    return worker;
  }

  /**
   * @param {File} file
   * @param {string} mimeType
   * @param {string} [jobId]
   * @returns {Promise<string>}
   */
  async run(file, mimeType, jobId) {
    const previous = this._activeJobId;
    if (previous) {
      this._cancelled.add(previous);
      this._worker?.postMessage(createWorkerRequest(previous, "cancel"));
    }

    const id = jobId || createJobId();
    this._activeJobId = id;
    this._cancelled.delete(id);

    const worker = this._ensureWorker();
    const buffer = await file.arrayBuffer();

    if (isStaleJob(this._activeJobId, id) || this._cancelled.has(id)) {
      return id;
    }

    worker.postMessage(
      createWorkerRequest(id, "statistical:infer", {
        buffer,
        mimeType: mimeType || file.type || "image/jpeg",
      }),
      [buffer],
    );

    return id;
  }

  /**
   * @param {string} [jobId]
   */
  cancel(jobId) {
    const id = jobId ?? this._activeJobId;
    if (!id) return;
    this._cancelled.add(id);
    if (this._activeJobId === id) this._activeJobId = null;
    this._worker?.postMessage(createWorkerRequest(id, "cancel"));
  }

  dispose() {
    this.cancel();
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    this._onMessage = null;
    this._cancelled.clear();
  }
}
