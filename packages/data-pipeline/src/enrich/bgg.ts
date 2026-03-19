import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openai } from "@ai-sdk/openai";
import type { HarmonizedGame } from "@pax-pal/core";
import { generateObject } from "ai";
import * as cheerio from "cheerio";
import cliProgress from "cli-progress";
import type { BggEnrichment, BggSearchCandidate } from "./types";
import { bggDisambiguationSchema } from "./types";

// ---------------------------------------------------------------------------
// Levenshtein similarity
// ---------------------------------------------------------------------------

/**
 * Compute the Levenshtein edit distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * Normalized Levenshtein similarity (0–1). Case-insensitive.
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(la, lb) / maxLen;
}

// ---------------------------------------------------------------------------
// BGG XML API
// ---------------------------------------------------------------------------

const BGG_BASE = "https://boardgamegeek.com/xmlapi2";
const BGG_DELAY_MS = 1100; // ~1 req/sec

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Search BGG for board games matching the query.
 * Returns up to 10 candidates sorted by year (desc, nulls last).
 */
export async function searchBgg(query: string): Promise<BggSearchCandidate[]> {
  const url = `${BGG_BASE}/search?query=${encodeURIComponent(query)}&type=boardgame`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });

  const candidates: BggSearchCandidate[] = [];

  $("item").each((_, el) => {
    const id = Number($(el).attr("id"));
    const name = $(el).find("name").attr("value") ?? "";
    const yearStr = $(el).find("yearpublished").attr("value");
    const yearPublished = yearStr ? Number(yearStr) : null;

    if (id && name) {
      candidates.push({ bggId: id, name, yearPublished });
    }
  });

  // Sort by year descending (nulls last)
  candidates.sort((a, b) => {
    if (a.yearPublished === null && b.yearPublished === null) return 0;
    if (a.yearPublished === null) return 1;
    if (b.yearPublished === null) return -1;
    return b.yearPublished - a.yearPublished;
  });

  return candidates.slice(0, 10);
}

/**
 * Fetch detailed info for a BGG game by ID.
 */
export async function fetchBggDetails(
  bggId: number,
  matchScore: number,
  matchMethod: "auto" | "llm",
): Promise<BggEnrichment> {
  const url = `${BGG_BASE}/thing?id=${bggId}&stats=1`;
  const res = await fetch(url);
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
    matchScore,
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
// LLM disambiguation
// ---------------------------------------------------------------------------

/**
 * Use gpt-5.4-nano to pick the best BGG candidate for a game.
 * Returns the 0-based index of the best match, or null if none match.
 */
export async function disambiguateBgg(
  gameName: string,
  gameDescription: string | null,
  candidates: BggSearchCandidate[],
): Promise<number | null> {
  const candidateList = candidates
    .map((c, i) => `${i}. "${c.name}" (${c.yearPublished ?? "year unknown"})`)
    .join("\n");

  const descHint = gameDescription ? `\nDescription: ${gameDescription.slice(0, 200)}` : "";

  const { object } = await generateObject({
    model: openai("gpt-5.4-nano"),
    schema: bggDisambiguationSchema,
    prompt: `Given this game from PAX East 2026:
Name: "${gameName}"${descHint}

Which of these BoardGameGeek results (if any) is the same game?
${candidateList}

Return the index number of the best match, or null if none match. Only match if you are confident it is the same game.`,
  });

  if (object.bestMatchIndex === null) return null;
  if (object.bestMatchIndex < 0 || object.bestMatchIndex >= candidates.length) return null;
  return object.bestMatchIndex;
}

// ---------------------------------------------------------------------------
// Per-game enrichment
// ---------------------------------------------------------------------------

/**
 * Attempt to enrich a single game from BGG.
 * Returns BggEnrichment if a match is found, null otherwise.
 */
export async function enrichFromBgg(game: HarmonizedGame): Promise<BggEnrichment | null> {
  const candidates = await searchBgg(game.name);
  if (candidates.length === 0) return null;

  await delay(BGG_DELAY_MS);

  // Score all candidates
  const scored = candidates.map((c) => ({
    candidate: c,
    score: levenshteinSimilarity(game.name, c.name),
  }));
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];

  // Auto-accept: high confidence match
  if (best.score > 0.9) {
    const details = await fetchBggDetails(best.candidate.bggId, best.score, "auto");
    await delay(BGG_DELAY_MS);
    return details;
  }

  // Disambiguate: moderate confidence
  if (best.score >= 0.6) {
    const top5 = scored.slice(0, 5).map((s) => s.candidate);
    try {
      const matchIndex = await disambiguateBgg(game.name, game.description, top5);
      if (matchIndex !== null) {
        const matched = top5[matchIndex];
        const details = await fetchBggDetails(matched.bggId, scored[matchIndex].score, "llm");
        await delay(BGG_DELAY_MS);
        return details;
      }
    } catch (error) {
      console.error(`[bgg] LLM disambiguation failed for "${game.name}": ${error}`);
    }
  }

  // No match
  return null;
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
}

export interface BggResult {
  results: Map<string, BggEnrichment | null>;
  cachedCount: number;
}

/**
 * Run BGG enrichment for all tabletop/both games.
 * Sequential (1 req/sec rate limit) with progress bar and caching.
 */
export async function runBggEnrichment(
  games: HarmonizedGame[],
  options: BggOptions = {},
): Promise<BggResult> {
  const { cacheDir, skipCache = false } = options;

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

  for (const game of uncached) {
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

  bar.stop();
  return { results, cachedCount: cached.size };
}
