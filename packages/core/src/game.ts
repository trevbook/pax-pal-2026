import type {
  GameType,
  Platform,
  StyleTag,
  TabletopGenre,
  TabletopMechanic,
  Tag,
  VideoGameGenre,
} from "./taxonomy";

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

export const INCLUSION_TIERS = ["confirmed", "high", "medium", "low"] as const;
export type InclusionTier = (typeof INCLUSION_TIERS)[number];

export const PAX_CONFIRMATIONS = ["explicit", "inferred", "none"] as const;
export type PaxConfirmation = (typeof PAX_CONFIRMATIONS)[number];

export const RELEASE_STATUSES = ["unreleased", "early_access", "released", "unknown"] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

/** Evidence-based metadata attached to games discovered via web search (Tier 3). */
export interface DiscoveryMeta {
  inclusionTier: InclusionTier;
  paxConfirmation: PaxConfirmation;
  releaseStatus: ReleaseStatus;
  releaseYear: number | null;
  evidenceSummary: string;
  evidenceUrls: string[];
}

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
  /** Evidence metadata from Tier 3 web search discovery. Null for non-Tier-3 games. */
  discoveryMeta?: DiscoveryMeta | null;
  lastScrapedAt: string;
}

// ---------------------------------------------------------------------------
// Enrichment-stage types
// ---------------------------------------------------------------------------

export const PRESS_LINK_TYPES = [
  "review",
  "preview",
  "interview",
  "announcement",
  "trailer",
  "other",
] as const;
export type PressLinkType = (typeof PRESS_LINK_TYPES)[number];

export interface PressLink {
  url: string;
  title: string;
  source: string;
  type: PressLinkType;
}

export interface SocialLinks {
  twitter: string | null;
  discord: string | null;
  youtube: string | null;
  itchIo: string | null;
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
  styleTags: StyleTag[];
  isFeatured: boolean;

  // Video game fields (nullable — only present for video_game / both)
  platforms: Platform[] | null;
  genres: VideoGameGenre[] | null;
  releaseStatus: string | null;
  steamUrl: string | null;

  // External IDs
  bggId: number | null;
  steamAppId: number | null;

  // Enrichment metadata
  pressLinks: PressLink[];
  socialLinks: SocialLinks;
  developerName: string | null;
  price: string | null;

  // Tabletop fields (nullable — only present for tabletop / both)
  tabletopGenres: TabletopGenre[] | null;
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

// ---------------------------------------------------------------------------
// DynamoDB item types — used at load time, not in the pipeline
// ---------------------------------------------------------------------------

export const GAME_STATUSES = ["active", "hidden"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

/** Game record as stored in DynamoDB (embedding stripped, PK + status added). */
export interface GameDynamoItem extends Omit<Game, "embedding"> {
  /** DynamoDB partition key: `GAME#{id}` */
  pk: string;
  /** Visibility status for data quality filtering. Defaults to "active" at load time. */
  status: GameStatus;
  /** SHA-256 content hash for skip-unchanged detection on re-runs. */
  _contentHash: string;
}

/** Exhibitor record as stored in DynamoDB. */
export interface ExhibitorDynamoItem extends HarmonizedExhibitor {
  /** DynamoDB partition key: `EXHIBITOR#{id}` */
  pk: string;
  /** Maps exhibitorKind to the GSI key name. */
  kind: string | null;
  /** Visibility status for data quality filtering. Defaults to "active" at load time. */
  status: GameStatus;
  /** SHA-256 content hash for skip-unchanged detection on re-runs. */
  _contentHash: string;
}
