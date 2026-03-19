import type { HarmonizedGame } from "@pax-pal/core";
import type { BggResult } from "./bgg";
import { runBggEnrichment } from "./bgg";
import type { SteamResult } from "./steam";
import { extractSteamAppId, runSteamEnrichment } from "./steam";
import type {
  BggEnrichment,
  EnrichmentMeta,
  EnrichStats,
  SteamEnrichment,
  WebEnrichment,
} from "./types";
import { validateUrls } from "./validate";
import type { WebResult } from "./web";
import { runWebEnrichment } from "./web";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrichOptions {
  bggCacheDir?: string;
  webCacheDir?: string;
  steamCacheDir?: string;
  skipCache?: boolean;
  limit?: number;
  concurrency?: number;
  /** @internal — override for testing */
  _runBgg?: typeof runBggEnrichment;
  /** @internal — override for testing */
  _runWeb?: typeof runWebEnrichment;
  /** @internal — override for testing */
  _runSteam?: typeof runSteamEnrichment;
  /** @internal — override for testing */
  _validateUrls?: typeof validateUrls;
}

export interface EnrichResult {
  games: HarmonizedGame[];
  enrichmentMeta: EnrichmentMeta[];
  stats: EnrichStats;
}

// ---------------------------------------------------------------------------
// URL collection helpers
// ---------------------------------------------------------------------------

function collectUrls(
  bggResults: Map<string, BggEnrichment | null>,
  webResults: Map<string, WebEnrichment | null>,
  steamResults: Map<string, SteamEnrichment | null>,
): string[] {
  const urls: string[] = [];

  for (const bgg of bggResults.values()) {
    if (bgg?.imageUrl) urls.push(bgg.imageUrl);
  }

  for (const web of webResults.values()) {
    if (!web) continue;
    if (web.imageUrl) urls.push(web.imageUrl);
    if (web.steamUrl) urls.push(web.steamUrl);
    if (web.trailerUrl) urls.push(web.trailerUrl);
    for (const s of web.screenshotUrls) urls.push(s);
    for (const p of web.pressLinks) urls.push(p.url);
    if (web.socialLinks.twitter) urls.push(web.socialLinks.twitter);
    if (web.socialLinks.discord) urls.push(web.socialLinks.discord);
    if (web.socialLinks.youtube) urls.push(web.socialLinks.youtube);
    if (web.socialLinks.itchIo) urls.push(web.socialLinks.itchIo);
  }

  for (const steam of steamResults.values()) {
    if (!steam) continue;
    if (steam.headerImage) urls.push(steam.headerImage);
    for (const s of steam.screenshots) urls.push(s);
    for (const m of steam.movies) urls.push(m);
  }

  return urls;
}

// ---------------------------------------------------------------------------
// URL scrubbing — remove invalid URLs from enrichment data
// ---------------------------------------------------------------------------

function isValid(url: string | null, invalidUrls: Set<string>): string | null {
  if (!url) return null;
  return invalidUrls.has(url) ? null : url;
}

/**
 * Bare-domain social links (e.g. "https://x.com", "https://discord.gg") are
 * useless — the LLM couldn't find an actual profile URL. Null them out.
 */
const BARE_SOCIAL_DOMAINS = new Set([
  "https://x.com",
  "https://x.com/",
  "https://twitter.com",
  "https://twitter.com/",
  "https://www.twitter.com",
  "https://www.twitter.com/",
  "https://discord.gg",
  "https://discord.gg/",
  "https://discord.com",
  "https://discord.com/",
  "https://www.youtube.com",
  "https://www.youtube.com/",
  "https://youtube.com",
  "https://youtube.com/",
  "https://itch.io",
  "https://itch.io/",
]);

export function scrubBareSocialLink(url: string | null): string | null {
  if (!url) return null;
  return BARE_SOCIAL_DOMAINS.has(url) ? null : url;
}

function scrubWebEnrichment(web: WebEnrichment, invalidUrls: Set<string>): WebEnrichment {
  return {
    ...web,
    imageUrl: isValid(web.imageUrl, invalidUrls),
    steamUrl: isValid(web.steamUrl, invalidUrls),
    trailerUrl: isValid(web.trailerUrl, invalidUrls),
    screenshotUrls: web.screenshotUrls.filter((u) => !invalidUrls.has(u)),
    pressLinks: web.pressLinks.filter((p) => !invalidUrls.has(p.url)),
    socialLinks: {
      twitter: scrubBareSocialLink(isValid(web.socialLinks.twitter, invalidUrls)),
      discord: scrubBareSocialLink(isValid(web.socialLinks.discord, invalidUrls)),
      youtube: scrubBareSocialLink(isValid(web.socialLinks.youtube, invalidUrls)),
      itchIo: scrubBareSocialLink(isValid(web.socialLinks.itchIo, invalidUrls)),
    },
  };
}

