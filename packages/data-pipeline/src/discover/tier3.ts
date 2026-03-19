import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openai } from "@ai-sdk/openai";
import type { DiscoveryMeta, HarmonizedExhibitor, InclusionTier } from "@pax-pal/core";
import { generateText, Output, stepCountIs } from "ai";
import cliProgress from "cli-progress";
import type { DiscoveryResult, GameEvidence } from "./types";
import { tier3EvidenceResultSchema } from "./types";

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a research agent investigating what games an exhibitor is associated with for PAX East 2026 (March 26–29, Boston).

You have a web search tool. Use it to build a complete picture of this exhibitor's RECENT game catalog (2023 or newer) and any PAX East 2026 evidence.

## Search strategy
1. First search: "{exhibitor name}" "PAX East" 2026
2. If the exhibitor has a website, search: site:{website} games OR products
3. Try social media: "{exhibitor name}" "PAX East" site:x.com OR site:twitter.com
4. Search for their game catalog: "{exhibitor name}" games Steam OR BoardGameGeek

## What to report
Find ALL games this exhibitor has developed, published, or is actively associated with that were released or announced since 2023. For each game, report:

1. **paxConfirmation** — Did you find explicit evidence of this game at PAX East 2026?
   - "explicit": Official announcement, social post, or schedule listing naming this game at PAX East 2026
   - "inferred": The exhibitor attended PAX East previously with this game, OR PAX East is mentioned without naming specific titles
   - "none": No PAX-specific evidence found for this game

2. **isPrimaryGame** — Is this the exhibitor's main/only game?

3. **exhibitorGameCount** — How many total recent games (2023+) does this exhibitor have?

4. **releaseStatus** — What is the game's release status?
   - "unreleased": Not yet released (announced, wishlisted, coming soon)
   - "early_access": In early access or beta
   - "released": Fully released
   - "unknown": Cannot determine

5. **releaseYear** — The year the game was released or is expected to release (null if unknown)

6. **sourceType** — Where did you find this game?
   - "official_site", "steam", "bgg", "social_media", "press", "other"

7. **summary** — Brief description of the evidence you found (1-2 sentences)

8. **urls** — URLs backing the evidence

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

## Important rules
- DO report games even without PAX East confirmation — we need the full picture
- DO note the release status of each game accurately
- DO note if the company appears to be a single-game studio
- DO distinguish between "confirmed at PAX East 2026" vs "this company makes this game"
- DON'T speculate about game names — only include games you can verify exist
- DON'T include games released before 2023 unless they have explicit PAX East 2026 evidence
- If the exhibitor has NO recent games (2023+), return an empty games array
- Provide brief reasoning citing your specific sources`;

// ---------------------------------------------------------------------------
// Inclusion tier computation
// ---------------------------------------------------------------------------

/**
 * Deterministic rules to classify how likely a game is to appear at PAX East.
 * The LLM gathers facts; this function makes the inclusion decision.
 */
export function computeInclusionTier(game: GameEvidence): InclusionTier {
  const { paxConfirmation, isPrimaryGame, exhibitorGameCount, releaseStatus, releaseYear } =
    game.evidence;

  // Tier: confirmed — explicit PAX East 2026 evidence
  if (paxConfirmation === "explicit") return "confirmed";

  // Tier: high — strong circumstantial signal
  if (isPrimaryGame && exhibitorGameCount <= 2) return "high";
  if (releaseStatus === "unreleased") return "high";
  if (paxConfirmation === "inferred") return "high";

  // Tier: medium — moderate signal
  if (releaseStatus === "early_access") return "medium";
  if (releaseYear !== null && releaseYear >= 2025) return "medium";

  // Tier: low — weak signal (in catalog but no PAX indicators)
  return "low";
}

// ---------------------------------------------------------------------------
// Per-exhibitor web search
// ---------------------------------------------------------------------------

/** Result from searching a single exhibitor, including rich evidence data. */
export interface Tier3SearchResult {
  /** Standard discovery result for merging with tier2 results. */
  discovery: DiscoveryResult;
  /** Evidence metadata per game, keyed by game name. */
  evidenceByGame: Map<string, DiscoveryMeta>;
}

/**
 * Run a multi-step web search agent for a single exhibitor.
 * Returns both the standard DiscoveryResult and rich evidence metadata.
 */
export async function searchExhibitor(exhibitor: HarmonizedExhibitor): Promise<Tier3SearchResult> {
  const websiteHint = exhibitor.website ? `\nWebsite: ${exhibitor.website}` : "";
  const descHint = exhibitor.description
    ? `\nDescription: ${exhibitor.description.slice(0, 300)}`
    : "";
  const tabletopHint = exhibitor.isTabletop ? "\nThis is a tabletop exhibitor." : "";

  const prompt = `Research this PAX East 2026 exhibitor and find their recent games (2023+):

Name: ${exhibitor.name}
ID: ${exhibitor.id}${websiteHint}${descHint}${tabletopHint}
PAX Tags: ${exhibitor.paxTags.join(", ") || "(none)"}

