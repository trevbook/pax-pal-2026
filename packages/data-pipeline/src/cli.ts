import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Game, HarmonizedExhibitor, HarmonizedGame, InclusionTier } from "@pax-pal/core";
import { classify } from "./classify/classify";
import type { GameClassification } from "./classify/types";
import { dedup } from "./dedup/dedup";
import { discover } from "./discover/discover";
import { embed } from "./embed/embed";
import { enrich } from "./enrich/enrich";
import type { EnrichmentMeta } from "./enrich/types";
import { harmonize } from "./harmonize/harmonize";
import { load, setupVectors } from "./load/load";
import { map } from "./map/map";
import type { BoothMap } from "./map/types";
import { reconcileWithCaches } from "./reconcile/reconcile";
import { transformDemos, transformExhibitors } from "./scrape/api";
import { parseDemoPage } from "./scrape/demos";
import { parseExhibitorPage } from "./scrape/exhibitors";
import { fetchApi, fetchLocalHtml } from "./scrape/fetch";

const DATA_DIR = join(import.meta.dirname, "../../../miscellaneous/data");

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function writeJson(filePath: string, data: unknown) {
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`  Wrote ${filePath}`);
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

async function runScrapeLocal() {
  console.log("\n[scrape] Fetching local HTML...");

  const [exhibitorsHtml, demosHtml, tabletopHtml] = await Promise.all([
    fetchLocalHtml("exhibitors"),
    fetchLocalHtml("demos"),
    fetchLocalHtml("tabletop"),
  ]);

  console.log("[scrape] Parsing HTML...");
  return {
    exhibitors: parseExhibitorPage(exhibitorsHtml, "exhibitors"),
    demos: parseDemoPage(demosHtml),
    tabletop: parseExhibitorPage(tabletopHtml, "tabletop"),
  };
}

async function runScrapeLive() {
  console.log("\n[scrape] Fetching from LeapEvent API...");

  const apiData = await fetchApi();

  console.log("[scrape] Transforming API data...");
  const { exhibitors, tabletop } = transformExhibitors(apiData.exhibitors);
  const demos = transformDemos(apiData.specials);

  return { exhibitors, demos, tabletop };
}

async function runScrape(source: "local" | "live") {
  const { exhibitors, demos, tabletop } =
    source === "live" ? await runScrapeLive() : await runScrapeLocal();

  console.log(`  Exhibitors: ${exhibitors.length}`);
  console.log(`  Demos: ${demos.length}`);
  console.log(`  Tabletop: ${tabletop.length}`);

  const outDir = join(DATA_DIR, "01-scraped");
  await ensureDir(outDir);
  await Promise.all([
    writeJson(join(outDir, "exhibitors.json"), exhibitors),
    writeJson(join(outDir, "demos.json"), demos),
    writeJson(join(outDir, "tabletop.json"), tabletop),
  ]);

  console.log("[scrape] Done.");
}

async function runHarmonize() {
  console.log("\n[harmonize] Loading scraped data...");

  const scrapedDir = join(DATA_DIR, "01-scraped");
  const [exhibitors, demos, tabletop] = await Promise.all([
    Bun.file(join(scrapedDir, "exhibitors.json")).json(),
    Bun.file(join(scrapedDir, "demos.json")).json(),
    Bun.file(join(scrapedDir, "tabletop.json")).json(),
  ]);

  console.log("[harmonize] Merging...");
  const result = harmonize(exhibitors, tabletop, demos);

  console.log(`  Exhibitors: ${result.exhibitors.length}`);
  console.log(`  Games (demo-sourced): ${result.games.length}`);
  console.log(`  Unmatched demos: ${result.unmatched.length}`);

  // Exhibitor breakdown
  const withDemos = result.exhibitors.filter((e) => e.demoCount > 0).length;
  const withoutDemos = result.exhibitors.length - withDemos;
  console.log(`  Exhibitors with demos: ${withDemos}`);
  console.log(`  Exhibitors without demos (awaiting discovery): ${withoutDemos}`);

  // Game type breakdown
  const byType = { video_game: 0, tabletop: 0, both: 0 };
  for (const g of result.games) byType[g.type]++;
  console.log(`  Games by type: ${JSON.stringify(byType)}`);

  const outDir = join(DATA_DIR, "02-harmonized");
  await ensureDir(outDir);
  await Promise.all([
    writeJson(join(outDir, "exhibitors.json"), result.exhibitors),
    writeJson(join(outDir, "games.json"), result.games),
  ]);
  if (result.unmatched.length > 0) {
    await writeJson(join(outDir, "unmatched.json"), result.unmatched);
  }

  console.log("[harmonize] Done.");
}

