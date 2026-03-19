import {
  EXHIBITOR_KINDS,
  INCLUSION_TIERS,
  PAX_CONFIRMATIONS,
  RELEASE_STATUSES,
} from "@pax-pal/core";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Tier 1 signals — structural annotations per exhibitor
// ---------------------------------------------------------------------------

export interface Tier1Signal {
  exhibitorId: string;
  /** Shares a booth with exhibitors that have demos — likely an umbrella org. */
  likelyUmbrella: boolean;
  /** No description AND no website — skip Tier 2, flag for Tier 3. */
  skipForTier2: boolean;
  skipReason: string | null;
  /** Name doesn't look corporate — could be a game title. */
  nameIsGame: boolean;
  /** IDs of other exhibitors at the same booth. */
  boothPartners: string[];
}

export interface Tier1Result {
  /** Signal per no-demo exhibitor, keyed by exhibitorId. */
  signals: Map<string, Tier1Signal>;
  /** Exhibitors that should go to Tier 2 (have description or website). */
  forTier2: string[];
  /** Exhibitors skipped for Tier 2 (no data for LLM). */
  skipped: string[];
}

// ---------------------------------------------------------------------------
// Tier 2 — LLM structured output schemas
// ---------------------------------------------------------------------------

const discoveredGameSourceValues = [
  "description_explicit",
  "description_inferred",
  "name_is_game",
  "bgg_match",
  "web_search",
] as const;

export const discoveredGameSchema = z.object({
  name: z.string(),
  source: z.enum(discoveredGameSourceValues),
  confidence: z.number(),
  type: z.enum(["video_game", "tabletop", "both"]).nullable(),
});

export const discoveryResultSchema = z.object({
  exhibitorId: z.string(),
  exhibitorKind: z.enum(EXHIBITOR_KINDS),
  games: z.array(discoveredGameSchema),
  confidence: z.number(),
  needsWebSearch: z.boolean(),
  reasoning: z.string(),
});

export const batchResultSchema = z.object({
  results: z.array(discoveryResultSchema),
});

export type DiscoveredGame = z.infer<typeof discoveredGameSchema>;
export type DiscoveryResult = z.infer<typeof discoveryResultSchema>;

// ---------------------------------------------------------------------------
// Tier 3 — evidence-based game discovery
// ---------------------------------------------------------------------------

export const gameEvidenceSchema = z.object({
  name: z.string(),
  type: z.enum(["video_game", "tabletop", "both"]).nullable(),
  evidence: z.object({
    paxConfirmation: z.enum(PAX_CONFIRMATIONS),
    isPrimaryGame: z.boolean(),
    exhibitorGameCount: z.number(),
    releaseStatus: z.enum(RELEASE_STATUSES),
    releaseYear: z.number().nullable(),
    sourceType: z.enum(["official_site", "steam", "bgg", "social_media", "press", "other"]),
    summary: z.string(),
    urls: z.array(z.string()),
  }),
});

export const tier3EvidenceResultSchema = z.object({
  exhibitorKind: z.enum(EXHIBITOR_KINDS),
  games: z.array(gameEvidenceSchema),
  reasoning: z.string(),
});

export type GameEvidence = z.infer<typeof gameEvidenceSchema>;
export type Tier3EvidenceResult = z.infer<typeof tier3EvidenceResultSchema>;

export const inclusionTierSchema = z.enum(INCLUSION_TIERS);
export type InclusionTier = z.infer<typeof inclusionTierSchema>;

// ---------------------------------------------------------------------------
// Discover stage output
// ---------------------------------------------------------------------------

export interface DiscoverStats {
  totalNoDemoExhibitors: number;
  tier1Skipped: number;
  tier1Umbrellas: number;
  tier2Processed: number;
  tier2Cached: number;
  tier3Eligible: number;
  tier3Processed: number;
  tier3Cached: number;
  gamesDiscovered: number;
}
