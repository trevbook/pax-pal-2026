import type {
  DiscoverySource,
  ExhibitorKind,
  HarmonizedExhibitor,
  HarmonizedGame,
} from "@pax-pal/core";
import { toSlug } from "@pax-pal/core";
import { runTier1 } from "./tier1";
import type { Tier2Options } from "./tier2";
import { runTier2 } from "./tier2";
import { runTier3 } from "./tier3";
import type { DiscoverStats, DiscoveryResult } from "./types";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface DiscoverResult {
  /** All exhibitors, annotated with exhibitorKind and discoveredGameCount. */
  exhibitors: HarmonizedExhibitor[];
  /** Demo-sourced games + newly discovered games. */
  games: HarmonizedGame[];
  /** Raw discovery results per exhibitor, for inspection/debugging. */
  discoveries: DiscoveryResult[];
  stats: DiscoverStats;
}

export interface DiscoverOptions extends Tier2Options {
  /** Enable Tier 3 web search for exhibitors needing more info. */
  webSearch?: boolean;
  /** Cache directory for Tier 3 results. */
  tier3CacheDir?: string;
  /** Limit how many exhibitors Tier 3 processes (useful for testing). */
  tier3Limit?: number;
  /** @internal — override runTier2 for testing. */
  _runTier2?: typeof runTier2;
  /** @internal — override runTier3 for testing. */
  _runTier3?: typeof runTier3;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function discover(
  allExhibitors: HarmonizedExhibitor[],
  existingGames: HarmonizedGame[],
  options: DiscoverOptions = {},
): Promise<DiscoverResult> {
  // Tier 1: structural deduction
  console.log("\n[discover] Running Tier 1: structural deduction...");
  const tier1 = runTier1(allExhibitors);
  console.log(`  No-demo exhibitors: ${tier1.signals.size}`);
  console.log(`  Skipped (no data): ${tier1.skipped.length}`);
  console.log(`  For Tier 2: ${tier1.forTier2.length}`);
  console.log(
    `  Likely umbrellas: ${[...tier1.signals.values()].filter((s) => s.likelyUmbrella).length}`,
  );

  // Tier 2: LLM classification
  console.log("\n[discover] Running Tier 2: LLM classification...");
  const tier2Fn = options._runTier2 ?? runTier2;
  const { results: tier2Results, cachedCount: tier2CachedCount } = await tier2Fn(
    tier1.forTier2,
    allExhibitors,
    tier1.signals,
    options,
  );

  // Tier 3: web search (optional)
  let tier3Eligible = [
    ...tier1.skipped,
    ...[...tier2Results.entries()].filter(([_, r]) => r.needsWebSearch).map(([id]) => id),
  ];

  if (options.tier3Limit != null && options.tier3Limit > 0) {
    tier3Eligible = tier3Eligible.slice(0, options.tier3Limit);
  }

  let tier3Results = new Map<string, DiscoveryResult>();
  let tier3CachedCount = 0;

  if (options.webSearch && tier3Eligible.length > 0) {
    console.log(`\n[discover] Running Tier 3: web search (${tier3Eligible.length} exhibitors)...`);
    const tier3Fn = options._runTier3 ?? runTier3;
    const tier3 = await tier3Fn(tier3Eligible, allExhibitors, {
      concurrency: 2,
      cacheDir: options.tier3CacheDir,
      skipCache: options.skipCache,
    });
    tier3Results = tier3.results;
    tier3CachedCount = tier3.cachedCount;
  } else if (tier3Eligible.length > 0) {
    console.log(
      `\n[discover] Skipping Tier 3 (${tier3Eligible.length} exhibitors need web search). Use --web-search to enable.`,
    );
  }

  // Merge: tier3 results replace tier2 for the same exhibitor
  const mergedResults = new Map(tier2Results);
  for (const [id, result] of tier3Results) {
    mergedResults.set(id, result);
  }

  // Build discovered games from merged results
  const exhibitorMap = new Map(allExhibitors.map((ex) => [ex.id, ex]));
  const discoveredGames: HarmonizedGame[] = [];
  const discoveries: DiscoveryResult[] = [];

  for (const [exhibitorId, discovery] of mergedResults) {
    discoveries.push(discovery);
    const exhibitor = exhibitorMap.get(exhibitorId);
    if (!exhibitor) continue;

    for (const game of discovery.games) {
      discoveredGames.push(
        toHarmonizedGame(game.name, exhibitor, mapSource(game.source), game.type),
      );
    }
  }

  // Annotate exhibitors with discovery metadata
  const annotatedExhibitors = allExhibitors.map((ex) => {
    const discovery = mergedResults.get(ex.id);
    if (!discovery) return ex;
    return {
      ...ex,
      exhibitorKind: discovery.exhibitorKind as ExhibitorKind,
      discoveredGameCount: discovery.games.length,
    };
  });

  const stats: DiscoverStats = {
    totalNoDemoExhibitors: tier1.signals.size,
    tier1Skipped: tier1.skipped.length,
    tier1Umbrellas: [...tier1.signals.values()].filter((s) => s.likelyUmbrella).length,
    tier2Processed: tier2Results.size - tier2CachedCount,
    tier2Cached: tier2CachedCount,
    tier3Eligible: tier3Eligible.length,
    tier3Processed: tier3Results.size - tier3CachedCount,
    tier3Cached: tier3CachedCount,
    gamesDiscovered: discoveredGames.length,
  };

  console.log(`\n[discover] Done. Discovered ${discoveredGames.length} new games.`);

  return {
    exhibitors: annotatedExhibitors,
    games: [...existingGames, ...discoveredGames],
    discoveries,
    stats,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapSource(
  source:
    | "description_explicit"
    | "description_inferred"
    | "name_is_game"
    | "bgg_match"
    | "web_search",
): DiscoverySource {
  return source;
}

function toHarmonizedGame(
  gameName: string,
  exhibitor: HarmonizedExhibitor,
  discoverySource: DiscoverySource,
  gameType: "video_game" | "tabletop" | "both" | null,
): HarmonizedGame {
  const slug = toSlug(gameName);
  const type = gameType ?? (exhibitor.isTabletop ? "tabletop" : "video_game");

  return {
    id: `discovered:${exhibitor.id}:${slug}`,
    name: gameName,
    slug,
    type,
    exhibitor: exhibitor.name,
    exhibitorId: exhibitor.id,
    boothLocation: exhibitor.boothLocation,
    description: exhibitor.description,
    imageUrl: exhibitor.imageUrl,
    showroomUrl: exhibitor.showroomUrl,
    isFeatured: exhibitor.isFeatured,
    paxTags: exhibitor.paxTags,
    sourcePages: [...exhibitor.sourcePages],
    demoId: null,
    discoverySource,
    lastScrapedAt: exhibitor.lastScrapedAt,
  };
}
