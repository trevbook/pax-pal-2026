import type {
  DiscoverySource,
  Game,
  GameDynamoItem,
  GameType,
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
  discoverySource: DiscoverySource | null;
}

/** Project a full Game (or GameDynamoItem) down to GameCardData. */
export function toGameCardData(game: Game | GameDynamoItem): GameCardData {
  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    type: game.type,
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
    // discoverySource exists on HarmonizedGame but not yet on Game/GameDynamoItem.
    // Access it dynamically since DynamoDB items may carry it through.
    discoverySource:
      ("discoverySource" in game
        ? (game as { discoverySource: DiscoverySource | null }).discoverySource
        : null) ?? null,
  };
}
