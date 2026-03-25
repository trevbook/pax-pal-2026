import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { BBox, OcrAnnotation } from "./types";

/**
 * Calls Google Cloud Vision TEXT_DETECTION on a local image file.
 * Uses the REST API directly — requires a `GOOGLE_CLOUD_VISION_API_KEY` env var.
 *
 * If `cacheDir` is provided, caches the parsed OCR annotations to avoid repeat API calls.
 */
export async function ocrImage(
  imagePath: string,
  options?: { cacheDir?: string },
): Promise<OcrAnnotation[]> {
  // Check cache first
  if (options?.cacheDir) {
    const cachePath = join(options.cacheDir, `${basename(imagePath)}.ocr.json`);
    const cacheFile = Bun.file(cachePath);
    if (await cacheFile.exists()) {
      const cached = (await cacheFile.json()) as OcrAnnotation[];
      console.log(`  Using cached OCR result (${cached.length} annotations) from ${cachePath}`);
      return cached;
    }
  }

  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_CLOUD_VISION_API_KEY is not set. " +
        "Create an API key in your GCP project (restrict to Cloud Vision API) and export it.",
    );
  }

  const imageBytes = await Bun.file(imagePath).arrayBuffer();
  const base64 = Buffer.from(imageBytes).toString("base64");

  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  const body = {
    requests: [
      {
        image: { content: base64 },
        features: [{ type: "TEXT_DETECTION" }],
      },
    ],
  };

  console.log(
    `  Calling Vision API on ${imagePath} (${(imageBytes.byteLength / 1024 / 1024).toFixed(1)} MB)...`,
  );

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vision API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as VisionResponse;
  const response = data.responses[0];

  if (response.error) {
    throw new Error(`Vision API returned error: ${JSON.stringify(response.error)}`);
  }

  const annotations = response.textAnnotations ?? [];
  if (annotations.length === 0) {
    console.warn("  Warning: Vision API returned zero text annotations.");
    return [];
  }

  // Skip the first annotation (full-page text blob), keep individual words
  const results: OcrAnnotation[] = [];
  for (const anno of annotations.slice(1)) {
    const text = anno.description.trim();
    if (!text) continue;

    const xs = anno.boundingPoly.vertices.map((v) => v.x ?? 0);
    const ys = anno.boundingPoly.vertices.map((v) => v.y ?? 0);
    const bbox: BBox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];

    results.push({ text, bbox });
  }

  console.log(`  Got ${results.length} text annotations.`);

  // Write cache
  if (options?.cacheDir) {
    await mkdir(options.cacheDir, { recursive: true });
    const cachePath = join(options.cacheDir, `${basename(imagePath)}.ocr.json`);
    await writeFile(cachePath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`  Cached OCR result to ${cachePath}`);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Vision API response types (minimal)
// ---------------------------------------------------------------------------

interface VisionResponse {
  responses: Array<{
    textAnnotations?: Array<{
      description: string;
      boundingPoly: {
        vertices: Array<{ x?: number; y?: number }>;
      };
    }>;
    error?: unknown;
  }>;
}
