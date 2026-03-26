import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openai } from "@ai-sdk/openai";
import type { HarmonizedGame } from "@pax-pal/core";
import { generateText, Output, stepCountIs } from "ai";
import * as cheerio from "cheerio";
import cliProgress from "cli-progress";
import type { BggEnrichment } from "./types";
import { bggWebSearchSchema } from "./types";

// ---------------------------------------------------------------------------
// BGG XML API (detail fetching only)
// ---------------------------------------------------------------------------

const BGG_BASE = "https://boardgamegeek.com/xmlapi2";
const BGG_DELAY_MS = 1100; // ~1 req/sec for detail fetches

/**
 * Build headers for BGG XML API requests.
 * Requires BGG_API_TOKEN env var (Bearer token from a registered BGG application).
 * See: https://boardgamegeek.com/using_the_xml_api
 */
function bggHeaders(): Record<string, string> {
  const token = process.env.BGG_API_TOKEN;
  if (!token) {
    throw new Error(
      "BGG_API_TOKEN env var is required. Register at https://boardgamegeek.com/applications to get a Bearer token.",
    );
  }
  return { Authorization: `Bearer ${token}` };
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch detailed info for a BGG game by ID.
 */
export async function fetchBggDetails(
  bggId: number,
  matchMethod: BggEnrichment["matchMethod"],
): Promise<BggEnrichment> {
  const url = `${BGG_BASE}/thing?id=${bggId}&stats=1`;
  const res = await fetch(url, { headers: bggHeaders() });
  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });

  const item = $("item").first();

  const bggName =
    item.find('name[type="primary"]').attr("value") ??
    item.find("name").first().attr("value") ??
    "";

  const minPlayers = item.find("minplayers").attr("value");
  const maxPlayers = item.find("maxplayers").attr("value");
  const playerCount =
    minPlayers && maxPlayers ? `${minPlayers}-${maxPlayers}` : (minPlayers ?? maxPlayers ?? null);

  const minPlaytime = item.find("minplaytime").attr("value");
  const maxPlaytime = item.find("maxplaytime").attr("value");
  const playTime =
    minPlaytime && maxPlaytime && minPlaytime !== maxPlaytime
      ? `${minPlaytime}-${maxPlaytime} min`
      : minPlaytime
        ? `${minPlaytime} min`
        : null;

  const weightStr = item.find("statistics ratings averageweight").attr("value");
  const complexity = weightStr ? Number.parseFloat(weightStr) : null;

  const ratingStr = item.find("statistics ratings average").attr("value");
  const rating = ratingStr ? Number.parseFloat(ratingStr) : null;

  const yearStr = item.find("yearpublished").attr("value");
  const yearPublished = yearStr ? Number(yearStr) : null;

  const mechanics: string[] = [];
  item.find('link[type="boardgamemechanic"]').each((_, el) => {
    const val = $(el).attr("value");
    if (val) mechanics.push(val);
  });

  const description = item.find("description").text().trim() || null;
  const imageUrl = item.find("image").text().trim() || null;

  return {
    bggId,
    bggName,
    matchMethod,
    playerCount,
    playTime,
    complexity,
    mechanics,
    description,
    imageUrl,
    rating,
    yearPublished,
  };
}

// ---------------------------------------------------------------------------
// BGG URL → ID extraction
// ---------------------------------------------------------------------------

const BGG_URL_RE = /boardgamegeek\.com\/boardgame\/(\d+)/;

/**
 * Extract the BGG game ID from a boardgamegeek.com URL.
 * Returns null if the URL doesn't match.
 */
export function extractBggId(url: string): number | null {
  const match = BGG_URL_RE.exec(url);
  return match ? Number(match[1]) : null;
}

// ---------------------------------------------------------------------------
// Web search → BGG ID lookup
// ---------------------------------------------------------------------------

/**
 * Use LLM web search to find the BoardGameGeek page for a game.
 * Returns the BGG ID if found, null otherwise.
 */