function scrubBggEnrichment(bgg: BggEnrichment, invalidUrls: Set<string>): BggEnrichment {
  return { ...bgg, imageUrl: isValid(bgg.imageUrl, invalidUrls) };
}

function scrubSteamEnrichment(steam: SteamEnrichment, invalidUrls: Set<string>): SteamEnrichment {
  return {
    ...steam,
    headerImage: isValid(steam.headerImage, invalidUrls),
    screenshots: steam.screenshots.filter((u) => !invalidUrls.has(u)),
    movies: steam.movies.filter((u) => !invalidUrls.has(u)),
  };
}

// ---------------------------------------------------------------------------
// Game enrichment (lightweight fills on HarmonizedGame)
// ---------------------------------------------------------------------------

function applyEnrichment(
  game: HarmonizedGame,
  bgg: BggEnrichment | null,
  web: WebEnrichment | null,
  steam: SteamEnrichment | null,
  invalidUrls: Set<string>,
): HarmonizedGame {
  let enriched = { ...game };

  // Type correction: if BGG matched and game was video_game, it's actually both
  if (bgg && game.type === "video_game") {
    enriched = { ...enriched, type: "both" };
  }

  // Description: BGG > web > existing
  if (!enriched.description || enriched.description.length < 50) {
    if (bgg?.description) {
      enriched = { ...enriched, description: bgg.description };
    } else if (web?.description) {
      enriched = { ...enriched, description: web.description };
    }
  }

  // Image: Steam header > web > BGG > existing (skip invalid URLs)
  if (!enriched.imageUrl) {
    const steamImg = isValid(steam?.headerImage ?? null, invalidUrls);
    const webImg = isValid(web?.imageUrl ?? null, invalidUrls);
    const bggImg = isValid(bgg?.imageUrl ?? null, invalidUrls);

    if (steamImg) {
      enriched = { ...enriched, imageUrl: steamImg };
    } else if (webImg) {
      enriched = { ...enriched, imageUrl: webImg };
    } else if (bggImg) {
      enriched = { ...enriched, imageUrl: bggImg };
    }
  }

  return enriched;
}

// ---------------------------------------------------------------------------
// Build EnrichmentMeta per game
// ---------------------------------------------------------------------------

function collectGameUrls(
  bgg: BggEnrichment | null,
  web: WebEnrichment | null,
  steam: SteamEnrichment | null,
): string[] {
  const urls: string[] = [];
  if (bgg?.imageUrl) urls.push(bgg.imageUrl);
  if (web) {
    if (web.imageUrl) urls.push(web.imageUrl);
    if (web.steamUrl) urls.push(web.steamUrl);
    if (web.trailerUrl) urls.push(web.trailerUrl);
    for (const s of web.screenshotUrls) urls.push(s);
    for (const p of web.pressLinks) urls.push(p.url);
    if (web.socialLinks.twitter) urls.push(web.socialLinks.twitter);
    if (web.socialLinks.discord) urls.push(web.socialLinks.discord);
    if (web.socialLinks.youtube) urls.push(web.socialLinks.youtube);
    if (web.socialLinks.itchIo) urls.push(web.socialLinks.itchIo);
  }
  if (steam) {
    if (steam.headerImage) urls.push(steam.headerImage);
    for (const s of steam.screenshots) urls.push(s);
    for (const m of steam.movies) urls.push(m);
  }
  return urls;
}

