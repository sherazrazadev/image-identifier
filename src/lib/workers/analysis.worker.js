/// <reference lib="webworker" />
import { extractMetadata } from "../metadata/extract.js";
import { createWorkerResponse } from "./contract.js";

/** @type {Set<string>} */
const cancelledJobs = new Set();

/**
 * @param {MessageEvent} event
 */
self.onmessage = async (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;

  const { jobId, action, payload } = /** @type {import('./contract.js').WorkerRequest} */ (msg);
  if (!jobId || !action) return;

  if (action === "cancel") {
    cancelledJobs.add(jobId);
    self.postMessage(
      createWorkerResponse({
        jobId,
        module: "session",
        status: "cancelled",
        durationMs: 0,
        warnings: [],
      }),
    );
    return;
  }

  if (action === "reset") {
    cancelledJobs.clear();
    self.postMessage(
      createWorkerResponse({
        jobId,
        module: "session",
        status: "success",
        durationMs: 0,
      }),
    );
    return;
  }

  if (action === "metadata:extract") {
    if (cancelledJobs.has(jobId)) {
      self.postMessage(
        createWorkerResponse({
          jobId,
          module: "metadata",
          status: "cancelled",
          durationMs: 0,
        }),
      );
      return;
    }

    self.postMessage(
      createWorkerResponse({
        jobId,
        module: "metadata",
        status: "running",
        durationMs: 0,
      }),
    );

    const started = performance.now();
    try {
      const buffer = /** @type {ArrayBuffer | undefined} */ (payload?.buffer);
      if (!buffer || !(buffer instanceof ArrayBuffer)) {
        self.postMessage(
          createWorkerResponse({
            jobId,
            module: "metadata",
            status: "failed",
            durationMs: Math.round(performance.now() - started),
            errorCode: "missing_buffer",
            warnings: ["No image buffer was provided."],
          }),
        );
        return;
      }

      if (cancelledJobs.has(jobId)) {
        self.postMessage(
          createWorkerResponse({
            jobId,
            module: "metadata",
            status: "cancelled",
            durationMs: Math.round(performance.now() - started),
          }),
        );
        return;
      }

      const result = await extractMetadata(buffer);

      if (cancelledJobs.has(jobId)) {
        self.postMessage(
          createWorkerResponse({
            jobId,
            module: "metadata",
            status: "cancelled",
            durationMs: Math.round(performance.now() - started),
          }),
        );
        return;
      }

      self.postMessage(
        createWorkerResponse({
          jobId,
          module: "metadata",
          status: result.status === "success" || result.status === "not_found" || result.status === "failed"
            ? result.status
            : "failed",
          durationMs: result.durationMs ?? Math.round(performance.now() - started),
          data: result,
          warnings: result.warnings ?? [],
          errorCode: result.errorCode ?? null,
        }),
      );
    } catch {
      if (cancelledJobs.has(jobId)) {
        self.postMessage(
          createWorkerResponse({
            jobId,
            module: "metadata",
            status: "cancelled",
            durationMs: Math.round(performance.now() - started),
          }),
        );
        return;
      }
      self.postMessage(
        createWorkerResponse({
          jobId,
          module: "metadata",
          status: "failed",
          durationMs: Math.round(performance.now() - started),
          errorCode: "worker_exception",
          warnings: ["Details extraction failed in the background worker."],
        }),
      );
    } finally {
      cancelledJobs.delete(jobId);
    }
    return;
  }
};
