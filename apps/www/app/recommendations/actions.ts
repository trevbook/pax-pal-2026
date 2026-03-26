"use server";

import { getAllActiveGames } from "@/lib/db";
import type { GameCardData } from "@/lib/game-card-data";

const RETURN_LIMIT = 5;
const PLAYED_MULTIPLIER = 1.5;
const WATCHLIST_MULTIPLIER = 1.0;

interface TrackedGames {
  played: string[];
  watchlist: string[];
}

/**
 * Score candidate games by weighted overlap of pre-computed similarity lists.
 *
 * For each tracked game, we walk its `similarGameIds` and use the real cosine
 * similarity scores (from `similarGameScores`) as weights. Falls back to a
 * linear rank decay when scores aren't available (pre-existing data).
 *
 * Played games contribute 1.5x and watchlisted games contribute 1.0x.
 *
 * This avoids the "embedding averaging blob" problem — diverse tastes produce
 * recommendations from each cluster rather than a muddled centroid.
 */
function scoreByOverlap(
  tracked: TrackedGames,
  gameById: Map<string, GameCardData>,
): Map<string, number> {
  const scores = new Map<string, number>();
  const trackedSet = new Set([...tracked.played, ...tracked.watchlist]);

  function addScores(gameIds: string[], multiplier: number) {
    for (const id of gameIds) {
      const game = gameById.get(id);
      if (!game) continue;
      const neighbors = game.similarGameIds;
      const simScores = game.similarGameScores;
      const hasScores = simScores && simScores.length === neighbors.length;
      for (let r = 0; r < neighbors.length; r++) {
        const neighborId = neighbors[r];
        // Skip games the user already tracks
        if (trackedSet.has(neighborId)) continue;
        // Use real cosine similarity when available, otherwise fall back to rank decay
        const similarity = hasScores ? simScores[r] : (neighbors.length - r) / neighbors.length;
        const weight = similarity * multiplier;
        scores.set(neighborId, (scores.get(neighborId) ?? 0) + weight);
      }
    }
  }

  addScores(tracked.played, PLAYED_MULTIPLIER);
  addScores(tracked.watchlist, WATCHLIST_MULTIPLIER);

  return scores;
}

export async function getRecommendations(tracked: TrackedGames): Promise<GameCardData[]> {
  try {
    if (tracked.played.length === 0 && tracked.watchlist.length === 0) return [];

    const allGames = await getAllActiveGames();
    const gameById = new Map(allGames.map((g) => [g.id, g]));

    const scores = scoreByOverlap(tracked, gameById);

    // Sort by score descending
    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);

    // Deduplicate by slug, return top results
    const results: GameCardData[] = [];
    const seenSlugs = new Set<string>();
    for (const [id] of ranked) {
      if (results.length >= RETURN_LIMIT) break;
      const game = gameById.get(id);
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
 * Returns an ordered list of game IDs ranked by overlap scoring.
 * Used by the "Sort by Recommended" option in the game catalogue.
 */
export async function getRecommendedOrder(tracked: TrackedGames): Promise<string[]> {
  try {
    if (tracked.played.length === 0 && tracked.watchlist.length === 0) return [];

    const allGames = await getAllActiveGames();
    const gameById = new Map(allGames.map((g) => [g.id, g]));

    const scores = scoreByOverlap(tracked, gameById);

    return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  } catch (err) {
    console.error("Recommended order failed:", err);
    return [];
  }
}
