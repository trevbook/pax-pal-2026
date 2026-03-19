import { EXHIBITOR_KINDS } from "@pax-pal/core";
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
