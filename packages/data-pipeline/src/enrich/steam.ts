import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import cliProgress from "cli-progress";
import type { SteamEnrichment } from "./types";

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

/**
 * Extract Steam app ID from a Steam store URL.
 * Handles URLs like:
 *   https://store.steampowered.com/app/12345
 *   https://store.steampowered.com/app/12345/Game_Name
 *   https://store.steampowered.com/app/12345?utm_source=...
 */
export function extractSteamAppId(url: string): number | null {
  const match = url.match(/store\.steampowered\.com\/app\/(\d+)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isNaN(id) ? null : id;
}

// ---------------------------------------------------------------------------
// Steam API
// ---------------------------------------------------------------------------

const STEAM_DELAY_MS = 1100; // ~1 req/sec

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch game details from the Steam store API.
 * Returns null if the API returns success: false or the app is not found.
 */
export async function fetchSteamDetails(appId: number): Promise<SteamEnrichment | null> {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  // biome-ignore lint: Steam API response is untyped
  const json: any = await res.json();
  const entry = json[String(appId)];
  if (!entry?.success || !entry.data) return null;

  const data = entry.data;

  const screenshots: string[] = (data.screenshots ?? [])
    .slice(0, 4)
    .map((s: { path_full?: string }) => s.path_full)
    .filter(Boolean);

  const movies: string[] = (data.movies ?? [])
    .slice(0, 2)
    .map((m: { webm?: { max?: string } }) => m.webm?.max)
    .filter(Boolean);

  const price = data.is_free ? "Free to Play" : (data.price_overview?.final_formatted ?? null);

  const genres: string[] = (data.genres ?? [])
    .map((g: { description?: string }) => g.description)
    .filter(Boolean);

  const categories: string[] = (data.categories ?? [])
    .map((c: { description?: string }) => c.description)
    .filter(Boolean);

  return {
    steamAppId: appId,
    name: data.name ?? "",
    shortDescription: data.short_description ?? null,
    headerImage: data.header_image ?? null,
    screenshots,
    movies,
    price,
    genres,
    categories,
    releaseDate: data.release_date?.date ?? null,
    reviewScore: data.metacritic?.score ?? null,
    platforms: {
      windows: data.platforms?.windows ?? false,
      mac: data.platforms?.mac ?? false,
      linux: data.platforms?.linux ?? false,
    },
  };
}

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

export async function loadSteamCache(
  cacheDir: string,
): Promise<Map<number, SteamEnrichment | null>> {
  const cache = new Map<number, SteamEnrichment | null>();
  try {
    const files = await readdir(cacheDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const appId = Number(file.replace(".json", ""));
      if (Number.isNaN(appId)) continue;
      const data = await Bun.file(join(cacheDir, file)).json();
      cache.set(appId, data as SteamEnrichment | null);
    }
  } catch {
    // Cache dir doesn't exist yet
  }
  return cache;
}

async function saveSteamCache(
  cacheDir: string,
  appId: number,
  result: SteamEnrichment | null,
): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(join(cacheDir, `${appId}.json`), JSON.stringify(result, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Batch runner
// ---------------------------------------------------------------------------

export interface SteamOptions {
  cacheDir?: string;
  skipCache?: boolean;
}

export interface SteamResult {
  /** Results keyed by gameId (not appId). */
  results: Map<string, SteamEnrichment | null>;
  cachedCount: number;
}

/**
 * Run Steam API enrichment for games with Steam URLs.
 * Sequential with 1 req/sec rate limit.
 *
 * @param steamUrls — Map of gameId → steamUrl
 */
export async function runSteamEnrichment(
  steamUrls: Map<string, string>,
  options: SteamOptions = {},
): Promise<SteamResult> {
  const { cacheDir, skipCache = false } = options;

  // Parse app IDs and deduplicate (multiple games may share the same Steam app)
  const gameIdsByAppId = new Map<number, string[]>();
  for (const [gameId, url] of steamUrls) {
    const appId = extractSteamAppId(url);
    if (appId === null) continue;
    const existing = gameIdsByAppId.get(appId) ?? [];
    existing.push(gameId);
    gameIdsByAppId.set(appId, existing);
  }

  // Load cache (keyed by appId)
  const appCache =
    cacheDir && !skipCache
      ? await loadSteamCache(cacheDir)
      : new Map<number, SteamEnrichment | null>();

  const results = new Map<string, SteamEnrichment | null>();
  let cachedCount = 0;

  // Populate results from cache
  const uncachedAppIds: number[] = [];
  for (const [appId, gameIds] of gameIdsByAppId) {
    if (appCache.has(appId)) {
      const cached = appCache.get(appId) ?? null;
      for (const gid of gameIds) results.set(gid, cached);
      cachedCount++;
    } else {
      uncachedAppIds.push(appId);
    }
  }

  if (uncachedAppIds.length === 0) {
    console.log("[steam] All apps already cached, skipping Steam API.");
    return { results, cachedCount };
  }

  console.log(`[steam] Fetching ${uncachedAppIds.length} apps (${cachedCount} cached)...`);

  const bar = new cliProgress.SingleBar(
    {
      format: "[steam] {bar} {percentage}% | {value}/{total} apps | ETA: {eta_formatted}",
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic,
  );
  bar.start(uncachedAppIds.length, 0);

  for (const appId of uncachedAppIds) {
    try {
      const result = await fetchSteamDetails(appId);
      const gameIds = gameIdsByAppId.get(appId) ?? [];
      for (const gid of gameIds) results.set(gid, result);
      if (cacheDir) {
        await saveSteamCache(cacheDir, appId, result);
      }
    } catch (error) {
      console.error(`\n[steam] Error fetching app ${appId}: ${error}`);
      const gameIds = gameIdsByAppId.get(appId) ?? [];
      for (const gid of gameIds) results.set(gid, null);
      if (cacheDir) {
        await saveSteamCache(cacheDir, appId, null);
      }
    }
    bar.increment();
    await delay(STEAM_DELAY_MS);
  }

  bar.stop();
  return { results, cachedCount };
}
