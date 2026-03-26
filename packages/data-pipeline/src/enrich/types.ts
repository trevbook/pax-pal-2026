import { PRESS_LINK_TYPES, RELEASE_STATUSES } from "@pax-pal/core";
import { z } from "zod";

// ---------------------------------------------------------------------------
// BGG enrichment
// ---------------------------------------------------------------------------

export interface BggEnrichment {
  bggId: number;
  bggName: string;
  matchMethod: "web_search";
  playerCount: string | null;
  playTime: string | null;
  complexity: number | null;
  mechanics: string[];
  description: string | null;
  imageUrl: string | null;
  rating: number | null;
  yearPublished: number | null;
}

/** Schema for LLM web search → BGG URL lookup. */
export const bggWebSearchSchema = z.object({
  /** The BoardGameGeek URL for the game, or null if not found. */
  bggUrl: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Web search enrichment
// ---------------------------------------------------------------------------

export const webEnrichmentSchema = z.object({
  summary: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),

  // Video game fields (loose strings — taxonomy mapping deferred to classify)
  platforms: z.array(z.string()),
  genres: z.array(z.string()),
  releaseStatus: z.enum(RELEASE_STATUSES).nullable(),
  releaseDate: z.string().nullable(),
  steamUrl: z.string().nullable(),

  // Tabletop fields (for BGG misses)
  playerCount: z.string().nullable(),
  playTime: z.string().nullable(),
  mechanics: z.array(z.string()),

  // Press & media coverage
  pressLinks: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      source: z.string(),
      type: z.enum(PRESS_LINK_TYPES),
    }),
  ),

  // Social presence
  socialLinks: z.object({
    twitter: z.string().nullable(),
    discord: z.string().nullable(),
    youtube: z.string().nullable(),
    itchIo: z.string().nullable(),
  }),

  // Media
  trailerUrl: z.string().nullable(),
  screenshotUrls: z.array(z.string()),

  // Developer info
  developerName: z.string().nullable(),
});

export type WebEnrichment = z.infer<typeof webEnrichmentSchema>;

// ---------------------------------------------------------------------------
// Steam enrichment
// ---------------------------------------------------------------------------

export interface SteamMovie {
  /** HLS playlist URL (natively supported on Safari, needs hls.js elsewhere). */
  hlsUrl: string;
  /** Thumbnail image URL. */
  thumbnail: string;
}

export interface SteamEnrichment {
  steamAppId: number;
  name: string;
  shortDescription: string | null;
  headerImage: string | null;
  screenshots: string[];
  /** @deprecated Use {@link steamMovies} instead — kept for cache compat. */
  movies: string[];
  /** Structured movie data with HLS URLs and thumbnails. */
  steamMovies: SteamMovie[];
  price: string | null;
  genres: string[];
  categories: string[];
  releaseDate: string | null;
  /** Metacritic score (0–100), if available. */
  reviewScore: number | null;
  /** Total Steam user recommendations count. */
  recommendationCount: number | null;
  platforms: { windows: boolean; mac: boolean; linux: boolean };
}

// ---------------------------------------------------------------------------
// Enrichment sidecar (per-game raw data from all sources)
// ---------------------------------------------------------------------------

export interface EnrichmentMeta {
  gameId: string;
  bgg: BggEnrichment | null;
  web: WebEnrichment | null;
  steam: SteamEnrichment | null;
  validatedUrls: string[];
  invalidUrls: string[];
  enrichedAt: string;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface EnrichStats {
  totalGames: number;
  bggSearched: number;
  bggMatched: number;
  bggCached: number;
  webSearched: number;
  webCached: number;
  steamSearched: number;
  steamCached: number;
  urlsValidated: number;
  urlsInvalid: number;
}
