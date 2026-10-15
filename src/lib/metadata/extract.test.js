import { describe, expect, it } from "vitest";
import { formatTagValue, groupFields, mapTagsToFields } from "./extract.js";

describe("formatTagValue", () => {
  it("uses description when present", () => {
    expect(formatTagValue({ description: "Canon", value: [1, 2] })).toBe("Canon");
  });

  it("joins arrays", () => {
    expect(formatTagValue(["a", "b"])).toBe("a, b");
  });
});

describe("mapTagsToFields", () => {
  it("maps camera and software tags", () => {
    const fields = mapTagsToFields({
      Make: { description: "Canon" },
      Model: { description: "EOS R5" },
      Software: { description: "Adobe Lightroom" },
      Thumbnail: { description: "skip-me" },
    });

    expect(fields.find((f) => f.key === "Thumbnail")).toBeUndefined();
    expect(fields.find((f) => f.key === "Make")?.value).toBe("Canon");
    expect(fields.find((f) => f.key === "Software")?.isClue).toBe(false);
  });

  it("labels generation parameters as clues", () => {
    const fields = mapTagsToFields({
      parameters: { description: "masterpiece, best quality\nNegative prompt: lowres" },
      Seed: { description: "12345" },
    });

    expect(fields.every((f) => f.isClue)).toBe(true);
    expect(fields.find((f) => f.key === "Seed")?.category).toBe("generation_clues");
  });

  it("marks GPS fields", () => {
    const fields = mapTagsToFields({
      GPSLatitude: { description: "40 deg 0' 0\" N" },
    });
    expect(fields[0].isGps).toBe(true);
    expect(fields[0].category).toBe("location");
  });

  it("returns empty for missing tags", () => {
    expect(mapTagsToFields(null)).toEqual([]);
  });
});

describe("groupFields", () => {
  it("groups by category order", () => {
    const groups = groupFields([
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
    ]);

    expect(groups.map((g) => g.id)).toEqual(["camera", "generation_clues"]);
  });
});
