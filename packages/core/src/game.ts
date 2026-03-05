import type { GameType, Platform, TabletopMechanic, Tag, VideoGameGenre } from "./taxonomy";

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

/** Post-harmonization, pre-enrichment game record. */
export interface HarmonizedGame {
  /** PAX data-id — stable primary key throughout the system. */
  id: string;
  name: string;
  slug: string;
  type: GameType;
  exhibitor: string;
  boothLocation: string | null;
  description: string | null;
  imageUrl: string | null;
  showroomUrl: string | null;
  isFeatured: boolean;
  paxTags: string[];
  /** Which source pages contributed to this record. */
  sourcePages: ("exhibitors" | "tabletop" | "demos")[];
  /** If this game had a demo entry, its ID. */
  demoId: string | null;
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
