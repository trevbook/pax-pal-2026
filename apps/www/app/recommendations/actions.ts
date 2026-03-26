"use server";

import { getAllActiveGames } from "@/lib/db";
import type { GameCardData } from "@/lib/game-card-data";
import { getVectors, queryVectors } from "@/lib/vectors";

const MAX_INPUT = 50;
const QUERY_TOP_K = 20;
const RETURN_LIMIT = 5;
const ORDER_TOP_K = 100;

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

    // 6. Hydrate from cache, deduplicate by slug, and return top results
    const allGames = await getAllActiveGames();
    const gameById = new Map(allGames.map((g) => [g.id, g]));

    const results: GameCardData[] = [];
    const seenSlugs = new Set<string>();
    for (const vr of filtered) {
      if (results.length >= RETURN_LIMIT) break;
      const game = gameById.get(vr.key);
      if (!game) continue;
      if (seenSlugs.has(game.slug)) continue;
      seenSlugs.add(game.slug);
      results.push(game);
    }

    return results;
  } catch (err) {
    console.error("Recommendations failed:", err);
    return [];
  }
}

/**
 * Returns an ordered list of game IDs ranked by similarity to the user's taste vector.
 * Used by the "Sort by Recommended" option in the game catalogue.
 * Games not in the watchlist are ranked; watchlist games are excluded from results.
 */
export async function getRecommendedOrder(gameIds: string[]): Promise<string[]> {
  try {
    if (gameIds.length === 0) return [];

    const capped = gameIds.slice(0, MAX_INPUT);

    const embeddings = await getVectors(capped);
    if (embeddings.size === 0) return [];

    // Average into a taste vector
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

    // Query a large neighborhood to rank as many games as possible
    const vectorResults = await queryVectors(Array.from(avg), ORDER_TOP_K);

    // Filter out tracked games, return ordered IDs
    const inputSet = new Set(capped);
    return vectorResults.filter((vr) => !inputSet.has(vr.key)).map((vr) => vr.key);
  } catch (err) {
    console.error("Recommended order failed:", err);
    return [];
  }
}
