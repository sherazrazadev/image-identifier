import { describe, expect, it } from "vitest";
import { failedResult, mapManifestStore, mapValidationState, notFoundResult } from "./mapStore.js";

describe("mapValidationState", () => {
  it("maps Trusted / Valid / Invalid distinctly", () => {
    expect(mapValidationState("Trusted")).toEqual({ signature: "valid", trust: "trusted" });
    expect(mapValidationState("Valid")).toEqual({ signature: "valid", trust: "unconfirmed" });
    expect(mapValidationState("Invalid")).toEqual({ signature: "invalid", trust: "unknown" });
    expect(mapValidationState(null)).toEqual({ signature: "unknown", trust: "unknown" });
  });
});

describe("mapManifestStore fixture matrix", () => {
  it("no manifest → not_found", () => {
    const r = mapManifestStore({ manifests: {}, active_manifest: null });
    expect(r.status).toBe("not_found");
    expect(r.manifest).toBe("not_found");
    expect(r.signature).toBe("not_applicable");
  });

  it("trusted store preserves trust + signer fields", () => {
    const r = mapManifestStore({
      active_manifest: "urn:manifest:1",
      validation_state: "Trusted",
      manifests: {
        "urn:manifest:1": {
          title: "photo.jpg",
          claim_generator: "TestCam/1.0",
          signature_info: {
            issuer: "Example CA",
            common_name: "Camera Signer",
            time: "2024-01-01T00:00:00Z",
          },
          assertions: [
            {
              label: "c2pa.actions",
              data: {
                actions: [{ action: "c2pa.created", softwareAgent: "TestCam", when: "2024-01-01T00:00:00Z" }],
              },
            },
          ],
          ingredients: [{ title: "raw.dng", format: "image/dng", relationship: "parentOf" }],
        },
      },
    });

    expect(r.status).toBe("success");
    expect(r.manifest).toBe("found");
    expect(r.signature).toBe("valid");
    expect(r.trust).toBe("trusted");
    expect(r.claimGenerator).toBe("TestCam/1.0");
    expect(r.signerIssuer).toBe("Example CA");
    expect(r.actions).toHaveLength(1);
    expect(r.ingredients[0].title).toBe("raw.dng");
  });

  it("Valid ≠ Trusted (signature ok, trust unconfirmed)", () => {
    const r = mapManifestStore({
      active_manifest: "m1",
      validation_state: "Valid",
      manifests: { m1: { title: "x.jpg" } },
    });
    expect(r.signature).toBe("valid");
    expect(r.trust).toBe("unconfirmed");
  });

  it("Invalid signature stays distinct from not_found", () => {
    const r = mapManifestStore({
      active_manifest: "m1",
      validation_state: "Invalid",
      validation_status: [{ code: "claim.signature.mismatch", explanation: "bad sig", success: false }],
      manifests: { m1: { title: "tampered.jpg" } },
    });
    expect(r.manifest).toBe("found");
    expect(r.signature).toBe("invalid");
    expect(r.validationMessages.some((m) => m.code.includes("signature"))).toBe(true);
  });

  it("malformed / empty store does not throw", () => {
    expect(() => mapManifestStore(null)).not.toThrow();
    expect(mapManifestStore(undefined).status).toBe("not_found");
    expect(notFoundResult().manifest).toBe("not_found");
    expect(failedResult().status).toBe("failed");
  });
});
