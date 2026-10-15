/**
 * Shared worker message contract (ARCHITECTURE).
 * Used by the main thread and `analysis.worker.js`.
 */

/**
 * @typedef {'success' | 'not_found' | 'unsupported' | 'failed' | 'skipped' | 'cancelled' | 'running'} WorkerStatus
 */

/**
 * @typedef {'metadata' | 'credentials' | 'statistical' | 'session'} WorkerModule
 */

/**
 * @typedef {'metadata:extract' | 'statistical:infer' | 'cancel' | 'reset'} WorkerAction
 */

/**
 * @typedef {object} WorkerRequest
 * @property {string} jobId
 * @property {WorkerAction} action
 * @property {Record<string, unknown>} [payload]
 */

/**
 * @typedef {object} WorkerResponse
 * @property {string} jobId
 * @property {WorkerModule} module
 * @property {WorkerStatus} status
 * @property {number} durationMs
 * @property {unknown} [data]
 * @property {string[]} [warnings]
 * @property {string | null} [errorCode]
 * @property {string} [stage]
 */

/**
 * @param {string} jobId
 * @param {WorkerAction} action
 * @param {Record<string, unknown>} [payload]
 * @returns {WorkerRequest}
 */
export function createWorkerRequest(jobId, action, payload) {
  /** @type {WorkerRequest} */
  const req = { jobId, action };
  if (payload !== undefined) req.payload = payload;
  return req;
}

/**
 * @param {Partial<WorkerResponse> & Pick<WorkerResponse, 'jobId' | 'module' | 'status'>} fields
 * @returns {WorkerResponse}
 */
export function createWorkerResponse(fields) {
  /** @type {WorkerResponse} */
  const res = {
    jobId: fields.jobId,
    module: fields.module,
    status: fields.status,
    durationMs: fields.durationMs ?? 0,
    data: fields.data,
    warnings: fields.warnings ?? [],
    errorCode: fields.errorCode ?? null,
  };
  if (fields.stage) res.stage = fields.stage;
  return res;
}

/**
 * @param {string | null | undefined} activeJobId
 * @param {string | null | undefined} responseJobId
 * @returns {boolean}
 */
export function isStaleJob(activeJobId, responseJobId) {
  if (!activeJobId || !responseJobId) return true;
  return activeJobId !== responseJobId;
}

/**
 * @param {WorkerStatus} status
 * @returns {boolean}
 */
export function isTerminalStatus(status) {
  return (
    status === "success" ||
    status === "not_found" ||
    status === "unsupported" ||
    status === "failed" ||
    status === "skipped" ||
    status === "cancelled"
  );
}
