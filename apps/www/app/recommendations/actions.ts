"use server";

import { getAllActiveGames } from "@/lib/db";
import type { GameCardData } from "@/lib/game-card-data";
import { getVectors, queryVectors } from "@/lib/vectors";

const MAX_INPUT = 50;
const QUERY_TOP_K = 20;
const RETURN_LIMIT = 6;

export async function getRecommendations(gameIds: string[]): Promise<GameCardData[]> {
  try {
    if (gameIds.length === 0) return [];

    // 1. Cap input to stay within S3 Vectors limits
    const capped = gameIds.slice(0, MAX_INPUT);

    // 2. Fetch embeddings for tracked games
    const embeddings = await getVectors(capped);
    if (embeddings.size === 0) return [];

    // 3. Average into a taste vector
    const first = embeddings.values().next().value;
    if (!first) return [];
    const dim = first.length;
    const avg = new Float32Array(dim);
    for (const vec of embeddings.values()) {
      for (let i = 0; i < dim; i++) {
        avg[i] += vec[i];
      }
    }
    const count = embeddings.size;
    for (let i = 0; i < dim; i++) {
      avg[i] /= count;
    }

    // 4. Query nearest neighbors
    const vectorResults = await queryVectors(Array.from(avg), QUERY_TOP_K);

    // 5. Filter out already-tracked games
    const inputSet = new Set(capped);
    const filtered = vectorResults.filter((vr) => !inputSet.has(vr.key));

    // 6. Hydrate from cache and return top results
    const allGames = await getAllActiveGames();
    const gameById = new Map(allGames.map((g) => [g.id, g]));

    const results: GameCardData[] = [];
    for (const vr of filtered) {
      if (results.length >= RETURN_LIMIT) break;
      const game = gameById.get(vr.key);
      if (game) results.push(game);
    }

    return results;
  } catch (err) {
    console.error("Recommendations failed:", err);
    return [];
  }
}
