// Types
export type {
  DiscoveryMeta,
  DiscoverySource,
  ExhibitorKind,
  Game,
  HarmonizedExhibitor,
  HarmonizedGame,
  InclusionTier,
  PaxConfirmation,
  RawDemo,
  RawExhibitor,
  ReleaseStatus,
} from "./game";
export {
  DISCOVERY_SOURCES,
  EXHIBITOR_KINDS,
  INCLUSION_TIERS,
  PAX_CONFIRMATIONS,
  RELEASE_STATUSES,
} from "./game";
export type {
  AudienceTag,
  BusinessTag,
  GameType,
  OtherTag,
  Platform,
  TabletopMechanic,
  Tag,
  VideoGameGenre,
} from "./taxonomy";
// Taxonomy constants and types
export {
  ALL_TAGS,
  AUDIENCE_TAGS,
  BUSINESS_TAGS,
  GAME_TYPES,
  OTHER_TAGS,
  PLATFORMS,
  TABLETOP_MECHANICS,
  VIDEO_GAME_GENRES,
} from "./taxonomy";

// Utilities
export { toSlug } from "./utils";
