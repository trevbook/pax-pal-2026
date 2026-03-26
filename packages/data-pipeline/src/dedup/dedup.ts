import type { Game } from "@pax-pal/core";
import { normalizeForMatch } from "../reconcile/reconcile";

export interface DedupResult {
  games: Game[];
  stats: {
    input: number;
    output: number;
    duplicatesRemoved: number;
    /** Names that had duplicates, with how many copies were merged. */
    merged: { name: string; kept: string; removed: string[] }[];
  };
}

/**
 * Score a game record by data richness — higher is better.
 * Prefers demo-sourced over discovered, then ranks by available fields.
 */
function richness(game: Game): number {
  let score = 0;

  // Strongly prefer demo-sourced games
  if (game.id.startsWith("demo:")) score += 100;

  // Reward populated fields
  if (game.description) score += 10;
  if (game.summary) score += 5;
  if (game.imageUrl) score += 5;
  if (game.embedding && game.embedding.length > 0) score += 10;
  if (game.tags.length > 0) score += 5;
  if (game.steamUrl) score += 3;
  if (game.bggId) score += 3;
  if (game.genres && game.genres.length > 0) score += 3;
  if (game.platforms && game.platforms.length > 0) score += 3;
  if (game.pressLinks.length > 0) score += 2;
  if (game.mediaUrls.length > 0) score += 2;

  return score;
}

/**
 * Deduplicate games by normalized name.
 * When duplicates exist, keeps the record with the highest richness score.
 */
export function dedup(games: Game[]): DedupResult {
  // Group by normalized name
  const groups = new Map<string, Game[]>();
  for (const game of games) {
    const key = normalizeForMatch(game.name);
    const group = groups.get(key);
    if (group) {
      group.push(game);
    } else {
      groups.set(key, [game]);
    }
  }

  const dedupedGames: Game[] = [];
  const merged: DedupResult["stats"]["merged"] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      dedupedGames.push(group[0]);
      continue;
    }

    // Sort by richness descending, pick the best
    group.sort((a, b) => richness(b) - richness(a));
    const best = group[0];
    dedupedGames.push(best);

    merged.push({
      name: best.name,
      kept: best.id,
      removed: group.slice(1).map((g) => g.id),
    });
  }

  return {
    games: dedupedGames,
    stats: {
      input: games.length,
      output: dedupedGames.length,
      duplicatesRemoved: games.length - dedupedGames.length,
      merged,
    },
  };
}
