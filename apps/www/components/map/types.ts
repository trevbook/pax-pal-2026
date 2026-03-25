/** Bounding box as [x1, y1, x2, y2] in image pixel coordinates. */
export type BBox = [x1: number, y1: number, x2: number, y2: number];

/** Booth coordinate map: booth ID → bounding box. */
export type BoothMap = Record<string, BBox>;
