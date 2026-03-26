import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";

import { getRecommendations } from "@/app/recommendations/actions";
import { getBoothGames, getGameDetails, getModel, SYSTEM_PROMPT, searchGames } from "@/lib/ai";
import { getAllActiveGames } from "@/lib/db";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    watchlistIds,
    playedIds,
  }: { messages: UIMessage[]; watchlistIds: string[]; playedIds: string[] } = await req.json();

  const tracked = {
    played: playedIds ?? [],
    watchlist: watchlistIds ?? [],
  };

  // Returns the user's actual watchlist / played games (not recommendations)
  const getTrackedGames = tool({
    description:
      "Return the user's watchlisted and/or played games. Use this when the user asks what's in their watchlist, what they've played, or wants to see their tracked games. This does NOT recommend new games — it just shows what the user has already saved.",
    inputSchema: z.object({
      list: z
        .enum(["watchlist", "played", "both"])
        .describe("Which list to return: watchlist, played, or both"),
    }),
    execute: async ({ list }) => {
      const wantWatchlist = list === "watchlist" || list === "both";
      const wantPlayed = list === "played" || list === "both";

      const ids = new Set<string>([
        ...(wantWatchlist ? tracked.watchlist : []),
        ...(wantPlayed ? tracked.played : []),
      ]);

      if (ids.size === 0) {
        return {
          error: `You haven't added any games to your ${list} yet!`,
          watchlist: [],
          played: [],
        };
      }

      const allGames = await getAllActiveGames();
      const gameById = new Map(allGames.map((g) => [g.id, g]));

      return {
        watchlist: wantWatchlist
          ? tracked.watchlist.map((id) => gameById.get(id)).filter(Boolean)
          : [],
        played: wantPlayed ? tracked.played.map((id) => gameById.get(id)).filter(Boolean) : [],
      };
    },
  });

  // Define analyzeTaste inline so it can close over tracked IDs
  const analyzeTaste = tool({
    description:
      "Analyze the user's tracked games (watchlist + played) and recommend NEW similar games they haven't seen yet. Use this ONLY when the user asks for personalized recommendations, 'what should I play next?', or wants suggestions based on their taste. Do NOT use this to show the user their own watchlist or played games — use getTrackedGames for that.",
    inputSchema: z.object({}),
    execute: async () => {
      if (tracked.played.length === 0 && tracked.watchlist.length === 0) {
        return {
          error:
            "You haven't tracked any games yet — add some to your watchlist or mark some as played, then I can give you personalized recs!",
          games: [],
        };
      }
      const recs = await getRecommendations(tracked);
      return { games: recs };
    },
  });

  const result = streamText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(3),
    tools: {
      searchGames,
      getGameDetails,
      getBoothGames,
      getTrackedGames,
      analyzeTaste,
    },
  });

  return result.toUIMessageStreamResponse();
}