Search the web to find their game catalog and any PAX East 2026 evidence. Then provide your structured classification and game list.`;

  const { output } = await generateText({
    model: openai("gpt-5.4-mini"),
    system: SYSTEM_PROMPT,
    prompt,
    tools: {
      web_search: openai.tools.webSearch({ searchContextSize: "low" }),
    },
    output: Output.object({ schema: tier3EvidenceResultSchema }),
    stopWhen: stepCountIs(8),
  });

  const parsed = output ?? {
    exhibitorKind: "other" as const,
    games: [] as GameEvidence[],
    reasoning: "Web search agent did not produce structured output within step limit",
  };

  // Build evidence metadata per game and filter by inclusion tier
  const evidenceByGame = new Map<string, DiscoveryMeta>();
  const includedGames: DiscoveryResult["games"] = [];

  for (const game of parsed.games) {
    const tier = computeInclusionTier(game);

    const meta: DiscoveryMeta = {
      inclusionTier: tier,
      paxConfirmation: game.evidence.paxConfirmation,
      releaseStatus: game.evidence.releaseStatus,
      releaseYear: game.evidence.releaseYear,
      evidenceSummary: game.evidence.summary,
      evidenceUrls: game.evidence.urls,
    };

    evidenceByGame.set(game.name, meta);

    // Only include confirmed/high/medium in the discovery result
    if (tier !== "low") {
      includedGames.push({
        name: game.name,
        source: "web_search" as const,
        confidence: tier === "confirmed" ? 0.95 : tier === "high" ? 0.8 : 0.6,
        type: game.type,
      });
    }
  }

  return {
    discovery: {
      exhibitorId: exhibitor.id,
      exhibitorKind: parsed.exhibitorKind,
      games: includedGames,
      confidence: includedGames.length > 0 ? 0.8 : 0.5,
      needsWebSearch: false,
      reasoning: parsed.reasoning,
    },
    evidenceByGame,
  };
}

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

/** Cached tier3 result including evidence metadata. */
interface CachedTier3Result {
  discovery: DiscoveryResult;
  evidenceByGame: Record<string, DiscoveryMeta>;
}

export async function loadTier3Cache(
  cacheDir: string,
): Promise<{ results: Map<string, DiscoveryResult>; evidence: Map<string, DiscoveryMeta> }> {
  const results = new Map<string, DiscoveryResult>();
  const evidence = new Map<string, DiscoveryMeta>();
  try {
    const files = await readdir(cacheDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const data = await Bun.file(join(cacheDir, file)).json();

      // Support both old cache format (flat DiscoveryResult) and new format (CachedTier3Result)
      if ("discovery" in data) {
        const cached = data as CachedTier3Result;
        results.set(cached.discovery.exhibitorId, cached.discovery);
        for (const [name, meta] of Object.entries(cached.evidenceByGame)) {
          evidence.set(`${cached.discovery.exhibitorId}:${name}`, meta);
        }
      } else {
        // Legacy cache format — no evidence metadata
        results.set(data.exhibitorId, data as DiscoveryResult);
      }
    }
  } catch {
    // Cache dir doesn't exist yet — that's fine
  }
  return { results, evidence };
}

export async function saveToTier3Cache(cacheDir: string, result: Tier3SearchResult): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  const cached: CachedTier3Result = {
    discovery: result.discovery,
    evidenceByGame: Object.fromEntries(result.evidenceByGame),
  };
  await writeFile(
    join(cacheDir, `${result.discovery.exhibitorId}.json`),
    JSON.stringify(cached, null, 2),
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

export interface Tier3Result {
  results: Map<string, DiscoveryResult>;
  evidenceByGame: Map<string, DiscoveryMeta>;
  cachedCount: number;
}

/**
 * Run Tier 3 web search on exhibitors that need more information.
 */
export async function runTier3(
  eligibleIds: string[],
  allExhibitors: HarmonizedExhibitor[],
  options: Tier3Options = {},
): Promise<Tier3Result> {
  const { concurrency = 8, cacheDir, skipCache = false } = options;

  const exhibitorMap = new Map(allExhibitors.map((ex) => [ex.id, ex]));

  // Load cache
  const cached =
    cacheDir && !skipCache
      ? await loadTier3Cache(cacheDir)
      : { results: new Map<string, DiscoveryResult>(), evidence: new Map<string, DiscoveryMeta>() };
  const results = new Map(cached.results);
  const evidenceByGame = new Map(cached.evidence);

  // Filter out already-cached exhibitors
  const uncached = eligibleIds.filter((id) => !cached.results.has(id));

  if (uncached.length === 0) {
    console.log("[tier3] All exhibitors already cached, skipping web search.");
    return { results, evidenceByGame, cachedCount: cached.results.size };
  }

  console.log(`[tier3] Searching ${uncached.length} exhibitors (${cached.results.size} cached)...`);

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
        results.set(id, result.discovery);
        for (const [name, meta] of result.evidenceByGame) {
          evidenceByGame.set(`${id}:${name}`, meta);
        }
        if (cacheDir) {
          await saveToTier3Cache(cacheDir, result);
        }
      } catch (error) {
        // On failure, cache a "no results" entry so we don't retry on re-run
        console.error(`\n[tier3] Error searching ${exhibitor.name}: ${error}`);
        const fallback: Tier3SearchResult = {
          discovery: {
            exhibitorId: id,
            exhibitorKind: "other",
            games: [],
            confidence: 0,
            needsWebSearch: false,
            reasoning: `Web search failed: ${error instanceof Error ? error.message : String(error)}`,
          },
          evidenceByGame: new Map(),
        };
        results.set(id, fallback.discovery);
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

  return { results, evidenceByGame, cachedCount: cached.results.size };
}
