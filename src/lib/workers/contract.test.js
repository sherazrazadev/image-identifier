import { describe, expect, it } from "vitest";
import {
  createWorkerRequest,
  createWorkerResponse,
  isStaleJob,
  isTerminalStatus,
} from "./contract.js";

describe("worker contract", () => {
  it("builds request/response shapes", () => {
    const req = createWorkerRequest("job-1", "metadata:extract", { buffer: null });
    expect(req).toEqual({
      jobId: "job-1",
      action: "metadata:extract",
      payload: { buffer: null },
    });

    const res = createWorkerResponse({
      jobId: "job-1",
      module: "metadata",
      status: "success",
      durationMs: 12,
      data: { ok: true },
    });
    expect(res.warnings).toEqual([]);
    expect(res.errorCode).toBeNull();
    expect(res.data).toEqual({ ok: true });
  });

  it("detects stale jobIds", () => {
    expect(isStaleJob("a", "a")).toBe(false);
    expect(isStaleJob("a", "b")).toBe(true);
    expect(isStaleJob(null, "a")).toBe(true);
    expect(isStaleJob("a", null)).toBe(true);
  });

  it("classifies terminal statuses", () => {
    expect(isTerminalStatus("running")).toBe(false);
    expect(isTerminalStatus("success")).toBe(true);
    expect(isTerminalStatus("cancelled")).toBe(true);
    expect(isTerminalStatus("not_found")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
  });
});

describe("stale + cancel acceptance rules", () => {
  it("ignores responses when active job changed", () => {
    let active = "job-old";
    const accept = (jobId) => !isStaleJob(active, jobId);

    expect(accept("job-old")).toBe(true);
    active = "job-new";
    expect(accept("job-old")).toBe(false);
    expect(accept("job-new")).toBe(true);
  });

  it("treats cancelled jobs as non-applicable for UI apply", () => {
    const cancelled = new Set(["job-x"]);
    const shouldApply = (active, jobId) =>
      !isStaleJob(active, jobId) && !cancelled.has(jobId);

    expect(shouldApply("job-x", "job-x")).toBe(false);
    expect(shouldApply("job-y", "job-y")).toBe(true);
  });
});
