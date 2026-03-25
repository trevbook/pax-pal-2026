import { describe, expect, test } from "bun:test";
import { countBoothLike, mergeBoothAnnotations } from "./merge";
import type { OcrAnnotation } from "./types";

describe("mergeBoothAnnotations", () => {
  test("merges adjacent digit chunks into a single booth ID", () => {
    const annotations: OcrAnnotation[] = [
      { text: "15", bbox: [100, 200, 120, 220] },
      { text: "043", bbox: [125, 200, 160, 220] }, // 5px gap → merge
    ];

    const result = mergeBoothAnnotations(annotations);
    expect(result["15043"]).toEqual([100, 200, 160, 220]);
    expect(Object.keys(result)).toHaveLength(1);
  });

  test("keeps separate booths when gap exceeds threshold", () => {
    const annotations: OcrAnnotation[] = [
      { text: "10018", bbox: [100, 200, 150, 220] },
      { text: "10050", bbox: [200, 200, 250, 220] }, // 50px gap → separate
    ];

    const result = mergeBoothAnnotations(annotations);
    expect(result["10018"]).toBeDefined();
    expect(result["10050"]).toBeDefined();
    expect(Object.keys(result)).toHaveLength(2);
  });

  test("handles TT-prefixed booth IDs", () => {
    const annotations: OcrAnnotation[] = [{ text: "TT29A", bbox: [300, 400, 370, 420] }];

    const result = mergeBoothAnnotations(annotations);
    expect(result.TT29A).toEqual([300, 400, 370, 420]);
  });

  test("handles NL-prefixed booth IDs", () => {
    const annotations: OcrAnnotation[] = [{ text: "NL2", bbox: [500, 600, 530, 620] }];

    const result = mergeBoothAnnotations(annotations);
    expect(result.NL2).toEqual([500, 600, 530, 620]);
  });

  test("filters out non-booth text", () => {
    const annotations: OcrAnnotation[] = [
      { text: "EXPO", bbox: [0, 0, 100, 30] },
      { text: "HALL", bbox: [110, 0, 200, 30] },
      { text: "16021", bbox: [300, 200, 360, 220] },
      { text: "ENTRANCE", bbox: [400, 500, 520, 530] },
    ];

    const result = mergeBoothAnnotations(annotations);
    expect(Object.keys(result)).toEqual(["16021"]);
  });

  test("handles annotations on different scan lines", () => {
    const annotations: OcrAnnotation[] = [
      { text: "10018", bbox: [100, 200, 150, 220] },
      { text: "20030", bbox: [100, 400, 150, 420] }, // different y → different line
    ];

    const result = mergeBoothAnnotations(annotations);
    expect(result["10018"]).toBeDefined();
    expect(result["20030"]).toBeDefined();
  });

  test("splits over-merged numeric entries back into 5-digit IDs", () => {
    // Simulate two adjacent 5-digit booth labels that OCR merged
    const annotations: OcrAnnotation[] = [
      { text: "16086", bbox: [100, 200, 160, 220] },
      { text: "15087", bbox: [165, 200, 220, 220] }, // 5px gap → merge into "1608615087"
    ];

    const result = mergeBoothAnnotations(annotations);
    // Should be split back into two 5-digit IDs
    expect(result["16086"]).toBeDefined();
    expect(result["15087"]).toBeDefined();
    expect(Object.keys(result)).toHaveLength(2);
  });

  test("splits triple-merged numeric entries", () => {
    const annotations: OcrAnnotation[] = [
      { text: "16086", bbox: [100, 200, 160, 220] },
      { text: "15087", bbox: [165, 200, 220, 220] }, // 5px gap
      { text: "15086", bbox: [225, 200, 280, 220] }, // 5px gap
    ];

    const result = mergeBoothAnnotations(annotations);
    expect(result["16086"]).toBeDefined();
    expect(result["15087"]).toBeDefined();
    expect(result["15086"]).toBeDefined();
    expect(Object.keys(result)).toHaveLength(3);
  });

  test("returns empty map for no booth-like annotations", () => {
    const annotations: OcrAnnotation[] = [
      { text: "EXPO", bbox: [0, 0, 100, 30] },
      { text: "HALL", bbox: [110, 0, 200, 30] },
    ];

    const result = mergeBoothAnnotations(annotations);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe("countBoothLike", () => {
  test("counts only booth-like annotations", () => {
    const annotations: OcrAnnotation[] = [
      { text: "EXPO", bbox: [0, 0, 100, 30] },
      { text: "16021", bbox: [100, 200, 160, 220] },
      { text: "TT29A", bbox: [300, 400, 370, 420] },
      { text: "NL2", bbox: [500, 600, 530, 620] },
      { text: "ENTRANCE", bbox: [400, 500, 520, 530] },
    ];

    expect(countBoothLike(annotations)).toBe(3);
  });
});
