import { describe, expect, test } from "bun:test";
import type { BoothMap } from "./types";
import { validateBooths } from "./validate";

describe("validateBooths", () => {
  test("matches booth IDs present in both OCR and game data", () => {
    const ocrBooths: BoothMap = {
      "10018": [100, 200, 150, 220],
      "16021": [300, 400, 360, 420],
      "99999": [500, 600, 550, 620],
    };
    const gameBoothIds = ["10018", "16021", "10050"];

    const result = validateBooths(ocrBooths, gameBoothIds);
    expect(result.matched).toEqual(["10018", "16021"]);
    expect(result.missingFromMap).toEqual(["10050"]);
    expect(result.extraInMap).toEqual(["99999"]);
  });

  test("handles multi-booth strings from game data", () => {
    const ocrBooths: BoothMap = {
      "18019": [100, 200, 150, 220],
      "18031": [300, 400, 360, 420],
      NL2: [500, 600, 530, 620],
    };
    const gameBoothIds = ["18019, 18031, NL2"];

    const result = validateBooths(ocrBooths, gameBoothIds);
    expect(result.matched).toEqual(["18019", "18031", "NL2"]);
    expect(result.missingFromMap).toHaveLength(0);
  });

  test("skips TT-prefixed, Tabletop Hall, and UNSPECIFIED", () => {
    const ocrBooths: BoothMap = { "10018": [100, 200, 150, 220] };
    const gameBoothIds = ["10018", "TT29A", "Tabletop Hall", "UNSPECIFIED"];

    const result = validateBooths(ocrBooths, gameBoothIds);
    expect(result.matched).toEqual(["10018"]);
    expect(result.missingFromMap).toHaveLength(0);
  });

  test("handles mixed multi-booth with TT (only validates expo portion)", () => {
    const ocrBooths: BoothMap = { "10079": [100, 200, 150, 220] };
    const gameBoothIds = ["10079, TT28B"];

    const result = validateBooths(ocrBooths, gameBoothIds);
    expect(result.matched).toEqual(["10079"]);
    expect(result.missingFromMap).toHaveLength(0);
  });
});
