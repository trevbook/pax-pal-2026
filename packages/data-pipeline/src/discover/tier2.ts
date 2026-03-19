import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openai } from "@ai-sdk/openai";
import type { HarmonizedExhibitor } from "@pax-pal/core";
import { generateObject } from "ai";
import cliProgress from "cli-progress";
import type { DiscoveryResult, Tier1Signal } from "./types";
import { batchResultSchema } from "./types";

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are classifying exhibitors at PAX East 2026. For each exhibitor, determine:
1. What kind of entity they are
2. What specific games they are DEMOING AT PAX EAST (not their full catalog)
3. Your confidence level (0.0–1.0)
4. Whether a web search would help find more information

## CRITICAL: Only extract games being shown at PAX East

Your job is NOT to list every game a company has ever made. You must ONLY extract games that the description indicates will be PLAYABLE or DEMOED at PAX East 2026.

Signs a game IS being shown at PAX East:
- "Come play [game]", "demo [game]", "try [game] at our booth"
- The entire description is about one game (the exhibitor exists to show that game)
- For small indie studios with one game: if the description is entirely about that game, it's safe to assume they're showing it
- For tabletop publishers: if they describe specific games they're bringing or demoing

Signs a game is NOT necessarily being shown (DO NOT extract these):
- A list of past titles or "credits" (e.g. "Titles include X, Y, Z" or "known for X, Y, Z")
- Company bio listing their portfolio or history
- Collaborations or past work mentioned for credibility
- Games listed alongside phrases like "known for", "titles include", "collaborations include"

When in doubt, set needsWebSearch: true and return games: []. Tier 3 web search will determine what's actually at PAX East.

## Classification categories

- "game_studio": Develops/publishes their own games. Usually showing 1–3 titles. The description typically mentions a specific game by name.
- "publisher": Publishes games from multiple studios. May be showing several titles but unclear which. Set needsWebSearch: true if games aren't listed.
- "agency": PR/marketing/biz dev firm representing other developers. Look for "PR", "marketing", "representation", or mentions of multiple studios. These produce 0 games.
- "tabletop_publisher": Publishes board/card/tabletop games. Look for isTabletop flag + game descriptions.
- "peripheral": Hardware, controllers, monitors, chairs, accessories. Produces 0 games.
- "media": Press, streamers, content creators, podcasts. Produces 0 games.
- "community": Fan groups, nonprofits, libraries, advocacy orgs. Produces 0 games.
- "other": Doesn't fit above categories (apparel, energy drinks, collectibles, etc.).

## Game extraction sources

- "description_explicit": A game is clearly being shown/demoed at PAX East based on the description (e.g. "Come play Terra Nova: Legend of the Runes at our booth").
- "description_inferred": Description strongly implies a specific game is being shown but doesn't say so directly (e.g. the entire description is about one game for a single-game indie studio).
- "name_is_game": The exhibitor's name IS the game AND the description is about that game (common for indie studios showing a single title).
- "bgg_match": Exhibitor name matches a known board game (for tabletop exhibitors).

## Guidelines

- BE CONSERVATIVE. Only extract games you are confident are being shown at PAX East.
- Prefer needsWebSearch: true over low-confidence guesses.
- If a description reads like a company bio listing their portfolio, return games: [] and set needsWebSearch: true.
- For agencies/peripherals/media/community: always return games: [].
- If the exhibitor name looks like a game title (nameIsGame signal is true) and the description is about that game, use source "name_is_game".
- If likelyUmbrella is true, the exhibitor probably represents other studios — lean toward "agency" or "publisher".
- For tabletop exhibitors: if description mentions specific games they are bringing/demoing, extract them.

## Examples

Exhibitor: { name: "9th Bit Games", description: "Terra Nova: Legend of the Runes is a modern love letter to classic turn-based RPGs...", isTabletop: false }
Result: { exhibitorKind: "game_studio", games: [{ name: "Terra Nova: Legend of the Runes", source: "description_explicit", confidence: 0.95, type: "video_game" }], confidence: 0.95, needsWebSearch: false, reasoning: "Single-game indie studio; entire description is about this game, clearly being shown at PAX" }

Exhibitor: { name: "Zenni", description: "Zenni is the world's leading online eyewear retailer...", isTabletop: false }
Result: { exhibitorKind: "peripheral", games: [], confidence: 0.95, needsWebSearch: false, reasoning: "Eyewear retailer, not a game company" }

Exhibitor: { name: "IllFonic Inc.", description: "Founded in 2007, IllFonic is an independent video game developer and publisher... Titles and collaborations include Halloween, Killer Klowns From Outer Space: The Game, Ghostbusters: Spirits Unleashed, Arcadegeddon, Predator: Hunting Grounds, Friday the 13th: The Game...", isTabletop: false }
Result: { exhibitorKind: "game_studio", games: [], confidence: 0.98, needsWebSearch: true, reasoning: "Game studio with large portfolio, but description is a company bio listing past titles — no indication of which games are being demoed at PAX East" }

