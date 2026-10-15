/// <reference lib="webworker" />
import { env, pipeline } from "@huggingface/transformers";
import { ML_MODEL_ID, ML_MODEL_TASK } from "./config.js";
import { failedStatistical, interpretClassification } from "./interpret.js";
import { createWorkerResponse } from "../workers/contract.js";

env.allowLocalModels = false;
env.useBrowserCache = true;

// Pages file limit is 25 MiB; ORT asyncify WASM is larger, so do not ship it
// in dist. Point at the matching onnxruntime-web release on jsDelivr.
const ortWebVersion = env.backends?.onnx?.versions?.web;
if (ortWebVersion && env.backends?.onnx?.wasm && !env.backends.onnx.wasm.wasmPaths) {
  const prefix = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ortWebVersion}/dist/`;
  env.backends.onnx.wasm.wasmPaths = {
    mjs: `${prefix}ort-wasm-simd-threaded.asyncify.mjs`,
    wasm: `${prefix}ort-wasm-simd-threaded.asyncify.wasm`,
  };
}

/** @type {Set<string>} */
const cancelledJobs = new Set();

/** @type {Awaited<ReturnType<typeof pipeline>> | null} */
let classifier = null;
/** @type {string} */
let loadedRuntime = "none";

/**
 * @param {MessageEvent} event
 */
self.onmessage = async (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;

  const { jobId, action, payload } = /** @type {import('../workers/contract.js').WorkerRequest} */ (
    msg
  );
  if (!jobId || !action) return;

  if (action === "cancel") {
    cancelledJobs.add(jobId);
    self.postMessage(
      createWorkerResponse({
        jobId,
        module: "session",
        status: "cancelled",
        durationMs: 0,
      }),
    );
    return;
  }

  if (action !== "statistical:infer") return;

  if (cancelledJobs.has(jobId)) {
    self.postMessage(
      createWorkerResponse({
        jobId,
        module: "statistical",
        status: "cancelled",
        durationMs: 0,
        data: failedStatistical("cancelled"),
      }),
    );
    return;
  }

  const started = performance.now();
  const buffer = /** @type {ArrayBuffer | undefined} */ (payload?.buffer);
  const mimeType = typeof payload?.mimeType === "string" ? payload.mimeType : "image/jpeg";

  if (!buffer) {
    self.postMessage(
      createWorkerResponse({
        jobId,
        module: "statistical",
        status: "failed",
        durationMs: 0,
        data: failedStatistical("missing_buffer", ["No image buffer was provided."]),
        errorCode: "missing_buffer",
      }),
    );
    return;
  }

  self.postMessage(
    createWorkerResponse({
      jobId,
      module: "statistical",
      status: "running",
      durationMs: 0,
      stage: "loading_model",
    }),
  );

  try {
    if (!classifier) {
      const preferWebGpu =
        typeof navigator !== "undefined" &&
        "gpu" in navigator &&
        /** @type {{ gpu?: unknown }} */ (navigator).gpu;

      let device = "wasm";
      if (preferWebGpu) {
        try {
          classifier = await pipeline(ML_MODEL_TASK, ML_MODEL_ID, { device: "webgpu" });
          device = "webgpu";
        } catch {
          classifier = null;
        }
      }

      if (!classifier) {
        classifier = await pipeline(ML_MODEL_TASK, ML_MODEL_ID, { device: "wasm" });
        device = "wasm";
      }
      loadedRuntime = device;
    }

    if (cancelledJobs.has(jobId)) {
      self.postMessage(
        createWorkerResponse({
          jobId,
          module: "statistical",
          status: "cancelled",
          durationMs: Math.round(performance.now() - started),
          data: failedStatistical("cancelled", [], Math.round(performance.now() - started)),
        }),
      );
      return;
    }

    self.postMessage(
      createWorkerResponse({
        jobId,
        module: "statistical",
        status: "running",
        durationMs: Math.round(performance.now() - started),
        stage: "running_inference",
      }),
    );

    const blob = new Blob([buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    let raw;
    try {
      raw = await /** @type {(input: string) => Promise<unknown>} */ (classifier)(url);
    } finally {
      URL.revokeObjectURL(url);
    }

    if (cancelledJobs.has(jobId)) {
      self.postMessage(
        createWorkerResponse({
          jobId,
          module: "statistical",
          status: "cancelled",
          durationMs: Math.round(performance.now() - started),
          data: failedStatistical("cancelled", [], Math.round(performance.now() - started)),
        }),
      );
      return;
    }

    const result = interpretClassification(raw, {
      runtime: loadedRuntime,
      durationMs: Math.round(performance.now() - started),
    });

    self.postMessage(
      createWorkerResponse({
        jobId,
        module: "statistical",
        status: "success",
        durationMs: result.durationMs,
        data: result,
        warnings: result.warnings,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();
    let errorCode = "infer_failed";
    if (lower.includes("memory") || lower.includes("oom")) errorCode = "oom";
    else if (lower.includes("network") || lower.includes("fetch") || lower.includes("download"))
      errorCode = "download_failed";
    else if (lower.includes("webgpu")) errorCode = "webgpu_failed";

    if (cancelledJobs.has(jobId)) {
      self.postMessage(
        createWorkerResponse({
          jobId,
          module: "statistical",
          status: "cancelled",
          durationMs: Math.round(performance.now() - started),
          data: failedStatistical("cancelled"),
        }),
      );
      return;
    }

    // Allow a retry to re-init after a bad partial load.
    classifier = null;
    loadedRuntime = "none";

    self.postMessage(
      createWorkerResponse({
        jobId,
        module: "statistical",
        status: "failed",
        durationMs: Math.round(performance.now() - started),
        data: failedStatistical(errorCode, [
          "Statistical check could not finish on this device.",
          message.slice(0, 180),
        ], Math.round(performance.now() - started)),
        errorCode,
        warnings: ["Other results are still available."],
      }),
    );
  } finally {
    cancelledJobs.delete(jobId);
  }
};
