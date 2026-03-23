// Types
export type {
  DiscoveryMeta,
  DiscoverySource,
  ExhibitorDynamoItem,
  ExhibitorKind,
  Game,
  GameDynamoItem,
  GameStatus,
  HarmonizedExhibitor,
  HarmonizedGame,
  InclusionTier,
  PaxConfirmation,
  PressLink,
  PressLinkType,
  RawDemo,
  RawExhibitor,
  ReleaseStatus,
  SocialLinks,
} from "./game";
export {
  DISCOVERY_SOURCES,
  EXHIBITOR_KINDS,
  GAME_STATUSES,
  INCLUSION_TIERS,
  PAX_CONFIRMATIONS,
  PRESS_LINK_TYPES,
  RELEASE_STATUSES,
} from "./game";
export type {
  AudienceTag,
  BusinessTag,
  GameType,
  OtherTag,
  Platform,
  StyleTag,
  TabletopGenre,
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
  STYLE_TAGS,
  TABLETOP_GENRES,
  TABLETOP_MECHANICS,
  VIDEO_GAME_GENRES,
} from "./taxonomy";

// Utilities
export { toSlug } from "./utils";
