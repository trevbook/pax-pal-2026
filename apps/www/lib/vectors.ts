import "server-only";

import { QueryVectorsCommand, S3VectorsClient } from "@aws-sdk/client-s3vectors";
import { GoogleGenAI } from "@google/genai";
import { Resource } from "sst";

// ---------------------------------------------------------------------------
// Clients (lazy singletons)
// ---------------------------------------------------------------------------

let _s3v: S3VectorsClient | null = null;
function getS3VectorsClient(): S3VectorsClient {
  if (!_s3v) _s3v = new S3VectorsClient({});
  return _s3v;
}

let _genai: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!_genai) {
    const apiKey = (Resource as unknown as Record<string, { value: string }>).GeminiApiKey.value;
    _genai = new GoogleGenAI({ apiKey });
  }
  return _genai;
}

function getIndexArn(): string {
  return (Resource as unknown as Record<string, { indexArn: string }>).VectorIndex.indexArn;
}

// ---------------------------------------------------------------------------
// Embed a single query string
// ---------------------------------------------------------------------------

export async function embedQuery(text: string): Promise<number[]> {
  const ai = getGenAI();
  const response = await ai.models.embedContent({
    model: "gemini-embedding-2-preview",
    contents: text,
  });

  if (!response.embeddings || response.embeddings.length === 0) {
    throw new Error("No embedding returned from Gemini API");
  }

  return response.embeddings[0].values ?? [];
}

// ---------------------------------------------------------------------------
// Query S3 Vectors
// ---------------------------------------------------------------------------

export interface VectorResult {
  key: string; // game ID
  distance: number;
}

export async function queryVectors(
  embedding: number[],
  topK: number,
  typeFilter?: "video_game" | "tabletop" | "both",
): Promise<VectorResult[]> {
  const client = getS3VectorsClient();
  const indexArn = getIndexArn();

  // Build metadata filter for type
  // type field values: "video_game", "tabletop", "both"
  // For "All" tab: no filter
  // For "Video Games" tab: type IN ("video_game", "both")
  // For "Tabletop" tab: type IN ("tabletop", "both")
  let filter: Record<string, unknown> | undefined;
  if (typeFilter === "video_game") {
    filter = { $or: [{ type: { $eq: "video_game" } }, { type: { $eq: "both" } }] };
  } else if (typeFilter === "tabletop") {
    filter = { $or: [{ type: { $eq: "tabletop" } }, { type: { $eq: "both" } }] };
  }

  const result = await client.send(
    new QueryVectorsCommand({
      indexArn,
      topK,
      queryVector: { float32: embedding },
      // Cast needed: SDK expects __DocumentType from @smithy/types but Record<string, unknown> is structurally compatible
      ...(filter ? { filter: filter as never } : {}),
      returnMetadata: true,
      returnDistance: true,
    }),
  );

  return (result.vectors ?? []).map((v) => ({
    key: v.key ?? "",
    distance: v.distance ?? 1,
  }));
}
