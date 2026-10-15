import { describe, expect, it } from "vitest";
import { failedStatistical, interpretClassification } from "./interpret.js";

describe("interpretClassification", () => {
  it("flags possible AI when FAKE is top ≥ 0.5", () => {
    const r = interpretClassification(
      [
        { label: "FAKE", score: 0.72 },
        { label: "REAL", score: 0.28 },
      ],
      { runtime: "wasm", durationMs: 10 },
    );
    expect(r.status).toBe("success");
    expect(r.flagsPossibleAi).toBe(true);
    expect(r.topLabel).toBe("FAKE");
    expect(r.topScore).toBeCloseTo(0.72);
    expect(r.runtime).toBe("wasm");
  });

  it("does not flag AI when REAL is top", () => {
    const r = interpretClassification([
      { label: "REAL", score: 0.81 },
      { label: "FAKE", score: 0.19 },
    ]);
    expect(r.flagsPossibleAi).toBe(false);
    expect(r.topLabel).toBe("REAL");
  });

  it("handles empty output as success with no flag", () => {
    const r = interpretClassification([]);
    expect(r.flagsPossibleAi).toBe(false);
    expect(r.topLabel).toBeNull();
  });
});

describe("failedStatistical", () => {
  it("never invents a score", () => {
    const r = failedStatistical("oom", ["Out of memory"]);
    expect(r.topScore).toBeNull();
    expect(r.scores).toEqual([]);
    expect(r.flagsPossibleAi).toBe(false);
  });
});