async function runDiscover(skipCache: boolean, webSearch: boolean, tier3Limit?: number) {
  console.log("\n[discover] Loading harmonized data...");

  const harmonizedDir = join(DATA_DIR, "02-harmonized");
  const prevGamesPath = join(harmonizedDir, "games.prev.json");
  const [exhibitors, allGames] = await Promise.all([
    Bun.file(join(harmonizedDir, "exhibitors.json")).json(),
    Bun.file(join(harmonizedDir, "games.json")).json(),
  ]);

  // Only pass demo-sourced games to discover — previously discovered games
  // are rebuilt fresh each run, so including them would cause duplicates.
  const demoGames = (allGames as HarmonizedGame[]).filter((g) => g.demoId !== null);

  // Reconcile: compare fresh demo games against previous discover output
  // to detect promotions (discovered → demo) and carry forward orphans.
  let reconciledGames = demoGames;
  const prevFile = Bun.file(prevGamesPath);
  if (await prevFile.exists()) {
    console.log("\n[reconcile] Previous games snapshot found, running reconciliation...");
    const previousGames: HarmonizedGame[] = await prevFile.json();

    const reconciled = await reconcileWithCaches(demoGames, previousGames, {
      enrichCacheDirs: {
        bgg: join(DATA_DIR, "cache/enrich/bgg"),
        web: join(DATA_DIR, "cache/enrich/web"),
        steam: join(DATA_DIR, "cache/enrich/steam"),
      },
    });

    reconciledGames = reconciled.games;

    console.log(`  Previous discovered games: ${reconciled.stats.previousDiscoveredGames}`);
    console.log(`  Promoted (discovered → demo): ${reconciled.stats.promoted}`);
    console.log(`  Orphaned (carried forward): ${reconciled.stats.orphaned}`);
    console.log(`  Regenerated (discover will rebuild): ${reconciled.stats.regenerated}`);
    console.log(`  Enrich caches migrated: ${reconciled.stats.cachesMigrated}`);

    if (reconciled.promotions.length > 0) {
      console.log("  Promotions:");
      for (const p of reconciled.promotions) {
        console.log(`    ${p.gameName}: ${p.oldId} → ${p.newId}`);
      }
    }

    // Save reconciliation report
    await writeJson(join(harmonizedDir, "reconciliation.json"), {
      promotions: reconciled.promotions,
      orphanedDiscoveries: reconciled.orphanedDiscoveries.map((o) => ({
        id: o.game.id,
        name: o.game.name,
        exhibitorId: o.game.exhibitorId,
        reason: o.reason,
      })),
      stats: reconciled.stats,
    });
  } else {
    console.log("\n[reconcile] No previous games snapshot — skipping reconciliation (first run).");
  }

  const cacheDir = join(DATA_DIR, "cache/discover/tier2");
  const tier3CacheDir = join(DATA_DIR, "cache/discover/tier3");
  const result = await discover(exhibitors, reconciledGames, {
    cacheDir,
    tier3CacheDir,
    skipCache,
    webSearch,
    tier3Limit,
  });

  console.log(`  Total games (demo + discovered): ${result.games.length}`);
  console.log(`  Stats: ${JSON.stringify(result.stats)}`);

  await ensureDir(harmonizedDir);

  // Save current games as snapshot for next reconciliation run
  await writeJson(prevGamesPath, result.games);

  await Promise.all([
    writeJson(join(harmonizedDir, "exhibitors.json"), result.exhibitors),
    writeJson(join(harmonizedDir, "games.json"), result.games),
    writeJson(join(harmonizedDir, "discovery.json"), result.discoveries),
  ]);

  console.log("[discover] Done.");
}

