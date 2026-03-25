import type { BoothMap, ValidationResult } from "./types";

/**
 * Cross-references OCR-extracted booth IDs against booth IDs from game data.
 * Extracts individual booth IDs from multi-booth strings (e.g. "18019, 18031, NL2").
 * Only validates expo-hall booth IDs (numeric + NL*), not tabletop (TT*).
 */
export function validateBooths(ocrBooths: BoothMap, gameBoothIds: string[]): ValidationResult {
  // Parse game data booth IDs: split multi-booth strings, filter to expo-hall types
  const gameExpoBooths = new Set<string>();
  for (const raw of gameBoothIds) {
    if (!raw || raw === "UNSPECIFIED" || raw === "Tabletop Hall") continue;

    for (const part of raw.split(",")) {
      const id = part.trim();
      // Only validate expo hall booths (numeric or NL-prefixed)
      // TT booths are tabletop hall — not on the expo map
      if (/^\d+$/.test(id) || /^NL\d+$/i.test(id)) {
        gameExpoBooths.add(id);
      }
    }
  }

  const ocrIds = new Set(Object.keys(ocrBooths));

  const matched: string[] = [];
  const missingFromMap: string[] = [];
  for (const id of gameExpoBooths) {
    if (ocrIds.has(id)) {
      matched.push(id);
    } else {
      missingFromMap.push(id);
    }
  }

  const extraInMap: string[] = [];
  for (const id of ocrIds) {
    if (!gameExpoBooths.has(id)) {
      extraInMap.push(id);
    }
  }

  return {
    matched: matched.sort(),
    missingFromMap: missingFromMap.sort(),
    extraInMap: extraInMap.sort(),
  };
}
