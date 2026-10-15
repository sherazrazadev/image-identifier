/** Category ids used in the metadata UI. */

export const CATEGORY_ORDER = [
  "camera",
  "capture",
  "software",
  "generation_clues",
  "image",
  "location",
  "other",
];

export const CATEGORY_LABELS = {
  camera: "Camera",
  capture: "Capture",
  software: "Software & editing",
  generation_clues: "Possible generation clues",
  image: "Image",
  location: "Location",
  other: "Other",
};

/**
 * @param {string} key
 * @param {boolean} isClue
 * @returns {string}
 */
export function categorizeKey(key, isClue) {
  if (isClue) return "generation_clues";

  const k = String(key || "");

  if (/^(GPS|gps)/.test(k) || /latitude|longitude|altitude/i.test(k)) {
    return "location";
  }

  if (
    /Make|Model|Lens|Focal|FNumber|Aperture|ISO|Exposure|Shutter|Metering|WhiteBalance|Flash/i.test(
      k,
    ) &&
    !/Software/i.test(k)
  ) {
    if (/Make|Model|Lens/i.test(k)) return "camera";
    return "capture";
  }

  if (/Software|Artist|Copyright|Creator|History|Processing|XMP/i.test(k)) {
    return "software";
  }

  if (
    /ImageWidth|ImageHeight|Orientation|ColorSpace|BitsPerSample|Compression|Resolution|Pixel/i.test(
      k,
    )
  ) {
    return "image";
  }

  if (/Date|Time|Create|Modify/i.test(k)) {
    return "capture";
  }

  return "other";
}
