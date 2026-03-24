import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import type { Game, HarmonizedGame, PressLink, SocialLinks } from "@pax-pal/core";
import { SingleBar } from "cli-progress";
import { buildTags } from "../classify/classify";
import type { GameClassification } from "../classify/types";
import type { EnrichmentMeta } from "../enrich/types";
import type { CachedEmbedding, EmbedStats } from "./types";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EmbedOptions {
  cacheDir?: string;
  skipCache?: boolean;
  limit?: number;
  /** @internal — override for testing */
  _embedBatch?: typeof embedBatch;
}

export interface EmbedResult {
  games: Game[];
  stats: EmbedStats;
}

// ---------------------------------------------------------------------------
// Embedding text builder
// ---------------------------------------------------------------------------

export function buildEmbeddingText(
  game: HarmonizedGame,
  meta: EnrichmentMeta | null,
  classification: GameClassification | null,
): string {
  const parts: string[] = [game.name];

  // Prefer web summary, fall back to description
  const summary = meta?.web?.summary;
  const description = game.description;
  if (summary) parts.push(summary);
  if (description && description !== summary) parts.push(description);

  // Classification labels
  if (classification?.genres && classification.genres.length > 0) {
    parts.push(`Genres: ${classification.genres.join(", ")}`);
  }
  if (classification?.tabletopGenres && classification.tabletopGenres.length > 0) {
    parts.push(`Tabletop genres: ${classification.tabletopGenres.join(", ")}`);
  }
  if (classification?.mechanics && classification.mechanics.length > 0) {
    parts.push(`Mechanics: ${classification.mechanics.join(", ")}`);
  }

  if (game.paxTags.length > 0) {
    parts.push(`Tags: ${game.paxTags.join(", ")}`);
  }

  parts.push(`Type: ${game.type}`);

  if (game.exhibitor) {
    parts.push(`By: ${game.exhibitor}`);
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Text hashing for cache invalidation
// ---------------------------------------------------------------------------

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Gemini embedding API
// ---------------------------------------------------------------------------

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required for embedding");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.embedContent({
    model: "gemini-embedding-2-preview",
    contents: texts,
  });

  if (!response.embeddings) {
    throw new Error("No embeddings returned from Gemini API");
  }

  return response.embeddings.map((e) => e.values ?? []);
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

async function loadCachedEmbedding(
  cacheDir: string,
  gameId: string,
): Promise<CachedEmbedding | null> {
  try {
    const data = await readFile(join(cacheDir, `${gameId}.json`), "utf-8");
    return JSON.parse(data) as CachedEmbedding;
  } catch {
    return null;
  }
}

async function saveCachedEmbedding(cacheDir: string, gameId: string, cached: CachedEmbedding) {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(join(cacheDir, `${gameId}.json`), JSON.stringify(cached), "utf-8");
}

// ---------------------------------------------------------------------------
// Game assembly: HarmonizedGame + EnrichmentMeta + Classification → Game
// ---------------------------------------------------------------------------

