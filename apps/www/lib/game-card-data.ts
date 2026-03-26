import type {
  DiscoverySource,
  Game,
  GameDynamoItem,
  GameType,
  InclusionTier,
  Platform,
  TabletopGenre,
  TabletopMechanic,
  Tag,
  VideoGameGenre,
} from "@pax-pal/core";

/**
 * Lightweight projection of a Game for card rendering.
 * Excludes heavy fields like `embedding`, `description`, `pressLinks`, etc.
 */
export interface GameCardData {
  id: string;
  name: string;
  slug: string;
  type: GameType;
  tagline: string | null;
  summary: string | null;
  imageUrl: string | null;
  exhibitor: string;
  exhibitorId: string;
  boothId: string | null;
  isFeatured: boolean;
  tags: Tag[];
  genres: VideoGameGenre[] | null;
  tabletopGenres: TabletopGenre[] | null;
  mechanics: TabletopMechanic[] | null;
  platforms: Platform[] | null;
  releaseStatus: string | null;
  similarGameIds: string[];
  similarGameScores: number[];
  discoverySource: DiscoverySource | null;
  /** True when the game is confirmed to appear at PAX (demo page or inclusionTier=confirmed). */
  confirmed: boolean;
}

/** Project a full Game (or GameDynamoItem) down to GameCardData. */
export function toGameCardData(game: Game | GameDynamoItem): GameCardData {
  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    type: game.type,
    tagline: game.tagline,
    summary: game.summary,
    imageUrl: game.imageUrl,
    exhibitor: game.exhibitor,
    exhibitorId: game.exhibitorId,
    boothId: game.boothId,
    isFeatured: game.isFeatured,
    tags: game.tags,
    genres: game.genres,
    tabletopGenres: game.tabletopGenres,
    mechanics: game.mechanics,
    platforms: game.platforms,
    releaseStatus: game.releaseStatus,
    similarGameIds: game.similarGameIds ?? [],
    similarGameScores: game.similarGameScores ?? [],
    discoverySource: game.discoverySource,
    confirmed: isConfirmed(game.discoverySource, game.discoveryMeta?.inclusionTier),
  };
}

/**
 * A game is confirmed if it came from the PAX demo page or has explicit PAX confirmation.
 * Demo-sourced games have `discoverySource: null` (set in harmonize stage).
 * Discovered games are only confirmed when `inclusionTier === "confirmed"`.
 */
export function isConfirmed(
  discoverySource: DiscoverySource | null | undefined,
  inclusionTier: InclusionTier | null | undefined,
): boolean {
  if (discoverySource == null) return true;
  return inclusionTier === "confirmed";
}
