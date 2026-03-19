import { PRESS_LINK_TYPES, RELEASE_STATUSES } from "@pax-pal/core";
import { z } from "zod";

// ---------------------------------------------------------------------------
// BGG enrichment
// ---------------------------------------------------------------------------

export interface BggSearchCandidate {
  bggId: number;
  name: string;
  yearPublished: number | null;
}

export interface BggEnrichment {
  bggId: number;
  bggName: string;
  matchScore: number;
  matchMethod: "auto" | "llm" | "none";
  playerCount: string | null;
  playTime: string | null;
  complexity: number | null;
  mechanics: string[];
  description: string | null;
  imageUrl: string | null;
  rating: number | null;
  yearPublished: number | null;
}

/** Schema for gpt-5.4-nano BGG disambiguation. */
export const bggDisambiguationSchema = z.object({
  /** Index (0-based) of the best matching BGG candidate, or null if none match. */
  bestMatchIndex: z.number().nullable(),
  reasoning: z.string(),
});

export type BggDisambiguation = z.infer<typeof bggDisambiguationSchema>;

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

export interface SteamEnrichment {
  steamAppId: number;
  name: string;
  shortDescription: string | null;
  headerImage: string | null;
  screenshots: string[];
  movies: string[];
  price: string | null;
  genres: string[];
  categories: string[];
  releaseDate: string | null;
  reviewScore: number | null;
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
