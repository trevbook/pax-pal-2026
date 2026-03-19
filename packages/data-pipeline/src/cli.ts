import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { discover } from "./discover/discover";
import { enrich } from "./enrich/enrich";
import { harmonize } from "./harmonize/harmonize";
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
  const [exhibitors, allGames] = await Promise.all([
    Bun.file(join(harmonizedDir, "exhibitors.json")).json(),
    Bun.file(join(harmonizedDir, "games.json")).json(),
  ]);

  // Only pass demo-sourced games to discover — previously discovered games
  // are rebuilt fresh each run, so including them would cause duplicates.
  const demoGames = allGames.filter((g: { demoId: string | null }) => g.demoId !== null);

  const cacheDir = join(DATA_DIR, "cache/discover/tier2");
  const tier3CacheDir = join(DATA_DIR, "cache/discover/tier3");
  const result = await discover(exhibitors, demoGames, {
    cacheDir,
    tier3CacheDir,
    skipCache,
    webSearch,
    tier3Limit,
  });

  console.log(`  Total games (demo + discovered): ${result.games.length}`);
  console.log(`  Stats: ${JSON.stringify(result.stats)}`);

  await ensureDir(harmonizedDir);
  await Promise.all([
    writeJson(join(harmonizedDir, "exhibitors.json"), result.exhibitors),
    writeJson(join(harmonizedDir, "games.json"), result.games),
    writeJson(join(harmonizedDir, "discovery.json"), result.discoveries),
  ]);

  console.log("[discover] Done.");
}

async function runEnrich(skipCache: boolean, limit?: number) {
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

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const STAGES = ["scrape", "harmonize", "discover", "enrich", "all"] as const;
type Stage = (typeof STAGES)[number];

function printUsage() {
  console.log(
    "Usage: bun run src/cli.ts <stage> [--source local|live] [--skip-cache] [--web-search] [--limit N]",
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
  const limitIdx = args.indexOf("--limit");
  const tier3Limit = limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1], 10) : undefined;

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
    await runEnrich(skipCache, tier3Limit);
  }

  console.log("\nPipeline complete.");
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
