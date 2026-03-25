import { countBoothLike, mergeBoothAnnotations } from "./merge";
import { ocrImage } from "./ocr";
import type { BBox, BoothMap, MapResult } from "./types";
import { validateBooths } from "./validate";

export interface MapOptions {
  /** Path to the expo hall map image. */
  imagePath: string;
  /** Booth IDs from game data, used for cross-reference validation. */
  gameBoothIds: string[];
  /** Optional manual overrides: booth ID → bounding box. Merged on top of OCR output. */
  overrides?: BoothMap;
  /** Directory to cache raw OCR results (avoids repeat API calls). */
  cacheDir?: string;
}

/**
 * Run the full booth data pipeline:
 * 1. OCR the expo hall map image
 * 2. Filter and merge annotations into booth bounding boxes
 * 3. Apply manual overrides
 * 4. Validate against game data booth IDs
 */
export async function map(options: MapOptions): Promise<MapResult> {
  const { imagePath, gameBoothIds, overrides = {}, cacheDir } = options;

  // Step 1: OCR
  const annotations = await ocrImage(imagePath, { cacheDir });

  // Step 2: Filter & merge
  const boothLikeCount = countBoothLike(annotations);
  const merged = mergeBoothAnnotations(annotations);
  const mergedCount = Object.keys(merged).length;

  console.log(`  Booth-like annotations: ${boothLikeCount}`);
  console.log(`  After merge: ${mergedCount} booths`);

  // Step 3: Apply overrides
  const booths: BoothMap = { ...merged };
  let overridesApplied = 0;
  for (const [id, bbox] of Object.entries(overrides)) {
    const isNew = !(id in booths);
    booths[id] = bbox as BBox;
    overridesApplied++;
    if (isNew) {
      console.log(`  Override (added): ${id}`);
    } else {
      console.log(`  Override (replaced): ${id}`);
    }
  }

  if (overridesApplied > 0) {
    console.log(`  Overrides applied: ${overridesApplied}`);
  }

  // Step 4: Validate
  const validation = validateBooths(booths, gameBoothIds);

  console.log(
    `  Validation: ${validation.matched.length} matched, ${validation.missingFromMap.length} missing from map, ${validation.extraInMap.length} extra in map`,
  );

  if (validation.missingFromMap.length > 0) {
    console.log(`  Missing from map (need overrides?):`);
    for (const id of validation.missingFromMap) {
      console.log(`    - ${id}`);
    }
  }

  return {
    booths,
    stats: {
      ocrAnnotations: annotations.length,
      boothLikeAnnotations: boothLikeCount,
      boothsAfterMerge: mergedCount,
      overridesApplied,
      finalBooths: Object.keys(booths).length,
      matchedGameBooths: validation.matched.length,
      unmatchedGameBooths: validation.missingFromMap.length,
    },
  };
}

export type { MapResult } from "./types";
