import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";

import { getRecommendations } from "@/app/recommendations/actions";
import { getBoothGames, getGameDetails, getModel, SYSTEM_PROMPT, searchGames } from "@/lib/ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, watchlistIds }: { messages: UIMessage[]; watchlistIds: string[] } =
    await req.json();

  // Define analyzeWatchlist inline so it can close over watchlistIds
  const analyzeWatchlist = tool({
    description:
      "Analyze the user's watchlist and recommend similar games they haven't seen yet. Use this when the user asks for personalized recommendations or 'what should I play?'",
    inputSchema: z.object({}),
    execute: async () => {
      if (!watchlistIds || watchlistIds.length === 0) {
        return {
          error:
            "Your watchlist is empty — add some games first, then I can give you personalized recs!",
          games: [],
        };
      }
      const recs = await getRecommendations(watchlistIds);
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
      analyzeWatchlist,
    },
  });

  return result.toUIMessageStreamResponse();
}
