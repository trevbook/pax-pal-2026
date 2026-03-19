import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openai } from "@ai-sdk/openai";
import { EXHIBITOR_KINDS, type HarmonizedExhibitor } from "@pax-pal/core";
import { generateText, Output, stepCountIs } from "ai";
import cliProgress from "cli-progress";
import { z } from "zod";
import type { DiscoveryResult } from "./types";

// ---------------------------------------------------------------------------
// Prompt & schema
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a research agent finding what games an exhibitor is CONFIRMED to be bringing to PAX East 2026 (May 22–24, Boston).

You have a web search tool. Use it to find what games this exhibitor is showing at PAX East 2026.

## Search strategy
1. First search: "{exhibitor name}" "PAX East" 2026
2. If the exhibitor has a website, search: site:{website} "PAX East"
3. Try social media: "{exhibitor name}" "PAX East" site:x.com OR site:twitter.com

## What counts as evidence
ONLY include a game if you find a DIRECT, EXPLICIT mention that it will be at PAX East 2026. Acceptable evidence:
- An official announcement saying "we're bringing X to PAX East 2026"
- A social media post saying "come play X at our booth at PAX East"
- A PAX East 2026 schedule or lineup listing the game
- The exhibitor's own website listing PAX East 2026 with specific titles

Do NOT include a game based on:
- The company's general catalog or recent releases
- Speculation that they "might" or "probably" will show it
- Games they showed at previous PAX events
- Indirect evidence like "they're attending PAX and they make these games"

When in doubt, leave the games array EMPTY. An empty result is far better than a speculative one. We only want confirmed titles.

## Classification
Determine the exhibitor kind:
- "game_studio": Develops/publishes their own games
- "publisher": Publishes games from multiple studios
- "agency": PR/marketing firm
- "tabletop_publisher": Board/card game publisher
- "peripheral": Hardware/accessories
- "media": Press, streamers, podcasts
- "community": Fan groups, nonprofits
- "other": Doesn't fit above

## Output rules
- Only include games with DIRECT evidence of PAX East 2026 presence
- Confidence should be 0.8+ for any game you include — if you can't justify that, don't include it
- If you find NO confirmed games, return an empty games array — that is the correct answer
- Set needsWebSearch to false in your response (the search is now complete)
- Provide brief reasoning citing your specific sources (URLs or quotes)`;

const tier3OutputSchema = z.object({
  exhibitorKind: z.enum(EXHIBITOR_KINDS),
  games: z.array(
    z.object({
      name: z.string(),
      confidence: z.number(),
      type: z.enum(["video_game", "tabletop", "both"]).nullable(),
    }),
  ),
  confidence: z.number(),
  reasoning: z.string(),
});

// ---------------------------------------------------------------------------
// Per-exhibitor web search
// ---------------------------------------------------------------------------

/**
 * Run a multi-step web search agent for a single exhibitor.
 */
export async function searchExhibitor(exhibitor: HarmonizedExhibitor): Promise<DiscoveryResult> {
  const websiteHint = exhibitor.website ? `\nWebsite: ${exhibitor.website}` : "";
  const descHint = exhibitor.description
    ? `\nDescription: ${exhibitor.description.slice(0, 300)}`
    : "";
  const tabletopHint = exhibitor.isTabletop ? "\nThis is a tabletop exhibitor." : "";

  const prompt = `Research this PAX East 2026 exhibitor and find what games they are showing:

Name: ${exhibitor.name}
ID: ${exhibitor.id}${websiteHint}${descHint}${tabletopHint}
PAX Tags: ${exhibitor.paxTags.join(", ") || "(none)"}