async function runEnrich(skipCache: boolean, limit?: number, minTier?: string) {
  console.log("\n[enrich] Loading harmonized data...");

  const harmonizedDir = join(DATA_DIR, "02-harmonized");
  const games = await Bun.file(join(harmonizedDir, "games.json")).json();

  console.log(`  Games to enrich: ${games.length}`);

  const result = await enrich(games, {
    bggCacheDir: join(DATA_DIR, "cache/enrich/bgg"),
    webCacheDir: join(DATA_DIR, "cache/enrich/web"),
    steamCacheDir: join(DATA_DIR, "cache/enrich/steam"),
    skipCache,
    limit,
    minInclusionTier: minTier as InclusionTier | undefined,
  });

  console.log(`  Stats: ${JSON.stringify(result.stats)}`);

  const outDir = join(DATA_DIR, "03-enriched");
  await ensureDir(outDir);
  await Promise.all([
    writeJson(join(outDir, "games.json"), result.games),
    writeJson(join(outDir, "enrichment-meta.json"), result.enrichmentMeta),
  ]);

  console.log("[enrich] Done.");
}

async function runClassify(skipCache: boolean, limit?: number) {
  console.log("\n[classify] Loading enriched data...");

  const enrichedDir = join(DATA_DIR, "03-enriched");
  const [games, enrichmentMeta] = await Promise.all([
    Bun.file(join(enrichedDir, "games.json")).json() as Promise<HarmonizedGame[]>,
    Bun.file(join(enrichedDir, "enrichment-meta.json")).json() as Promise<EnrichmentMeta[]>,
  ]);

  console.log(`  Games to classify: ${games.length}`);
  console.log(`  Enrichment meta records: ${enrichmentMeta.length}`);

  const result = await classify(games, enrichmentMeta, {
    cacheDir: join(DATA_DIR, "cache/classify"),
    skipCache,
    limit,
  });

  console.log(`  Stats: ${JSON.stringify(result.stats)}`);

  const outDir = join(DATA_DIR, "04-classified");
  await ensureDir(outDir);

  // Serialize classifications as a JSON object keyed by game ID
  const classificationsObj: Record<string, unknown> = {};
  for (const [id, cls] of result.classifications) {
    classificationsObj[id] = cls;
  }

  await Promise.all([
    writeJson(join(outDir, "games.json"), result.games),
    writeJson(join(outDir, "classifications.json"), classificationsObj),
  ]);

  console.log("[classify] Done.");
}

async function runEmbed(skipCache: boolean, limit?: number) {
  console.log("\n[embed] Loading classified data...");

  const classifiedDir = join(DATA_DIR, "04-classified");
  const enrichedDir = join(DATA_DIR, "03-enriched");
  const [games, enrichmentMeta, classificationsObj] = await Promise.all([
    Bun.file(join(classifiedDir, "games.json")).json() as Promise<HarmonizedGame[]>,
    Bun.file(join(enrichedDir, "enrichment-meta.json")).json() as Promise<EnrichmentMeta[]>,
    Bun.file(join(classifiedDir, "classifications.json")).json() as Promise<
      Record<string, GameClassification>
    >,
  ]);

  // Rebuild Map from serialized object
  const classifications = new Map<string, GameClassification>(Object.entries(classificationsObj));

  console.log(`  Games to embed: ${games.length}`);
  console.log(`  Classifications: ${classifications.size}`);

  const result = await embed(games, enrichmentMeta, classifications, {
    cacheDir: join(DATA_DIR, "cache/embed"),
    skipCache,
    limit,
  });

  console.log(`  Stats: ${JSON.stringify(result.stats)}`);

  const outDir = join(DATA_DIR, "05-embedded");
  await ensureDir(outDir);
  await writeJson(join(outDir, "games.json"), result.games);

  console.log("[embed] Done.");
}

