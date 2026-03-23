"use server";

import { getAllActiveGames } from "@/lib/db";
import type { GameCardData } from "@/lib/game-card-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatchType = "name" | "description" | "semantic";

export interface SearchResult {
  game: GameCardData;
  matchType: MatchType;
  score: number;
}

export interface TextSearchResponse {
  results: SearchResult[];
}

export interface SemanticSearchResponse {
  results: SearchResult[];
  error?: string;
}

type TypeFilter = "all" | "video_game" | "tabletop";

// ---------------------------------------------------------------------------
// Text search — fast path (~50ms)
// Substring match on game name, exhibitor, tags
// ---------------------------------------------------------------------------

export async function textSearch(
  query: string,
  typeFilter: TypeFilter,
): Promise<TextSearchResponse> {
  const q = query.toLowerCase().trim();
  if (!q) return { results: [] };

  const allGames = await getAllActiveGames();

  // Filter by type
  const typed = typeFilter === "all" ? allGames : filterByType(allGames, typeFilter);

  const results: SearchResult[] = [];

  for (const game of typed) {
    // Check name match (highest text score)
    if (game.name.toLowerCase().includes(q)) {
      // Boost exact prefix matches
      const isPrefix = game.name.toLowerCase().startsWith(q);
      results.push({
        game,
        matchType: "name",
        score: isPrefix ? 1.0 : 0.8,
      });
      continue;
    }

    // Check exhibitor match
    if (game.exhibitor.toLowerCase().includes(q)) {
      results.push({ game, matchType: "name", score: 0.6 });
      continue;
    }

    // Check tags, genres, mechanics
    const tagMatch =
      game.tags.some((t) => t.toLowerCase().includes(q)) ||
      (game.genres ?? []).some((g) => g.toLowerCase().includes(q)) ||
      (game.tabletopGenres ?? []).some((g) => g.toLowerCase().includes(q)) ||
      (game.mechanics ?? []).some((m) => m.toLowerCase().includes(q));

    if (tagMatch) {
      results.push({ game, matchType: "description", score: 0.5 });
      continue;
    }

    // Check summary
    if (game.summary?.toLowerCase().includes(q)) {
      results.push({ game, matchType: "description", score: 0.4 });
    }
  }

  // Sort by score descending, take top 30
  results.sort((a, b) => b.score - a.score);
  return { results: results.slice(0, 30) };
}

// ---------------------------------------------------------------------------
// Semantic search — slow path (~500-1500ms)
// Embed query via Gemini → QueryVectors → lookup game data
// ---------------------------------------------------------------------------

export async function semanticSearch(
  query: string,
  typeFilter: TypeFilter,
): Promise<SemanticSearchResponse> {
  const q = query.trim();
  if (!q) return { results: [] };

  try {
    // Dynamic import to avoid loading vector deps when not needed
    const { embedQuery, queryVectors } = await import("@/lib/vectors");

    // 1. Embed the query
    const embedding = await embedQuery(q);

    // 2. Query S3 Vectors
    const vectorTypeFilter =
      typeFilter === "all" ? undefined : (typeFilter as "video_game" | "tabletop");
    const vectorResults = await queryVectors(embedding, 30, vectorTypeFilter);

    // 3. Hydrate game data from the cached active-games list (no extra DynamoDB calls)
    const allGames = await getAllActiveGames();
    const gameById = new Map(allGames.map((g) => [g.id, g]));

    const results: SearchResult[] = [];
    for (const vr of vectorResults) {
      const game = gameById.get(vr.key);
      if (!game) continue;

      // Cosine distance: 0 = identical, 2 = opposite
      // Convert to similarity score: 1 - (distance / 2)
      const score = 1 - vr.distance / 2;
      results.push({ game, matchType: "semantic", score });
    }

    return { results };
  } catch (err) {
    console.error("Semantic search failed:", err);
    return {
      results: [],
      error: "Semantic search unavailable",
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterByType(games: GameCardData[], type: "video_game" | "tabletop"): GameCardData[] {
  return games.filter((g) => g.type === type || g.type === "both");
}
