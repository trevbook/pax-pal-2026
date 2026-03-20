import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openai } from "@ai-sdk/openai";
import type { HarmonizedGame } from "@pax-pal/core";
import { generateText, Output, stepCountIs } from "ai";
import cliProgress from "cli-progress";
import type { WebEnrichment } from "./types";
import { webEnrichmentSchema } from "./types";

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a research agent enriching metadata for a specific game appearing at PAX East 2026 (March 26–29, Boston).

You have a web search tool. Use it to find detailed information about this game.

## Search strategy
1. Search: "{game name}" game
2. If a Steam URL or store page exists, search: "{game name}" Steam OR site:store.steampowered.com
3. Search for press coverage: "{game name}" review OR preview OR announcement
4. If the game is tabletop: "{game name}" BoardGameGeek OR tabletop
5. Search for social media: "{game name}" game site:x.com OR site:twitter.com OR discord

## What to find
For EVERY game, try to find:
- **summary**: A catchy 1-2 sentence hook describing the game
- **description**: A fuller description (2-4 sentences) if available
- **imageUrl**: Official key art, Steam header image, or publisher site image
- **developerName**: The developer/designer (may differ from the exhibitor/publisher)
- **releaseStatus**: unreleased, early_access, released, or unknown
- **releaseDate**: Release date or expected date if known (e.g. "2025-Q2", "March 2026")

For VIDEO GAMES, also find:
- **platforms**: Which platforms (PC, PlayStation, Xbox, Switch, Mobile, VR)
- **genres**: Game genres (Action, RPG, Puzzle, etc.)
- **steamUrl**: The Steam store page URL if it exists
- **trailerUrl**: YouTube or Steam trailer URL
- **screenshotUrls**: Up to 4 screenshot URLs

For TABLETOP GAMES without BGG data, also find:
- **playerCount**: Player count range (e.g. "2-4")
- **playTime**: Play time (e.g. "30-60 min")
- **mechanics**: Game mechanics (Deck-Builder, Dice, Worker Placement, etc.)

For ALL games, try to find:
- **pressLinks**: Articles, reviews, previews, interviews about the game. Include the URL, article title, source name (e.g. "PC Gamer"), and type (review/preview/interview/announcement/trailer/other).
- **socialLinks**: Official Twitter/X, Discord, YouTube, itch.io links
  - IMPORTANT: These must be full profile/page URLs, NOT bare domain roots
  - Good: "https://x.com/StudioName", "https://discord.gg/abcdef", "https://www.youtube.com/@StudioName"
  - Bad: "https://x.com", "https://discord.gg", "https://www.youtube.com"
  - If you can only find the bare domain without a specific profile path, return null instead

## Important rules
- Only include verified information you find via web search — do not guess or fabricate
- For URLs, only include ones you've actually found in search results
- If you can't find certain fields, return null for those fields
- Be especially careful with image URLs — only use ones from official sources
- For pressLinks, prefer recent articles (2024-2026)
- Do NOT fabricate or guess URLs. If you cannot find an actual screenshot URL from search results, return an empty array. Never construct URLs by guessing hash patterns (e.g., Steam CDN paths with hex hashes).
- For socialLinks, do NOT use Steam community links or steamcommunity.com/linkfilter wrapper URLs. Each field must point to the game's actual profile on that platform. If you can't find it, return null.
- Write summary and description as plain text. Do not include markdown links, citations, source annotations, or reference markers like ([source](url)). URLs belong in pressLinks/socialLinks, not inline in descriptions.
- For pressLinks, only include editorial content (reviews, previews, interviews, announcements from journalists). Do NOT include store pages (Steam, Epic, itch.io, retail shops), database/tracker pages (SteamDB, HowLongToBeat), or the developer's own store listings.`;

// ---------------------------------------------------------------------------
// Per-game web search
// ---------------------------------------------------------------------------