export async function findBggViaWebSearch(game: HarmonizedGame): Promise<number | null> {
  const descHint = game.description ? `\nDescription: ${game.description.slice(0, 200)}` : "";

  const { output } = await generateText({
    model: openai("gpt-5.4-mini"),
    prompt: `Find the BoardGameGeek page for this tabletop game from PAX East 2026:

Name: "${game.name}"${descHint}

Search for this game on BoardGameGeek. Return the BGG URL if you find the correct base game page (not an expansion, promo, or variant unless the game itself IS an expansion/variant). Return null if the game is not on BGG.`,
    tools: {
      web_search: openai.tools.webSearch({ searchContextSize: "low" }),
    },
    output: Output.object({ schema: bggWebSearchSchema }),
    stopWhen: stepCountIs(4),
  });

  if (!output?.bggUrl) return null;

  const bggId = extractBggId(output.bggUrl);
  if (!bggId) {
    console.log(`[bgg] "${game.name}": could not extract ID from URL "${output.bggUrl}"`);
    return null;
  }

  return bggId;
}

// ---------------------------------------------------------------------------
// Per-game enrichment
// ---------------------------------------------------------------------------

/**
 * Attempt to enrich a single game from BGG via web search → API detail fetch.
 * Returns BggEnrichment if a match is found, null otherwise.
 */
export async function enrichFromBgg(game: HarmonizedGame): Promise<BggEnrichment | null> {
  const bggId = await findBggViaWebSearch(game);
  if (bggId === null) {
    console.log(`[bgg] "${game.name}": not found on BGG`);
    return null;
  }

  console.log(`[bgg] "${game.name}": found BGG ID ${bggId}`);
  await delay(BGG_DELAY_MS);

  return fetchBggDetails(bggId, "web_search");
}

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

export async function loadBggCache(cacheDir: string): Promise<Map<string, BggEnrichment | null>> {
  const cache = new Map<string, BggEnrichment | null>();
  try {
    const files = await readdir(cacheDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const gameId = file.replace(".json", "");
      const data = await Bun.file(join(cacheDir, file)).json();
      cache.set(gameId, data as BggEnrichment | null);
    }
  } catch {
    // Cache dir doesn't exist yet
  }
  return cache;
}

async function saveBggCache(
  cacheDir: string,
  gameId: string,
  result: BggEnrichment | null,
): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(join(cacheDir, `${gameId}.json`), JSON.stringify(result, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Batch runner
// ---------------------------------------------------------------------------

export interface BggOptions {
  cacheDir?: string;
  skipCache?: boolean;
  concurrency?: number;
}

export interface BggResult {
  results: Map<string, BggEnrichment | null>;
  cachedCount: number;
}

/**
 * Check whether BGG enrichment can run (requires BGG_API_TOKEN + OPENAI_API_KEY).
 */
export function isBggConfigured(): boolean {
  return !!process.env.BGG_API_TOKEN;
}

/**
 * Run BGG enrichment for all tabletop/both games.
 * Uses LLM web search to find BGG pages, then fetches details via the XML API.
 * Sequential BGG API calls (1 req/sec rate limit) but web searches run concurrently.
 */
export async function runBggEnrichment(
  games: HarmonizedGame[],
  options: BggOptions = {},
): Promise<BggResult> {
  if (!isBggConfigured()) {
    console.warn(
      "[bgg] BGG_API_TOKEN not set — skipping BGG enrichment. Register at https://boardgamegeek.com/applications",
    );
    return { results: new Map(), cachedCount: 0 };
  }

  const { cacheDir, skipCache = false, concurrency = 4 } = options;

  const cached =
    cacheDir && !skipCache ? await loadBggCache(cacheDir) : new Map<string, BggEnrichment | null>();
  const results = new Map(cached);

  const uncached = games.filter((g) => !cached.has(g.id));

  if (uncached.length === 0) {
    console.log("[bgg] All games already cached, skipping BGG search.");
    return { results, cachedCount: cached.size };
  }

  console.log(`[bgg] Searching ${uncached.length} games (${cached.size} cached)...`);

  const bar = new cliProgress.SingleBar(
    {
      format: "[bgg] {bar} {percentage}% | {value}/{total} games | ETA: {eta_formatted}",
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
      const game = uncached[i];

      try {
        const result = await enrichFromBgg(game);
        results.set(game.id, result);
        if (cacheDir) {
          await saveBggCache(cacheDir, game.id, result);
        }
      } catch (error) {
        console.error(`\n[bgg] Error enriching "${game.name}": ${error}`);
        results.set(game.id, null);
        if (cacheDir) {
          await saveBggCache(cacheDir, game.id, null);
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
