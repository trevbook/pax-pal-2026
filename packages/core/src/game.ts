import type { GameType, Platform, TabletopMechanic, Tag, VideoGameGenre } from "./taxonomy";

// ---------------------------------------------------------------------------
// Discovery-stage constants
// ---------------------------------------------------------------------------

export const EXHIBITOR_KINDS = [
  "game_studio",
  "publisher",
  "agency",
  "tabletop_publisher",
  "peripheral",
  "media",
  "community",
  "other",
] as const;
export type ExhibitorKind = (typeof EXHIBITOR_KINDS)[number];

export const DISCOVERY_SOURCES = [
  "demo_page",
  "description_explicit",
  "description_inferred",
  "name_is_game",
  "bgg_match",
  "web_search",
] as const;
export type DiscoverySource = (typeof DISCOVERY_SOURCES)[number];

// ---------------------------------------------------------------------------
// Pipeline stage types — each step has typed inputs and outputs
// ---------------------------------------------------------------------------

/** Raw output from scraping the exhibitors or tabletop exhibitors page. */
export interface RawExhibitor {
  /** PAX data-id attribute. */
  id: string;
  name: string;
  slug: string;
  boothLocation: string | null;
  description: string | null;
  imageUrl: string | null;
  website: string | null;
  storeUrl: string | null;
  showroomUrl: string | null;
  isFeatured: boolean;
  /** Raw CSS-class-derived tags from the PAX page (e.g. "cat-tabletop", "tag-rpg"). */
  paxTags: string[];
  /** Which page this was scraped from. */
  sourcePage: "exhibitors" | "tabletop";
  lastScrapedAt: string;
}

/** Raw output from scraping the demos page. */
export interface RawDemo {
  /** PAX data-id for the demo entry itself. */
  id: string;
  /** The game/demo name (data-button-text). */
  name: string;
  /** The exhibitor who runs this demo (data-exhib-full-name). */
  exhibitorName: string;
  /** Links back to the exhibitor (data-exhibitor-id). */
  exhibitorId: string;
  description: string | null;
  imageUrl: string | null;
  lastScrapedAt: string;
}

/** Post-harmonization exhibitor record — always represents a company/org, never a game. */
export interface HarmonizedExhibitor {
  /** PAX exhibitor data-id. */
  id: string;
  name: string;
  slug: string;
  boothLocation: string | null;
  description: string | null;
  imageUrl: string | null;
  website: string | null;
  storeUrl: string | null;
  showroomUrl: string | null;
  isFeatured: boolean;
  isTabletop: boolean;
  paxTags: string[];
  sourcePages: ("exhibitors" | "tabletop")[];
  /** Number of demos linked to this exhibitor. */
  demoCount: number;
  /** Exhibitor classification from the discover stage. Null until discover runs. */
  exhibitorKind: ExhibitorKind | null;
  /** Number of games found by the discover stage (distinct from demoCount). */
  discoveredGameCount: number;
  lastScrapedAt: string;
}

/** Post-harmonization, pre-enrichment game record. */
export interface HarmonizedGame {
  /** `demo:{demoId}` for demo-sourced records, exhibitor data-id for exhibitor-only. */
  id: string;
  /** Game title (from demo name) or exhibitor name (if no demos). */
  name: string;
  slug: string;
  type: GameType;
  exhibitor: string;
  /** PAX exhibitor data-id — always populated. */
  exhibitorId: string;
  boothLocation: string | null;
  description: string | null;
  imageUrl: string | null;
  showroomUrl: string | null;
  isFeatured: boolean;
  paxTags: string[];
  /** Which source pages contributed to this record. */
  sourcePages: ("exhibitors" | "tabletop" | "demos")[];
  /** Raw PAX demo data-id, null for exhibitor-only records. */
  demoId: string | null;
  /** How this game was discovered. Null for demo-sourced games. */
  discoverySource: DiscoverySource | null;
  lastScrapedAt: string;
}

// ---------------------------------------------------------------------------
// Full Game type — the final enriched, classified, embedded record
// ---------------------------------------------------------------------------

export interface Game {
  /** PAX data-id — DynamoDB PK as GAME#{id}. */
  id: string;
  name: string;
  slug: string;
  type: GameType;

  // Core info
  summary: string | null;
  description: string | null;
  imageUrl: string | null;
  mediaUrls: string[];
  exhibitor: string;
  /** PAX exhibitor data-id. */
  exhibitorId: string;
  boothId: string | null;
  showroomUrl: string | null;

  // Classification
  tags: Tag[];
  paxTags: string[];
  isFeatured: boolean;

  // Video game fields (nullable — only present for video_game / both)
  platforms: Platform[] | null;
  genres: VideoGameGenre[] | null;
  releaseStatus: string | null;
  steamUrl: string | null;

  // Tabletop fields (nullable — only present for tabletop / both)
  playerCount: string | null;
  playTime: string | null;
  complexity: number | null;
  mechanics: TabletopMechanic[] | null;

  // Search
  embedding: number[] | null;

  // Metadata
  sourcePages: ("exhibitors" | "tabletop" | "demos")[];
  lastScrapedAt: string;
  enrichedAt: string | null;
}
