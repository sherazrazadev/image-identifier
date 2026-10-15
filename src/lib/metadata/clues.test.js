import { describe, expect, it } from "vitest";
import { classifyClue, isGpsField } from "./clues.js";

describe("classifyClue", () => {
  it("flags prompt-like keys as clues", () => {
    const r = classifyClue("parameters", "Steps: 20, Sampler: Euler");
    expect(r.isClue).toBe(true);
  });

  it("does not treat generic Software as a clue", () => {
    const r = classifyClue("Software", "Adobe Photoshop 24.0");
    expect(r.isClue).toBe(false);
  });

  it("flags generator software values as clues", () => {
    const r = classifyClue("Software", "ComfyUI");
    expect(r.isClue).toBe(true);
  });

  it("flags clue-like values on other keys", () => {
    const r = classifyClue("Comment", "Created with Stable Diffusion");
    expect(r.isClue).toBe(true);
  });
});

describe("isGpsField", () => {
  it("detects GPS keys", () => {
    expect(isGpsField("GPSLatitude")).toBe(true);
    expect(isGpsField("Make")).toBe(false);
  });
});