async function runDedup() {
  console.log("\n[dedup] Loading embedded games...");

  const embeddedDir = join(DATA_DIR, "05-embedded");
  const games = (await Bun.file(join(embeddedDir, "games.json")).json()) as Game[];

  console.log(`  Games before dedup: ${games.length}`);

  const result = dedup(games);

  console.log(`  Games after dedup: ${result.games.length}`);
  console.log(`  Duplicates removed: ${result.stats.duplicatesRemoved}`);

  if (result.stats.merged.length > 0) {
    console.log("  Merged:");
    for (const m of result.stats.merged) {
      console.log(`    "${m.name}": kept ${m.kept}, removed ${m.removed.join(", ")}`);
    }
  }

  const outDir = join(DATA_DIR, "05-embedded");
  await writeJson(join(outDir, "games.json"), result.games);

  console.log("[dedup] Done.");
}

const VECTOR_BUCKET_NAME = process.env.VECTOR_BUCKET_NAME ?? "pax-pal-vectors-production";
const VECTOR_INDEX_NAME = process.env.VECTOR_INDEX_NAME ?? "game-embeddings";

async function runSetupVectors() {
  console.log("\n[setup-vectors] Ensuring S3 Vectors bucket and index exist...");

  const result = await setupVectors({
    bucketName: VECTOR_BUCKET_NAME,
    indexName: VECTOR_INDEX_NAME,
  });

  console.log(`  Index ARN: ${result.indexArn}`);
  console.log(`[setup-vectors] Done.${result.created ? " (created)" : " (already existed)"}`);
  return result;
}

async function resolveTableNames(): Promise<{
  gamesTableName: string;
  exhibitorsTableName: string;
}> {
  // Try SST Resource first (available when run via `sst shell`)
  try {
    const { Resource } = await import("sst");
    const r = Resource as unknown as Record<string, { name: string }>;
    const games = r.Games?.name;
    const exhibitors = r.Exhibitors?.name;
    if (games && exhibitors) {
      console.log("  Resolved table names from SST resources.");
      return { gamesTableName: games, exhibitorsTableName: exhibitors };
    }
  } catch {
    // Not running in sst shell — fall through to env vars
  }

  // Fall back to env vars
  const gamesTableName = process.env.GAMES_TABLE_NAME;
  const exhibitorsTableName = process.env.EXHIBITORS_TABLE_NAME;
  if (gamesTableName && exhibitorsTableName) {
    return { gamesTableName, exhibitorsTableName };
  }

  console.error("Cannot resolve DynamoDB table names.");
  console.error("Either run via: bunx sst shell -- bun run --filter data-pipeline load");
  console.error("Or set env vars: GAMES_TABLE_NAME, EXHIBITORS_TABLE_NAME");
  process.exit(1);
}

async function runLoad(dryRun: boolean) {
  console.log("\n[load] Loading embedded games and exhibitors...");

  const { gamesTableName, exhibitorsTableName } = await resolveTableNames();

  // Auto-setup vectors (idempotent)
  const vectors = await runSetupVectors();

  const [games, exhibitors] = await Promise.all([
    Bun.file(join(DATA_DIR, "05-embedded/games.json")).json() as Promise<Game[]>,
    Bun.file(join(DATA_DIR, "02-harmonized/exhibitors.json")).json() as Promise<
      HarmonizedExhibitor[]
    >,
  ]);

  console.log(`  Games: ${games.length}`);
  console.log(`  Exhibitors: ${exhibitors.length}`);

  const result = await load(games, exhibitors, {
    gamesTableName,
    exhibitorsTableName,
    vectorIndexArn: vectors.indexArn,
    dryRun,
  });

  console.log(
    `  Games: ${result.stats.games.written} written, ${result.stats.games.errors} errors`,
  );
  console.log(
    `  Exhibitors: ${result.stats.exhibitors.written} written, ${result.stats.exhibitors.errors} errors`,
  );
  console.log(
    `  Vectors: ${result.stats.vectors.written} written, ${result.stats.vectors.skipped} skipped (no embedding), ${result.stats.vectors.errors} errors`,
  );

  console.log("[load] Done.");
}

const IMAGES_DIR = join(import.meta.dirname, "../../../miscellaneous/images");
const MAP_OUT_DIR = join(DATA_DIR, "06-map");

