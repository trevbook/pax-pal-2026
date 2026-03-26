import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";

import { getRecommendations } from "@/app/recommendations/actions";
import { getBoothGames, getGameDetails, getModel, SYSTEM_PROMPT, searchGames } from "@/lib/ai";

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

  // Define analyzeTaste inline so it can close over tracked IDs
  const analyzeTaste = tool({
    description:
      "Analyze the user's tracked games (watchlist + played) and recommend similar games they haven't seen yet. Use this when the user asks for personalized recommendations, 'what should I play?', or anything about their taste/preferences.",
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
      analyzeTaste,
    },
  });

  return result.toUIMessageStreamResponse();
}