Exhibitor: { name: "Ukiyo Studios", description: "PR and marketing agency representing indie developers...", isTabletop: false, likelyUmbrella: true }
Result: { exhibitorKind: "agency", games: [], confidence: 0.9, needsWebSearch: false, reasoning: "PR/marketing agency, developers are separate exhibitors" }`;

/**
 * Format a single exhibitor into a text block for the LLM prompt.
 */
export function formatExhibitorForPrompt(
  exhibitor: HarmonizedExhibitor,
  signal: Tier1Signal,
): string {
  const desc = exhibitor.description
    ? exhibitor.description.length > 500
      ? `${exhibitor.description.slice(0, 500)}...`
      : exhibitor.description
    : "(no description)";

  const parts = [
    `Name: ${exhibitor.name}`,
    `ID: ${exhibitor.id}`,
    `Description: ${desc}`,
    `Website: ${exhibitor.website ?? "(none)"}`,
    `isTabletop: ${exhibitor.isTabletop}`,
    `paxTags: ${exhibitor.paxTags.join(", ") || "(none)"}`,
    `nameIsGame: ${signal.nameIsGame}`,
    `likelyUmbrella: ${signal.likelyUmbrella}`,
  ];
  return parts.join("\n");
}

function formatBatch(
  batch: Array<{ exhibitor: HarmonizedExhibitor; signal: Tier1Signal }>,
): string {
  const sections = batch.map(
    ({ exhibitor, signal }, i) =>
      `--- Exhibitor ${i + 1} ---\n${formatExhibitorForPrompt(exhibitor, signal)}`,
  );
  return `Classify the following ${batch.length} exhibitors. Return one result per exhibitor in the same order, using the exhibitor's ID as exhibitorId.\n\n${sections.join("\n\n")}`;
}

// ---------------------------------------------------------------------------
// LLM classification
// ---------------------------------------------------------------------------

/**
 * Classify a batch of exhibitors using the LLM.
 */
export async function classifyBatch(
  batch: Array<{ exhibitor: HarmonizedExhibitor; signal: Tier1Signal }>,
): Promise<DiscoveryResult[]> {
  const { object } = await generateObject({
    model: openai("gpt-5.4-mini"),
    schema: batchResultSchema,
    schemaName: "DiscoveryResults",
    system: SYSTEM_PROMPT,
    prompt: formatBatch(batch),
  });
  return object.results;
}

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

export async function loadCache(cacheDir: string): Promise<Map<string, DiscoveryResult>> {
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

export async function saveToCache(cacheDir: string, result: DiscoveryResult): Promise<void> {
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

export interface Tier2Options {
  batchSize?: number;
  concurrency?: number;
  cacheDir?: string;
  skipCache?: boolean;
}

/**
 * Run Tier 2 LLM classification on exhibitors identified by Tier 1.
 */
export async function runTier2(
  forTier2Ids: string[],
  allExhibitors: HarmonizedExhibitor[],
  signals: Map<string, Tier1Signal>,
  options: Tier2Options = {},
): Promise<{ results: Map<string, DiscoveryResult>; cachedCount: number }> {
  const { batchSize = 5, concurrency = 8, cacheDir, skipCache = false } = options;

  const exhibitorMap = new Map(allExhibitors.map((ex) => [ex.id, ex]));

  // Load cache
  const cached = cacheDir && !skipCache ? await loadCache(cacheDir) : new Map();
  const results = new Map(cached);

  // Filter out already-cached exhibitors
  const uncached = forTier2Ids.filter((id) => !cached.has(id));

  if (uncached.length === 0) {
    console.log("[tier2] All exhibitors already cached, skipping LLM calls.");
    return { results, cachedCount: cached.size };
  }

  console.log(`[tier2] Processing ${uncached.length} exhibitors (${cached.size} cached)...`);

  // Build batches
  const batches: Array<Array<{ exhibitor: HarmonizedExhibitor; signal: Tier1Signal }>> = [];
  for (let i = 0; i < uncached.length; i += batchSize) {
    const batchIds = uncached.slice(i, i + batchSize);
    const batch = batchIds
      .map((id) => {
        const exhibitor = exhibitorMap.get(id);
        const signal = signals.get(id);
        if (!exhibitor || !signal) return null;
        return { exhibitor, signal };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    if (batch.length > 0) batches.push(batch);
  }

  // Process batches with bounded concurrency
  const bar = new cliProgress.SingleBar(
    {
      format: "[tier2] {bar} {percentage}% | {value}/{total} batches | ETA: {eta_formatted}",
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic,
  );
  bar.start(batches.length, 0);

  let nextIndex = 0;

  async function processBatch(): Promise<void> {
    while (nextIndex < batches.length) {
      const i = nextIndex++;
      const batchResults = await classifyBatch(batches[i]);

      for (const result of batchResults) {
        results.set(result.exhibitorId, result);
        if (cacheDir) {
          await saveToCache(cacheDir, result);
        }
      }
      bar.increment();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, batches.length) }, () =>
    processBatch(),
  );
  await Promise.all(workers);
  bar.stop();

  return { results, cachedCount: cached.size };
}
