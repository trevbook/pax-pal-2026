import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { tool } from "ai";
import { Resource } from "sst";
import { z } from "zod";

import { getAllActiveGames, getGameBySlug, getGamesByBooth } from "./db";
import { toGameCardData } from "./game-card-data";
import { embedQuery, queryVectors } from "./vectors";

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

let _google: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getGoogle() {
  if (!_google) {
    const apiKey = (Resource as unknown as Record<string, { value: string }>).GeminiApiKey.value;
    _google = createGoogleGenerativeAI({ apiKey });
  }
  return _google;
}

export function getModel() {
  return getGoogle()("gemini-3.1-flash-lite-preview");
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = `You are PAX Pal, a concise AI guide to PAX East 2026 (Boston Convention Center, March 26–29).

Your job: help attendees discover games and get playing FAST. Be friendly but brief.

Rules:
- ALWAYS use your tools before answering game-related questions. Never guess about games.
- When recommending games, show 3–5 results. Never dump a huge list.
- Always mention booth numbers when you know them (e.g. "Head to booth 12045").
- If the user has games on their watchlist, use analyzeWatchlist for personalized recs.
- For discovery queries ("cozy games", "best roguelikes"), use searchGames.
- For specific game info, use getGameDetails.
- For "what's at booth X?" questions, use getBoothGames.
- Keep your text responses to 1–3 sentences. Let the game cards speak for themselves.
- If you genuinely don't know something or a tool returns no results, say so briefly.
- You know about every game at the show — there are 395+ across video games and tabletop.
- Do NOT make up games that aren't in your tools' results.`;

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export const searchGames = tool({
  description:
    "Search for games at PAX East by vibe, genre, theme, or description. Use this for discovery queries like 'cozy games', 'best co-op tabletop', 'horror roguelikes', etc.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Natural language search query describing what the user is looking for"),
    type: z
      .enum(["all", "video_game", "tabletop"])
      .optional()
      .describe("Filter by game type. Omit or use 'all' to search everything."),
  }),
  execute: async ({ query, type }) => {
    const embedding = await embedQuery(query);
    const typeFilter = type === "all" || !type ? undefined : (type as "video_game" | "tabletop");
    const vectorResults = await queryVectors(embedding, 8, typeFilter);

    const allGames = await getAllActiveGames();
    const gameById = new Map(allGames.map((g) => [g.id, g]));

    // Deduplicate by slug, return top 5
    const results = [];
    const seenSlugs = new Set<string>();
    for (const vr of vectorResults) {
      if (results.length >= 5) break;
      const game = gameById.get(vr.key);
      if (!game) continue;
      if (seenSlugs.has(game.slug)) continue;
      seenSlugs.add(game.slug);
      results.push(game);
    }

    return { games: results };
  },
});

export const getGameDetails = tool({
  description:
    "Get detailed information about a specific game by name. Use when the user asks about a particular game.",
  inputSchema: z.object({
    name: z.string().describe("The name of the game to look up"),
  }),
  execute: async ({ name }) => {
    // First try to find the game by text matching against the cached list
    const allGames = await getAllActiveGames();
    const nameLower = name.toLowerCase();

    // Exact match first, then prefix, then substring
    const exact = allGames.find((g) => g.name.toLowerCase() === nameLower);
    const match = exact ?? allGames.find((g) => g.name.toLowerCase().includes(nameLower));

    if (!match) {
      return { error: `Couldn't find a game called "${name}". Try searching instead.`, game: null };
    }

    // Fetch full details
    const full = await getGameBySlug(match.slug);
    if (!full) {
      // Fall back to card data
      return { game: match };
    }

    return {
      game: {
        ...toGameCardData(full),
        description: full.description,
        steamUrl: full.steamUrl,
        socialLinks: full.socialLinks,
        playerCount: full.playerCount,
        playTime: full.playTime,
        complexity: full.complexity,
        developerName: full.developerName,
        price: full.price,
        similarGameIds: full.similarGameIds,
      },
    };
  },
});

export const getBoothGames = tool({
  description:
    "List all games at a specific booth number. Use when the user asks 'what's at booth X?' or mentions a booth ID.",
  inputSchema: z.object({
    boothId: z.string().describe("The booth ID/number to look up"),
  }),
  execute: async ({ boothId }) => {
    const games = await getGamesByBooth(boothId);
    if (games.length === 0) {
      return { error: `No games found at booth ${boothId}.`, games: [] };
    }
    return { games };
  },
});
