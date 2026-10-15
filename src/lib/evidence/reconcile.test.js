import { describe, expect, it } from "vitest";
import { reconcileEvidence } from "./reconcile.js";

function baseProv(overrides = {}) {
  return {
    status: "success",
    manifest: "found",
    signature: "valid",
    trust: "trusted",
    validationState: "Trusted",
    claimGenerator: null,
    title: null,
    signerIssuer: null,
    signerCommonName: null,
    signedAt: null,
    actions: [],
    ingredients: [],
    validationMessages: [],
    warnings: [],
    errorCode: null,
    durationMs: 1,
    ...overrides,
  };
}

function baseMeta(overrides = {}) {
  return {
    status: "success",
    fields: [],
    groups: [],
    clueCount: 0,
    hasGps: false,
    warnings: [],
    errorCode: null,
    durationMs: 1,
    ...overrides,
  };
}

describe("reconcileEvidence", () => {
  it("never treats missing credentials as authenticity", () => {
    const r = reconcileEvidence({
      provenance: { ...baseProv({ status: "not_found", manifest: "not_found" }), signature: "not_applicable", trust: "not_applicable" },
      provenanceStatus: "not_found",
      metadata: baseMeta(),
      metadataStatus: "not_found",
      statistical: { status: "skipped" },
    });
    expect(r.primaryLabel).toBe("No decisive provenance evidence");
    expect(r.warnings.some((w) => /do not prove authenticity/i.test(w))).toBe(true);
  });

  it("labels AI-generation metadata as a clue label", () => {
    const r = reconcileEvidence({
      provenanceStatus: "not_found",
      provenance: null,
      metadataStatus: "success",
      metadata: baseMeta({
        clueCount: 2,
        fields: [
          {
            key: "parameters",
            label: "parameters",
            value: "prompt",
            category: "generation_clues",
            isClue: true,
            clueNote: "clue",
            isGps: false,
            technical: false,
          },
        ],
      }),
      statistical: { status: "skipped" },
    });
    expect(r.labels).toContain("AI-generation metadata detected");
  });

  it("preserves conflicting camera metadata + AI clues", () => {
    const r = reconcileEvidence({
      provenanceStatus: "not_found",
      metadataStatus: "success",
      metadata: baseMeta({
        clueCount: 1,
        fields: [
          {
            key: "Make",
            label: "Make",
            value: "Canon",
            category: "camera",
            isClue: false,
            clueNote: null,
            isGps: false,
            technical: false,
          },
          {
            key: "parameters",
            label: "parameters",
            value: "x",
            category: "generation_clues",
            isClue: true,
            clueNote: "clue",
            isGps: false,
            technical: false,
          },
        ],
      }),
      statistical: { status: "skipped" },
    });
    expect(r.hasConflict).toBe(true);
    expect(r.primaryLabel).toBe("Conflicting evidence");
    expect(r.labels).toContain("AI-generation metadata detected");
  });

  it("does not invent a statistical score when skipped", () => {
    const r = reconcileEvidence({
      provenanceStatus: "success",
      provenance: baseProv(),
      metadataStatus: "success",
      metadata: baseMeta(),
      statistical: { status: "skipped", flagsPossibleAi: true, score: 0.99 },
    });
    expect(r.labels).toContain("Statistical analysis unavailable");
    expect(r.labels).not.toContain("Statistical detector flags possible AI generation");
    expect(r.modules.find((m) => m.id === "statistical")?.status).toBe("skipped");
  });

  it("keeps other results when one module fails", () => {
    const r = reconcileEvidence({
      provenanceStatus: "failed",
      provenance: null,
      metadataStatus: "success",
      metadata: baseMeta({
        clueCount: 1,
        fields: [
          {
            key: "Seed",
            label: "Seed",
            value: "1",
            category: "generation_clues",
            isClue: true,
            clueNote: "clue",
            isGps: false,
            technical: false,
          },
        ],
      }),
      statistical: { status: "skipped" },
    });
    expect(r.labels).toContain("Analysis incomplete");
    expect(r.labels).toContain("AI-generation metadata detected");
    expect(r.modules.find((m) => m.id === "credentials")?.status).toBe("failed");
    expect(r.modules.find((m) => m.id === "details")?.status).toBe("success");
  });

  it("warns that invalid signature ≠ AI proof", () => {
    const r = reconcileEvidence({
      provenanceStatus: "success",
      provenance: baseProv({ signature: "invalid", trust: "unknown", validationState: "Invalid" }),
      metadataStatus: "not_found",
      metadata: baseMeta({ status: "not_found" }),
      statistical: { status: "skipped" },
    });
    expect(r.warnings.some((w) => /invalid signature/i.test(w))).toBe(true);
  });
});
