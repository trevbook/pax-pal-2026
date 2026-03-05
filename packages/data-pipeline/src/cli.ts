import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { harmonize } from "./harmonize/harmonize";
import { parseDemoPage } from "./scrape/demos";
import { parseExhibitorPage } from "./scrape/exhibitors";
import { fetchHtml } from "./scrape/fetch-html";

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

async function runScrape(source: "local" | "live") {
  console.log(`\n[scrape] Fetching HTML (source: ${source})...`);

  const [exhibitorsHtml, demosHtml, tabletopHtml] = await Promise.all([
    fetchHtml("exhibitors", source),
    fetchHtml("demos", source),
    fetchHtml("tabletop", source),
  ]);

  console.log("[scrape] Parsing...");
  const exhibitors = parseExhibitorPage(exhibitorsHtml, "exhibitors");
  const demos = parseDemoPage(demosHtml);
  const tabletop = parseExhibitorPage(tabletopHtml, "tabletop");

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

  console.log(`  Games: ${result.games.length}`);
  console.log(`  Unmatched demos: ${result.unmatched.length}`);

  // Type breakdown
  const byType = { video_game: 0, tabletop: 0, both: 0 };
  for (const g of result.games) byType[g.type]++;
  console.log(`  By type: ${JSON.stringify(byType)}`);

  const outDir = join(DATA_DIR, "02-harmonized");
  await ensureDir(outDir);
  await writeJson(join(outDir, "games.json"), result.games);
  if (result.unmatched.length > 0) {
    await writeJson(join(outDir, "unmatched.json"), result.unmatched);
  }

  console.log("[harmonize] Done.");
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const STAGES = ["scrape", "harmonize", "all"] as const;
type Stage = (typeof STAGES)[number];

function printUsage() {
  console.log("Usage: bun run src/cli.ts <stage> [--source local|live]");
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

  if (stage === "scrape" || stage === "all") {
    await runScrape(source);
  }

  if (stage === "harmonize" || stage === "all") {
    await runHarmonize();
  }

  console.log("\nPipeline complete.");
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