function buildMeta(
  gameId: string,
  bgg: BggEnrichment | null,
  web: WebEnrichment | null,
  steam: SteamEnrichment | null,
  validUrlSet: Set<string>,
  invalidUrlSet: Set<string>,
): EnrichmentMeta {
  // Collect raw URLs before scrubbing (for the valid/invalid partition)
  const rawUrls = collectGameUrls(bgg, web, steam);

  // Scrub invalid URLs from the enrichment data stored in the sidecar
  const scrubbedBgg = bgg ? scrubBggEnrichment(bgg, invalidUrlSet) : null;
  const scrubbedWeb = web ? scrubWebEnrichment(web, invalidUrlSet) : null;
  const scrubbedSteam = steam ? scrubSteamEnrichment(steam, invalidUrlSet) : null;

  return {
    gameId,
    bgg: scrubbedBgg,
    web: scrubbedWeb,
    steam: scrubbedSteam,
    validatedUrls: rawUrls.filter((u) => validUrlSet.has(u)),
    invalidUrls: rawUrls.filter((u) => invalidUrlSet.has(u)),
    enrichedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function enrich(
  games: HarmonizedGame[],
  options: EnrichOptions = {},
): Promise<EnrichResult> {
  const {
    bggCacheDir,
    webCacheDir,
    steamCacheDir,
    skipCache = false,
    limit,
    concurrency,
  } = options;

  // Apply limit (random sample)
  let targetGames = games;
  if (limit != null && limit > 0 && limit < games.length) {
    const shuffled = [...games].sort(() => Math.random() - 0.5);
    targetGames = shuffled.slice(0, limit);
    console.log(`[enrich] Limiting to ${limit} random games.`);
  }

  // --- Step 1: BGG enrichment (tabletop/both only) ---
  const tabletopGames = targetGames.filter((g) => g.type === "tabletop" || g.type === "both");

  console.log(`\n[enrich] Step 1: BGG enrichment (${tabletopGames.length} tabletop games)...`);
  const runBgg = options._runBgg ?? runBggEnrichment;
  let bggResult: BggResult;
  if (tabletopGames.length > 0) {
    bggResult = await runBgg(tabletopGames, { cacheDir: bggCacheDir, skipCache });
  } else {
    bggResult = { results: new Map(), cachedCount: 0 };
    console.log("[enrich] No tabletop games, skipping BGG.");
  }

  // --- Step 2: Web search enrichment (skip tabletop with BGG hit) ---
  const bggHitIds = new Set(
    [...bggResult.results.entries()].filter(([_, v]) => v !== null).map(([id]) => id),
  );
  const webEligible = targetGames.filter((g) => !bggHitIds.has(g.id));

  console.log(
    `\n[enrich] Step 2: Web search enrichment (${webEligible.length} games, ${bggHitIds.size} skipped via BGG)...`,
  );
  const runWeb = options._runWeb ?? runWebEnrichment;
  let webResult: WebResult;
  if (webEligible.length > 0) {
    webResult = await runWeb(webEligible, { cacheDir: webCacheDir, skipCache, concurrency });
  } else {
    webResult = { results: new Map(), cachedCount: 0 };
    console.log("[enrich] No games eligible for web search.");
  }

  // --- Step 3: Steam enrichment (games with steamUrl from web) ---
  const steamUrls = new Map<string, string>();
  for (const [gameId, web] of webResult.results) {
    if (web?.steamUrl) {
      const appId = extractSteamAppId(web.steamUrl);
      if (appId !== null) {
        steamUrls.set(gameId, web.steamUrl);
      }
    }
  }

  console.log(
    `\n[enrich] Step 3: Steam API enrichment (${steamUrls.size} games with Steam URLs)...`,
  );
  const runSteam = options._runSteam ?? runSteamEnrichment;
  let steamResult: SteamResult;
  if (steamUrls.size > 0) {
    steamResult = await runSteam(steamUrls, { cacheDir: steamCacheDir, skipCache });
  } else {
    steamResult = { results: new Map(), cachedCount: 0 };
    console.log("[enrich] No Steam URLs found, skipping.");
  }

  // --- Step 4: URL validation ---
  const allUrls = collectUrls(bggResult.results, webResult.results, steamResult.results);

  console.log(`\n[enrich] Step 4: URL validation (${allUrls.length} URLs)...`);
  const runValidate = options._validateUrls ?? validateUrls;
  let validation: { valid: string[]; invalid: string[] };
  if (allUrls.length > 0) {
    validation = await runValidate(allUrls);
  } else {
    validation = { valid: [], invalid: [] };
    console.log("[enrich] No URLs to validate.");
  }

  const validSet = new Set(validation.valid);
  const invalidSet = new Set(validation.invalid);

  // --- Build output ---
  const enrichedGames: HarmonizedGame[] = [];
  const enrichmentMeta: EnrichmentMeta[] = [];

  for (const game of targetGames) {
    const bgg = bggResult.results.get(game.id) ?? null;
    const web = webResult.results.get(game.id) ?? null;
    const steam = steamResult.results.get(game.id) ?? null;

    enrichedGames.push(applyEnrichment(game, bgg, web, steam, invalidSet));
    enrichmentMeta.push(buildMeta(game.id, bgg, web, steam, validSet, invalidSet));
  }

  const bggMatched = [...bggResult.results.values()].filter((v) => v !== null).length;

  const stats: EnrichStats = {
    totalGames: targetGames.length,
    bggSearched: tabletopGames.length - bggResult.cachedCount,
    bggMatched,
    bggCached: bggResult.cachedCount,
    webSearched: webEligible.length - webResult.cachedCount,
    webCached: webResult.cachedCount,
    steamSearched: steamUrls.size - steamResult.cachedCount,
    steamCached: steamResult.cachedCount,
    urlsValidated: validation.valid.length,
    urlsInvalid: validation.invalid.length,
  };

  console.log(`\n[enrich] Done. Enriched ${targetGames.length} games.`);
  console.log(
    `  BGG: ${bggMatched} matched, Steam: ${steamUrls.size} fetched, URLs: ${validation.invalid.length} invalid`,
  );

  return { games: enrichedGames, enrichmentMeta, stats };
}