async function runMap() {
  console.log("\n[map] Running booth data pipeline...");

  const imagePath = join(IMAGES_DIR, "expo-hall-map.jpg");
  const imageFile = Bun.file(imagePath);
  if (!(await imageFile.exists())) {
    console.error(`  Map image not found: ${imagePath}`);
    process.exit(1);
  }

  // Load game data to extract booth IDs for validation
  const gamesPath = join(DATA_DIR, "05-embedded/games.json");
  const gamesFile = Bun.file(gamesPath);
  let gameBoothIds: string[] = [];
  if (await gamesFile.exists()) {
    const games = (await gamesFile.json()) as Array<{ boothId?: string | null }>;
    gameBoothIds = games.map((g) => g.boothId).filter((id): id is string => id != null);
    console.log(`  Loaded ${gameBoothIds.length} booth IDs from game data for validation.`);
  } else {
    console.warn(`  Game data not found at ${gamesPath} — skipping validation.`);
  }

  // Load manual overrides if they exist
  let overrides: BoothMap = {};
  const overridesPath = join(MAP_OUT_DIR, "booths-overrides.json");
  const overridesFile = Bun.file(overridesPath);
  if (await overridesFile.exists()) {
    overrides = (await overridesFile.json()) as BoothMap;
    console.log(`  Loaded ${Object.keys(overrides).length} manual overrides.`);
  }

  const cacheDir = join(DATA_DIR, "cache/map");
  const result = await map({ imagePath, gameBoothIds, overrides, cacheDir });

  await ensureDir(MAP_OUT_DIR);
  await writeJson(join(MAP_OUT_DIR, "booths.json"), result.booths);
  await writeJson(join(MAP_OUT_DIR, "map-stats.json"), result.stats);

  console.log(`  Final: ${result.stats.finalBooths} booths`);
  console.log("[map] Done.");
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const STAGES = [
  "scrape",
  "harmonize",
  "discover",
  "enrich",
  "classify",
  "embed",
  "dedup",
  "setup-vectors",
  "load",
  "map",
  "all",
] as const;
type Stage = (typeof STAGES)[number];

function printUsage() {
  console.log(
    "Usage: bun run src/cli.ts <stage> [--source local|live] [--skip-cache] [--web-search] [--limit N] [--min-tier confirmed|high|medium|low] [--dry-run]",
  );
  console.log(`Stages: ${STAGES.join(", ")}`);
}

async function main() {
  const args = process.argv.slice(2);
  const stage = args[0] as Stage | undefined;

  if (!stage || !STAGES.includes(stage)) {
    printUsage();
    process.exit(1);
  }

  const sourceIdx = args.indexOf("--source");
  const source = sourceIdx >= 0 ? (args[sourceIdx + 1] as "local" | "live") : "local";
  const skipCache = args.includes("--skip-cache");
  const webSearch = args.includes("--web-search");
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const tier3Limit = limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1], 10) : undefined;
  const minTierIdx = args.indexOf("--min-tier");
  const minTier = minTierIdx >= 0 ? args[minTierIdx + 1] : undefined;

  if (stage === "scrape" || stage === "all") {
    await runScrape(source);
  }

  if (stage === "harmonize" || stage === "all") {
    await runHarmonize();
  }

  if (stage === "discover" || stage === "all") {
    await runDiscover(skipCache, webSearch, tier3Limit);
  }

  if (stage === "enrich" || stage === "all") {
    await runEnrich(skipCache, tier3Limit, minTier);
  }

  if (stage === "classify" || stage === "all") {
    await runClassify(skipCache, tier3Limit);
  }

  if (stage === "embed" || stage === "all") {
    await runEmbed(skipCache, tier3Limit);
  }

  if (stage === "dedup" || stage === "all") {
    await runDedup();
  }

  if (stage === "setup-vectors") {
    await runSetupVectors();
  }

  if (stage === "load" || stage === "all") {
    await runLoad(dryRun);
  }

  if (stage === "map") {
    await runMap();
  }

  console.log("\nPipeline complete.");
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
