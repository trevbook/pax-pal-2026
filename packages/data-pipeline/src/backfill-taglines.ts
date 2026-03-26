/**
 * Backfill taglines into existing web enrichment cache files.
 *
 * Reads each cached web enrichment JSON, sends the game's name + summary/description
 * to the LLM for a 5-7 word tagline, and patches the cache file in place.
 * Also patches enrichment-meta.json so downstream steps (embed, load) pick up the taglines
 * without re-running the full enrich pipeline.
 *
 * Usage (run from repo root):
 *   bun run packages/data-pipeline/src/backfill-taglines.ts [--limit N] [--dry-run]
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import cliProgress from "cli-progress";
import { z } from "zod";

const DATA_DIR = join(import.meta.dirname, "../../../miscellaneous/data");
const WEB_CACHE_DIR = join(DATA_DIR, "cache/enrich/web");
const ENRICHMENT_META_PATH = join(DATA_DIR, "03-enriched/enrichment-meta.json");

const CONCURRENCY = 15;

const taglineSchema = z.object({
  tagline: z
    .string()
    .nullable()
    .describe(
      "A punchy 5-7 word tagline capturing the game's essence (e.g. 'Cozy farming sim with magical creatures')",
    ),
});

// ---------------------------------------------------------------------------
// LLM call
// ---------------------------------------------------------------------------

async function generateTagline(
  gameName: string,
  summary: string | null,
  description: string | null,
): Promise<string | null> {
  const context = summary || description || gameName;

  const { object } = await generateObject({
    model: openai("gpt-5.4-nano"),
    schema: taglineSchema,
    system: `You write ultra-concise game taglines (5-7 words, no period) for a PAX East 2026 companion app. The tagline should instantly communicate what makes the game interesting. Examples: "Cozy farming sim with magical creatures", "Roguelike deckbuilder in a dying world", "Build and race custom hovercrafts", "Tactical mech combat meets chess".`,
    prompt: `Game: ${gameName}\nContext: ${context}\n\nWrite a 5-7 word tagline.`,
  });

  return object.tagline;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1], 10) : undefined;

  // Load all web cache files
  const files = (await readdir(WEB_CACHE_DIR)).filter((f) => f.endsWith(".json"));
  console.log(`[backfill-taglines] Found ${files.length} web cache files.`);

  // Load games.json to find ALL game IDs (including those with no cache file)
  const games: Array<{ id: string; name: string }> = await Bun.file(
    join(DATA_DIR, "03-enriched/games.json"),
  ).json();
  const nameById = new Map(games.map((g) => [g.id, g.name]));
  const cacheFileIds = new Set(files.map((f) => f.replace(".json", "")));

  // Filter to files that don't already have a tagline
  const toProcess: { file: string; gameId: string; data: Record<string, unknown> }[] = [];

  for (const file of files) {
    const raw = await readFile(join(WEB_CACHE_DIR, file), "utf-8");
    const data = JSON.parse(raw);

    // Skip if tagline already exists (non-null entries only)
    if (data?.tagline) continue;

    const gameId = file.replace(".json", "");
    // For null cache entries, use an empty object so we can still generate a name-only tagline
    toProcess.push({ file, gameId, data: data ?? {} });
  }

  // Add games that have no cache file at all (never web-enriched)
  for (const game of games) {
    if (!cacheFileIds.has(game.id)) {
      const file = `${game.id}.json`;
      toProcess.push({ file, gameId: game.id, data: {} });
    }
  }

  const total = limit ? Math.min(limit, toProcess.length) : toProcess.length;
  const batch = toProcess.slice(0, total);

  console.log(`[backfill-taglines] ${toProcess.length} need taglines, processing ${total}.`);
  if (dryRun) console.log("[backfill-taglines] DRY RUN — no files will be written.");

  const bar = new cliProgress.SingleBar({
    format: "[backfill-taglines] {bar} {percentage}% | {value}/{total} | ETA: {eta_formatted}",
    hideCursor: true,
  });
  bar.start(total, 0);

  let generated = 0;
  let skipped = 0;
  let nextIndex = 0;

  async function processNext(): Promise<void> {
    while (nextIndex < batch.length) {
      const i = nextIndex++;
      const { file, gameId, data } = batch[i];
      const gameName = nameById.get(gameId) ?? gameId;

      try {
        const tagline = await generateTagline(
          gameName,
          (data.summary as string) ?? null,
          (data.description as string) ?? null,
        );

        data.tagline = tagline;
        generated++;

        if (!dryRun) {
          await writeFile(join(WEB_CACHE_DIR, file), JSON.stringify(data, null, 2), "utf-8");
        }
      } catch (error) {
        console.error(`\n  Error for ${gameName}: ${error}`);
        skipped++;
      }

      bar.increment();
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, batch.length) }, () => processNext());
  await Promise.all(workers);
  bar.stop();

  console.log(`\n[backfill-taglines] Generated: ${generated}, Skipped: ${skipped}`);

  // Patch enrichment-meta.json so embed picks up taglines without re-running enrich
  if (!dryRun) {
    console.log("[backfill-taglines] Patching enrichment-meta.json...");
    const metaRaw = await readFile(ENRICHMENT_META_PATH, "utf-8");
    const meta: Array<{ gameId: string; web: Record<string, unknown> | null }> =
      JSON.parse(metaRaw);

    // Build tagline lookup from what we just generated
    const taglineByGameId = new Map<string, string | null>();
    for (const { gameId, data } of batch) {
      if (data.tagline !== undefined) {
        taglineByGameId.set(gameId, data.tagline as string | null);
      }
    }

    let patched = 0;
    for (const entry of meta) {
      const tagline = taglineByGameId.get(entry.gameId);
      if (tagline !== undefined) {
        if (entry.web) {
          entry.web.tagline = tagline;
        } else {
          entry.web = { tagline } as Record<string, unknown>;
        }
        patched++;
      }
    }

    await writeFile(ENRICHMENT_META_PATH, JSON.stringify(meta, null, 2), "utf-8");
    console.log(`[backfill-taglines] Patched ${patched} enrichment-meta entries.`);
  }

  console.log("[backfill-taglines] Done.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
