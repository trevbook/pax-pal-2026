import type { BBox, BoothMap, OcrAnnotation } from "./types";

/** Regex patterns for booth-number-like text. */
const BOOTH_PATTERNS = [
  /^\d+$/, // Pure numeric: 16021
  /^TT\d+[A-Z]?$/i, // Tabletop: TT29A
  /^NL\d+$/i, // NL-prefixed: NL2
];

/** Maximum horizontal pixel gap to merge adjacent text chunks into one booth ID. */
const MERGE_GAP_PX = 15;

/** Maximum vertical distance (midpoint-to-midpoint) to consider two annotations on the same line. */
const SAME_LINE_THRESHOLD_PX = 8;

/**
 * Filters OCR annotations to those matching booth-like patterns,
 * then merges adjacent chunks on the same scan-line into full booth IDs.
 *
 * Ported from the 2025 notebook logic.
 */
export function mergeBoothAnnotations(annotations: OcrAnnotation[]): BoothMap {
  // Step 1: Filter to booth-like annotations (digits, TT*, NL*)
  const boothLike = annotations.filter((a) => BOOTH_PATTERNS.some((p) => p.test(a.text)));

  // Step 2: Group by approximate y-midpoint (scan line)
  // We use a simple greedy approach: sort by y-mid, then group consecutive
  // annotations within SAME_LINE_THRESHOLD_PX of each other.
  const sorted = [...boothLike].sort((a, b) => yMid(a.bbox) - yMid(b.bbox));

  const lines: OcrAnnotation[][] = [];
  let currentLine: OcrAnnotation[] = [];

  for (const anno of sorted) {
    if (currentLine.length === 0) {
      currentLine.push(anno);
      continue;
    }

    const lastYMid = yMid(currentLine[currentLine.length - 1].bbox);
    if (Math.abs(yMid(anno.bbox) - lastYMid) <= SAME_LINE_THRESHOLD_PX) {
      currentLine.push(anno);
    } else {
      lines.push(currentLine);
      currentLine = [anno];
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  // Step 3: Within each line, sort left-to-right and merge adjacent chunks
  const booths: BoothMap = {};

  for (const line of lines) {
    line.sort((a, b) => a.bbox[0] - b.bbox[0]); // sort by x1

    let curBox: BBox = [...line[0].bbox];
    let curText = line[0].text;

    for (let i = 1; i < line.length; i++) {
      const box = line[i].bbox;
      const gap = box[0] - curBox[2]; // left edge of next - right edge of current

      if (gap <= MERGE_GAP_PX) {
        // Merge: extend bounding box and concatenate text
        curBox = [
          Math.min(curBox[0], box[0]),
          Math.min(curBox[1], box[1]),
          Math.max(curBox[2], box[2]),
          Math.max(curBox[3], box[3]),
        ];
        curText += line[i].text;
      } else {
        // Emit previous, start new
        booths[curText] = curBox;
        curBox = [...box];
        curText = line[i].text;
      }
    }

    // Emit last chunk on this line
    booths[curText] = curBox;
  }

  // Step 4: Post-process — split over-merged numeric entries.
  // Expo hall booths are 5 digits. If OCR merged adjacent labels
  // (e.g. "160861508715086"), split them back into individual IDs
  // and distribute the bounding box proportionally.
  const final: BoothMap = {};
  for (const [text, bbox] of Object.entries(booths)) {
    const splits = splitOverMerged(text, bbox);
    for (const [id, box] of splits) {
      final[id] = box;
    }
  }

  return final;
}

/**
 * If a merged text is a run of digits longer than 5, try splitting into
 * 5-digit booth IDs. Each gets a proportional horizontal slice of the bbox.
 * Non-numeric or already-valid entries pass through unchanged.
 */
function splitOverMerged(text: string, bbox: BBox): Array<[string, BBox]> {
  // Only split pure numeric strings that are too long
  if (!/^\d+$/.test(text) || text.length <= 5) {
    return [[text, bbox]];
  }

  // All expo hall booth IDs are 5 digits
  if (text.length % 5 !== 0) {
    // Can't split evenly — keep as-is (will be flagged by validation)
    return [[text, bbox]];
  }

  const count = text.length / 5;
  const [x1, y1, x2, y2] = bbox;
  const sliceWidth = (x2 - x1) / count;
  const results: Array<[string, BBox]> = [];

  for (let i = 0; i < count; i++) {
    const id = text.slice(i * 5, (i + 1) * 5);
    const sliceX1 = Math.round(x1 + i * sliceWidth);
    const sliceX2 = Math.round(x1 + (i + 1) * sliceWidth);
    results.push([id, [sliceX1, y1, sliceX2, y2]]);
  }

  return results;
}

/** Count how many annotations matched booth-like patterns. */
export function countBoothLike(annotations: OcrAnnotation[]): number {
  return annotations.filter((a) => BOOTH_PATTERNS.some((p) => p.test(a.text))).length;
}

function yMid(bbox: BBox): number {
  return (bbox[1] + bbox[3]) / 2;
}
