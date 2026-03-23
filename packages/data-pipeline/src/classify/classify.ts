import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openai } from "@ai-sdk/openai";
import type { HarmonizedGame, Tag } from "@pax-pal/core";
import {
  ALL_TAGS,
  AUDIENCE_TAGS,
  BUSINESS_TAGS,
  PLATFORMS,
  STYLE_TAGS,
  TABLETOP_GENRES,
  TABLETOP_MECHANICS,
  VIDEO_GAME_GENRES,
} from "@pax-pal/core";
import { generateObject } from "ai";
import { SingleBar } from "cli-progress";
import type { EnrichmentMeta } from "../enrich/types";
import type { ClassifyStats, GameClassification } from "./types";
import { gameClassificationSchema } from "./types";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ClassifyOptions {
  cacheDir?: string;
  skipCache?: boolean;
  limit?: number;
  concurrency?: number;
  /** @internal — override for testing */
  _classifyOne?: typeof classifyOne;
}

export interface ClassifyResult {
  games: HarmonizedGame[];
  classifications: Map<string, GameClassification>;
  stats: ClassifyStats;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a game classification assistant for PAX East 2026. Given game metadata, assign taxonomy labels from the provided categories.

## Taxonomy Reference

VIDEO_GAME_GENRES (for video_game or both): ${JSON.stringify(VIDEO_GAME_GENRES)}
TABLETOP_GENRES (for tabletop or both): ${JSON.stringify(TABLETOP_GENRES)}
TABLETOP_MECHANICS (for tabletop or both): ${JSON.stringify(TABLETOP_MECHANICS)}
AUDIENCE_TAGS: ${JSON.stringify(AUDIENCE_TAGS)}
BUSINESS_TAGS: ${JSON.stringify(BUSINESS_TAGS)}
STYLE_TAGS: ${JSON.stringify(STYLE_TAGS)}
PLATFORMS (for video_game or both): ${JSON.stringify(PLATFORMS)}

## paxTag Mapping Hints

These PAX site tags map to taxonomy values:
- "Action" → genre Action
- "Adventure" → genre Adventure
- "Fighting" → genre Fighting
- "Horror/Survival" → genre Horror AND/OR genre Survival (pick based on description)
- "Platformer" → genre Platformer
- "Puzzle" → genre Puzzle
- "Roguelike" → genre Roguelike
- "RPG" → genre RPG
- "JRPG" → genre JRPG
- "Shooter" → genre Shooter
- "Strategy" → genre Strategy
- "MMO" → genre MMO
- "Deck Builder" → mechanic Deck-Builder
- "Dice" → mechanic Dice
- "CCG" → mechanic CCG
- "Single Player" → audienceTag Single-Player
- "Multiplayer" → audienceTag Multiplayer
- "Co-op" → audienceTag Co-op
- "Family Friendly" → audienceTag Family-Friendly
- "PAX Together" → audienceTag PAX Together
- "Free to Play" → businessTag Free-to-Play
- "Early Access/Demo" → businessTag Early Access Demo
- "Indie" → businessTag Indie
- "Retail" → businessTag Retail
- "Retro" → styleTag Retro
- "Sandbox" → styleTag Sandbox
- "PC" → platform PC
- "PlayStation" → platform PlayStation
- "Xbox" → platform Xbox
- "Nintendo Switch" → platform Switch
- "Mobile" → platform Mobile
- "VR" → platform VR

## Rules

1. Assign 1-4 genres per game based on the description and enrichment data. Use paxTags as hints, but DO NOT blindly copy them — paxTags are often inherited from the exhibitor and may not apply to this specific game.
2. For video_game or both: fill genres and platforms. Set tabletopGenres/mechanics to null.
3. For tabletop or both: fill tabletopGenres and mechanics. Set genres/platforms to null for tabletop-only.
4. For type "both": fill ALL fields (genres, platforms, tabletopGenres, mechanics).
5. Use enrichment data (web genres, BGG mechanics, Steam genres) as additional signal — these are game-specific and more reliable than paxTags.
6. styleTags are cross-cutting modifiers. ONLY assign them when the game's description or enrichment data clearly supports it: "Retro" = explicitly retro/classic aesthetic, "Pixel Art" = uses pixel art graphics, "Cozy" = explicitly relaxing/wholesome tone, "Narrative-Driven" = story is the primary focus, "Sandbox" = open-ended creative gameplay is a core feature, "Open World" = large explorable open world. Do NOT assign these just because a paxTag exists — many games share exhibitor-level paxTags that don't apply to the specific game.
7. If no description is available, classify based on paxTags and game type alone, but be conservative with styleTags.
8. Ignore paxTags "Expo Hall", "Tabletop", "Peripherals", "First Person", "Third Person", "Notebook/Laptop", "Merch", "Apparel", "Components" — these are not relevant to game classification.
9. Keep audienceTags and businessTags conservative — only assign what the data clearly supports. Not every game is "Family-Friendly" or "Indie".`;

// ---------------------------------------------------------------------------
// Per-game prompt builder
// ---------------------------------------------------------------------------

export interface GameContext {
  game: HarmonizedGame;
  meta: EnrichmentMeta | null;
}

export function buildGamePrompt(ctx: GameContext): string {
  const { game, meta } = ctx;
  const parts: string[] = [`Game ID: ${game.id}`, `Name: ${game.name}`, `Type: ${game.type}`];

  // Filter out paxTags that map to style tags or non-classification values —
  // these are often inherited from the exhibitor, not game-specific.
  const FILTERED_PAX_TAGS = new Set([
    "Retro",
    "Sandbox",
    "Expo Hall",
    "Tabletop",
    "Peripherals",
    "First Person",
    "Third Person",
    "Notebook/Laptop",
    "Merch",
    "Apparel",
    "Components",
  ]);
  const filteredTags = game.paxTags.filter((t) => !FILTERED_PAX_TAGS.has(t));
  if (filteredTags.length > 0) {
    parts.push(`PAX Tags: ${filteredTags.join(", ")}`);
  }

  const desc = game.description?.slice(0, 500);
  if (desc) {
    parts.push(`Description: ${desc}`);
  } else {
    parts.push("Description: (none available)");
  }

  // Enrichment signals
  if (meta?.web) {
    if (meta.web.genres.length > 0) {
      parts.push(`Web genres: ${meta.web.genres.join(", ")}`);
    }
    if (meta.web.mechanics.length > 0) {
      parts.push(`Web mechanics: ${meta.web.mechanics.join(", ")}`);
    }
    if (meta.web.platforms.length > 0) {
      parts.push(`Web platforms: ${meta.web.platforms.join(", ")}`);
    }
  }

  if (meta?.bgg?.mechanics && meta.bgg.mechanics.length > 0) {
    parts.push(`BGG mechanics: ${meta.bgg.mechanics.join(", ")}`);
  }

  if (meta?.steam) {
    if (meta.steam.genres.length > 0) {
      parts.push(`Steam genres: ${meta.steam.genres.join(", ")}`);
    }
    if (meta.steam.categories.length > 0) {
      parts.push(`Steam categories: ${meta.steam.categories.join(", ")}`);
    }
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Single-game LLM classification
// ---------------------------------------------------------------------------

export async function classifyOne(ctx: GameContext): Promise<GameClassification> {
  const { object } = await generateObject({
    model: openai("gpt-5.4-nano"),
    schema: gameClassificationSchema,
    system: SYSTEM_PROMPT,
    prompt: `Classify this game:\n\n${buildGamePrompt(ctx)}`,
  });
  return object;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

async function loadCache(cacheDir: string, gameId: string): Promise<GameClassification | null> {
  try {
    const data = await readFile(join(cacheDir, `${gameId}.json`), "utf-8");
    return JSON.parse(data) as GameClassification;
  } catch {
    return null;
  }
}

async function saveCache(cacheDir: string, gameId: string, classification: GameClassification) {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(
    join(cacheDir, `${gameId}.json`),
    JSON.stringify(classification, null, 2),
    "utf-8",
  );
}

// ---------------------------------------------------------------------------
// Build unified tags array from classification
// ---------------------------------------------------------------------------

export function buildTags(classification: GameClassification): Tag[] {
  const candidates: string[] = [
    ...(classification.genres ?? []),
    ...(classification.tabletopGenres ?? []),
    ...(classification.mechanics ?? []),
    ...classification.audienceTags,
    ...classification.businessTags,
    ...classification.styleTags,
  ];
  const allowed: readonly string[] = ALL_TAGS;
  return candidates.filter((t): t is Tag => allowed.includes(t));
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

const DEFAULT_CONCURRENCY = 10;

export async function classify(
  games: HarmonizedGame[],
  enrichmentMeta: EnrichmentMeta[],
  options: ClassifyOptions = {},
): Promise<ClassifyResult> {
  const {
    cacheDir,
    skipCache = false,
    limit,
    concurrency = DEFAULT_CONCURRENCY,
    _classifyOne: classifyFn = classifyOne,
  } = options;

  // Build enrichment meta lookup
  const metaByGameId = new Map<string, EnrichmentMeta>();
  for (const m of enrichmentMeta) {
    metaByGameId.set(m.gameId, m);
  }

  // Apply limit
  const gamesToClassify = limit ? games.slice(0, limit) : games;

  const stats: ClassifyStats = {
    totalGames: gamesToClassify.length,
    classified: 0,
    cached: 0,
    batches: 0,
  };

  const allClassifications = new Map<string, GameClassification>();

  // Check cache first
  const uncached: GameContext[] = [];
  for (const game of gamesToClassify) {
    if (cacheDir && !skipCache) {
      const cached = await loadCache(cacheDir, game.id);
      if (cached) {
        allClassifications.set(game.id, cached);
        stats.cached++;
        continue;
      }
    }
    uncached.push({ game, meta: metaByGameId.get(game.id) ?? null });
  }

  // Classify uncached games with concurrent individual calls
  if (uncached.length > 0) {
    const progress = new SingleBar({
      format: "  classify [{bar}] {percentage}% | {value}/{total} games",
      hideCursor: true,
    });
    progress.start(uncached.length, 0);
    let completed = 0;

    // Process in concurrent chunks
    for (let i = 0; i < uncached.length; i += concurrency) {
      const chunk = uncached.slice(i, i + concurrency);

      const results = await Promise.all(
        chunk.map(async (ctx) => {
          const classification = await classifyFn(ctx);
          return { ctx, classification };
        }),
      );

      for (const { ctx, classification } of results) {
        allClassifications.set(ctx.game.id, classification);
        stats.classified++;

        if (cacheDir) {
          await saveCache(cacheDir, ctx.game.id, classification);
        }
      }

      completed += chunk.length;
      stats.batches++;
      progress.update(completed);
    }

    progress.stop();
  }

  return { games: gamesToClassify, classifications: allClassifications, stats };
}