/**
 * Build the user prompt for a single game, including discovery evidence if available.
 */
export function buildGamePrompt(game: HarmonizedGame): string {
  const parts: string[] = [
    `Research this game appearing at PAX East 2026 and find detailed metadata:`,
    ``,
    `Game: ${game.name}`,
    `Type: ${game.type}`,
    `Exhibitor: ${game.exhibitor}`,
  ];

  if (game.description) {
    parts.push(`Description: ${game.description.slice(0, 400)}`);
  }

  if (game.discoveryMeta?.evidenceUrls?.length) {
    parts.push(``);
    parts.push(`Known URLs (starting points for your research):`);
    for (const url of game.discoveryMeta.evidenceUrls) {
      parts.push(`- ${url}`);
    }
  }

  parts.push(``);
  parts.push(`Search the web to find the game's details and provide your structured response.`);

  return parts.join("\n");
}

/**
 * Run web search enrichment for a single game.
 */
export async function enrichFromWeb(game: HarmonizedGame): Promise<WebEnrichment | null> {
  const { output } = await generateText({
    model: openai("gpt-5.4-mini"),
    system: SYSTEM_PROMPT,
    prompt: buildGamePrompt(game),
    tools: {
      web_search: openai.tools.webSearch({ searchContextSize: "low" }),
    },
    output: Output.object({ schema: webEnrichmentSchema }),
    stopWhen: stepCountIs(8),
  });

  return output ?? null;
}

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

export async function loadWebCache(cacheDir: string): Promise<Map<string, WebEnrichment | null>> {
  const cache = new Map<string, WebEnrichment | null>();
  try {
    const files = await readdir(cacheDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const gameId = file.replace(".json", "");
      const data = await Bun.file(join(cacheDir, file)).json();
      cache.set(gameId, data as WebEnrichment | null);
    }
  } catch {
    // Cache dir doesn't exist yet
  }
  return cache;
}

async function saveWebCache(
  cacheDir: string,
  gameId: string,
  result: WebEnrichment | null,
): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(join(cacheDir, `${gameId}.json`), JSON.stringify(result, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Batch runner
// ---------------------------------------------------------------------------

export interface WebOptions {
  cacheDir?: string;
  skipCache?: boolean;
  concurrency?: number;
}

export interface WebResult {
  results: Map<string, WebEnrichment | null>;
  cachedCount: number;
}

/**
 * Run web search enrichment for a batch of games.
 * Uses worker pool pattern with bounded concurrency.
 */
export async function runWebEnrichment(
  games: HarmonizedGame[],
  options: WebOptions = {},
): Promise<WebResult> {
  const { cacheDir, skipCache = false, concurrency = 8 } = options;

  const cached =
    cacheDir && !skipCache ? await loadWebCache(cacheDir) : new Map<string, WebEnrichment | null>();
  const results = new Map(cached);

  const uncached = games.filter((g) => !cached.has(g.id));

  if (uncached.length === 0) {
    console.log("[web] All games already cached, skipping web search.");
    return { results, cachedCount: cached.size };
  }

  console.log(`[web] Enriching ${uncached.length} games (${cached.size} cached)...`);

  const bar = new cliProgress.SingleBar(
    {
      format: "[web] {bar} {percentage}% | {value}/{total} games | ETA: {eta_formatted}",
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic,
  );
  bar.start(uncached.length, 0);

  let nextIndex = 0;

  async function processNext(): Promise<void> {
    while (nextIndex < uncached.length) {
      const i = nextIndex++;
      const game = uncached[i];

      try {
        const result = await enrichFromWeb(game);
        results.set(game.id, result);
        if (cacheDir) {
          await saveWebCache(cacheDir, game.id, result);
        }
      } catch (error) {
        console.error(`\n[web] Error enriching "${game.name}": ${error}`);
        results.set(game.id, null);
        if (cacheDir) {
          await saveWebCache(cacheDir, game.id, null);
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