Search the web to find their PAX East 2026 lineup. Then provide your structured classification and game list.`;

  const { output } = await generateText({
    model: openai("gpt-5.4-mini"),
    system: SYSTEM_PROMPT,
    prompt,
    tools: {
      web_search: openai.tools.webSearch({ searchContextSize: "low" }),
    },
    output: Output.object({ schema: tier3OutputSchema }),
    stopWhen: stepCountIs(6),
  });

  const parsed = output ?? {
    exhibitorKind: "other" as const,
    games: [],
    confidence: 0,
    reasoning: "Web search agent did not produce structured output within step limit",
  };

  return {
    exhibitorId: exhibitor.id,
    exhibitorKind: parsed.exhibitorKind,
    games: parsed.games.map((g) => ({
      ...g,
      source: "web_search" as const,
    })),
    confidence: parsed.confidence,
    needsWebSearch: false,
    reasoning: parsed.reasoning,
  };
}

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

export async function loadTier3Cache(cacheDir: string): Promise<Map<string, DiscoveryResult>> {
  const cache = new Map<string, DiscoveryResult>();
  try {
    const files = await readdir(cacheDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const data = await Bun.file(join(cacheDir, file)).json();
      cache.set(data.exhibitorId, data as DiscoveryResult);
    }
  } catch {
    // Cache dir doesn't exist yet — that's fine
  }
  return cache;
}

export async function saveToTier3Cache(cacheDir: string, result: DiscoveryResult): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(
    join(cacheDir, `${result.exhibitorId}.json`),
    JSON.stringify(result, null, 2),
    "utf-8",
  );
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface Tier3Options {
  concurrency?: number;
  cacheDir?: string;
  skipCache?: boolean;
}

/**
 * Run Tier 3 web search on exhibitors that need more information.
 */
export async function runTier3(
  eligibleIds: string[],
  allExhibitors: HarmonizedExhibitor[],
  options: Tier3Options = {},
): Promise<{ results: Map<string, DiscoveryResult>; cachedCount: number }> {
  const { concurrency = 2, cacheDir, skipCache = false } = options;

  const exhibitorMap = new Map(allExhibitors.map((ex) => [ex.id, ex]));

  // Load cache
  const cached = cacheDir && !skipCache ? await loadTier3Cache(cacheDir) : new Map();
  const results = new Map(cached);

  // Filter out already-cached exhibitors
  const uncached = eligibleIds.filter((id) => !cached.has(id));

  if (uncached.length === 0) {
    console.log("[tier3] All exhibitors already cached, skipping web search.");
    return { results, cachedCount: cached.size };
  }

  console.log(`[tier3] Searching ${uncached.length} exhibitors (${cached.size} cached)...`);

  // Progress bar
  const bar = new cliProgress.SingleBar(
    {
      format: "[tier3] {bar} {percentage}% | {value}/{total} exhibitors | ETA: {eta_formatted}",
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic,
  );
  bar.start(uncached.length, 0);

  // Worker pool with bounded concurrency
  let nextIndex = 0;

  async function processNext(): Promise<void> {
    while (nextIndex < uncached.length) {
      const i = nextIndex++;
      const id = uncached[i];
      const exhibitor = exhibitorMap.get(id);
      if (!exhibitor) {
        bar.increment();
        continue;
      }

      try {
        const result = await searchExhibitor(exhibitor);
        results.set(id, result);
        if (cacheDir) {
          await saveToTier3Cache(cacheDir, result);
        }
      } catch (error) {
        // On failure, cache a "no results" entry so we don't retry on re-run
        console.error(`\n[tier3] Error searching ${exhibitor.name}: ${error}`);
        const fallback: DiscoveryResult = {
          exhibitorId: id,
          exhibitorKind: "other",
          games: [],
          confidence: 0,
          needsWebSearch: false,
          reasoning: `Web search failed: ${error instanceof Error ? error.message : String(error)}`,
        };
        results.set(id, fallback);
        if (cacheDir) {
          await saveToTier3Cache(cacheDir, fallback);
        }
      }
      bar.increment();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, uncached.length) }, () =>
    processNext(),
  );
  await Promise.all(workers);
  bar.stop();

  return { results, cachedCount: cached.size };
}
