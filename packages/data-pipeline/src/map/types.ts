/** Bounding box as [x1, y1, x2, y2] in image pixel coordinates. */
export type BBox = [x1: number, y1: number, x2: number, y2: number];

/** Raw text annotation from Vision API OCR. */
export interface OcrAnnotation {
  text: string;
  bbox: BBox;
}

/** The final booth coordinate map: booth ID → bounding box. */
export type BoothMap = Record<string, BBox>;

/** Result of the full map pipeline. */
export interface MapResult {
  /** Booth ID → bounding box from OCR + overrides. */
  booths: BoothMap;
  stats: MapStats;
}

export interface MapStats {
  /** Total text annotations returned by OCR. */
  ocrAnnotations: number;
  /** Annotations that matched booth-like patterns. */
  boothLikeAnnotations: number;
  /** Booths after merging adjacent chunks. */
  boothsAfterMerge: number;
  /** Overrides applied from booths-overrides.json. */
  overridesApplied: number;
  /** Final booth count. */
  finalBooths: number;
  /** Booth IDs in game data that matched OCR results. */
  matchedGameBooths: number;
  /** Booth IDs in game data with no OCR match. */
  unmatchedGameBooths: number;
}

export interface ValidationResult {
  /** Booth IDs present in both OCR output and game data. */
  matched: string[];
  /** Booth IDs in game data but not in OCR output. */
  missingFromMap: string[];
  /** Booth IDs in OCR output but not in game data. */
  extraInMap: string[];
}
