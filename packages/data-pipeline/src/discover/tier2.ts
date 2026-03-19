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
2. What specific games they might be showing (extract from description or infer from context)
3. Your confidence level (0.0–1.0)
4. Whether a web search would help find more information

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

- "description_explicit": A game name is directly stated in the description (e.g. "Come play Terra Nova: Legend of the Runes").
- "description_inferred": Description strongly implies a specific game but doesn't name it directly (e.g. website domain is the game name).
- "name_is_game": The exhibitor's name IS the game (common for indie studios showing a single title).
- "bgg_match": Exhibitor name matches a known board game (for tabletop exhibitors).

## Guidelines

- Prefer needsWebSearch: true over low-confidence guesses.
- For agencies/peripherals/media/community: always return games: [].
- If the exhibitor name looks like a game title (nameIsGame signal is true) and no other game is mentioned, consider using source "name_is_game".
- If likelyUmbrella is true, the exhibitor probably represents other studios — lean toward "agency" or "publisher".
- For tabletop exhibitors: if description mentions a specific board/card game, extract it.

## Examples

Exhibitor: { name: "9th Bit Games", description: "Terra Nova: Legend of the Runes is a modern love letter to classic turn-based RPGs...", isTabletop: false }
Result: { exhibitorKind: "game_studio", games: [{ name: "Terra Nova: Legend of the Runes", source: "description_explicit", confidence: 0.95, type: "video_game" }], confidence: 0.95, needsWebSearch: false, reasoning: "Game name explicitly stated in description" }

Exhibitor: { name: "Zenni", description: "Zenni is the world's leading online eyewear retailer...", isTabletop: false }
Result: { exhibitorKind: "peripheral", games: [], confidence: 0.95, needsWebSearch: false, reasoning: "Eyewear retailer, not a game company" }

Exhibitor: { name: "IllFonic", description: "IllFonic is a game development studio known for...", isTabletop: false }
Result: { exhibitorKind: "publisher", games: [], confidence: 0.5, needsWebSearch: true, reasoning: "Game studio but no specific PAX East titles mentioned in description" }

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
  const { batchSize = 5, concurrency = 4, cacheDir, skipCache = false } = options;

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