export function assembleGame(
  game: HarmonizedGame,
  meta: EnrichmentMeta | null,
  classification: GameClassification | null,
  embedding: number[] | null,
): Game {
  // Merge enrichment data
  const web = meta?.web ?? null;
  const bgg = meta?.bgg ?? null;
  const steam = meta?.steam ?? null;

  // Collect media URLs (screenshots + trailers)
  const mediaUrls: string[] = [];
  if (web?.screenshotUrls) mediaUrls.push(...web.screenshotUrls);
  if (web?.trailerUrl) mediaUrls.push(web.trailerUrl);
  if (steam?.screenshots) mediaUrls.push(...steam.screenshots);
  if (steam?.movies) mediaUrls.push(...steam.movies);

  // Build press links
  const pressLinks: PressLink[] = web?.pressLinks ?? [];

  // Build social links
  const socialLinks: SocialLinks = web?.socialLinks ?? {
    twitter: null,
    discord: null,
    youtube: null,
    itchIo: null,
  };

  // Pick best image: Steam header > web image > BGG image > original
  const imageUrl = steam?.headerImage ?? web?.imageUrl ?? bgg?.imageUrl ?? game.imageUrl;

  // Pick best description: web > BGG > original
  const description = web?.description ?? bgg?.description ?? game.description;

  // Summary from web enrichment
  const summary = web?.summary ?? null;

  // Release status
  const releaseStatus = web?.releaseStatus ?? null;

  // Steam URL and app ID
  const steamUrl = web?.steamUrl ?? null;
  const steamAppId = steam?.steamAppId ?? null;

  // BGG ID
  const bggId = bgg?.bggId ?? null;

  // Tabletop fields (prefer BGG, fall back to web)
  const playerCount = bgg?.playerCount ?? web?.playerCount ?? null;
  const playTime = bgg?.playTime ?? web?.playTime ?? null;
  const complexity = bgg?.complexity ?? null;

  // Developer and price
  const developerName = web?.developerName ?? null;
  const price = steam?.price ?? null;

  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    type: game.type,
    summary,
    description,
    imageUrl,
    mediaUrls,
    exhibitor: game.exhibitor,
    exhibitorId: game.exhibitorId,
    boothId: game.boothLocation,
    showroomUrl: game.showroomUrl,
    tags: classification ? buildTags(classification) : [],
    paxTags: game.paxTags,
    styleTags: classification?.styleTags ?? [],
    isFeatured: game.isFeatured,
    platforms: classification?.platforms ?? null,
    genres: classification?.genres ?? null,
    releaseStatus,
    steamUrl,
    bggId,
    steamAppId,
    pressLinks,
    socialLinks,
    developerName,
    price,
    tabletopGenres: classification?.tabletopGenres ?? null,
    playerCount,
    playTime,
    complexity,
    mechanics: classification?.mechanics ?? null,
    embedding,
    discoverySource: game.discoverySource,
    discoveryMeta: game.discoveryMeta ?? null,
    sourcePages: game.sourcePages,
    lastScrapedAt: game.lastScrapedAt,
    enrichedAt: meta?.enrichedAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

const BATCH_SIZE = 100;

export async function embed(
  games: HarmonizedGame[],
  enrichmentMeta: EnrichmentMeta[],
  classifications: Map<string, GameClassification>,
  options: EmbedOptions = {},
): Promise<EmbedResult> {
  const { cacheDir, skipCache = false, limit, _embedBatch = embedBatch } = options;

  // Build enrichment meta lookup
  const metaByGameId = new Map<string, EnrichmentMeta>();
  for (const m of enrichmentMeta) {
    metaByGameId.set(m.gameId, m);
  }

  // Apply limit
  const gamesToEmbed = limit ? games.slice(0, limit) : games;

  const stats: EmbedStats = {
    totalGames: gamesToEmbed.length,
    embedded: 0,
    cached: 0,
    batches: 0,
  };

  // Build embedding texts and check cache
  const embeddingTexts = new Map<string, string>();
  const cachedEmbeddings = new Map<string, number[]>();
  const uncachedIds: string[] = [];

  for (const game of gamesToEmbed) {
    const meta = metaByGameId.get(game.id) ?? null;
    const cls = classifications.get(game.id) ?? null;
    const text = buildEmbeddingText(game, meta, cls);
    const textHash = hashText(text);
    embeddingTexts.set(game.id, text);

    if (cacheDir && !skipCache) {
      const cached = await loadCachedEmbedding(cacheDir, game.id);
      if (cached && cached.textHash === textHash) {
        cachedEmbeddings.set(game.id, cached.embedding);
        stats.cached++;
        continue;
      }
    }

    uncachedIds.push(game.id);
  }

  // Embed uncached games in batches
  if (uncachedIds.length > 0) {
    const progress = new SingleBar({
      format: "  embed [{bar}] {percentage}% | {value}/{total} games",
      hideCursor: true,
    });
    progress.start(uncachedIds.length, 0);

    for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
      const batchIds = uncachedIds.slice(i, i + BATCH_SIZE);
      const batchTexts = batchIds.map((id) => embeddingTexts.get(id) ?? "");

      const batchEmbeddings = await _embedBatch(batchTexts);

      for (let j = 0; j < batchIds.length; j++) {
        const id = batchIds[j];
        const emb = batchEmbeddings[j];
        cachedEmbeddings.set(id, emb);
        stats.embedded++;

        if (cacheDir) {
          const textHash = hashText(embeddingTexts.get(id) ?? "");
          await saveCachedEmbedding(cacheDir, id, { embedding: emb, textHash });
        }
      }

      stats.batches++;
      progress.update(Math.min(i + BATCH_SIZE, uncachedIds.length));
    }

    progress.stop();
  }

  // Assemble final Game records
  const assembledGames = gamesToEmbed.map((game) => {
    const meta = metaByGameId.get(game.id) ?? null;
    const cls = classifications.get(game.id) ?? null;
    const emb = cachedEmbeddings.get(game.id) ?? null;
    return assembleGame(game, meta, cls, emb);
  });

  return { games: assembledGames, stats };
}
