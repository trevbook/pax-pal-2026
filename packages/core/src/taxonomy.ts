/**
 * Taxonomy constants for PAX Pal game classification.
 *
 * These are consumed by:
 * - The LLM classification step (as allowed values in structured output schemas)
 * - The frontend filter UI (as filter options)
 * - Validation logic
 */

export const GAME_TYPES = ["video_game", "tabletop", "both"] as const;
export type GameType = (typeof GAME_TYPES)[number];

export const PLATFORMS = ["PC", "PlayStation", "Xbox", "Switch", "Mobile", "VR"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const VIDEO_GAME_GENRES = [
  "Action",
  "Adventure",
  "Fighting",
  "Horror",
  "Platformer",
  "Puzzle",
  "Roguelike",
  "RPG",
  "JRPG",
  "Shooter",
  "Strategy",
  "Simulation",
  "Survival",
  "MMO",
  "Racing",
  "Rhythm",
  "Sports",
  "Tower Defense",
  "Visual Novel",
  "Metroidvania",
  "Souls-like",
  "Deckbuilder",
  "Dungeon Crawler",
] as const;
export type VideoGameGenre = (typeof VIDEO_GAME_GENRES)[number];

export const TABLETOP_GENRES = [
  "Board Game",
  "Card Game",
  "Miniatures",
  "RPG/TTRPG",
  "Party Game",
  "War Game",
  "Escape Room",
] as const;
export type TabletopGenre = (typeof TABLETOP_GENRES)[number];

export const TABLETOP_MECHANICS = [
  "Deck-Builder",
  "Dice",
  "CCG",
  "Co-op Play",
  "Worker Placement",
  "Area Control",
  "Roll-and-Write",
  "Hand Management",
  "Set Collection",
  "Drafting",
  "Tile Placement",
  "Push Your Luck",
  "Deduction",
  "Engine Building",
  "Negotiation",
] as const;
export type TabletopMechanic = (typeof TABLETOP_MECHANICS)[number];

export const STYLE_TAGS = [
  "Retro",
  "Pixel Art",
  "Cozy",
  "Narrative-Driven",
  "Sandbox",
  "Open World",
] as const;
export type StyleTag = (typeof STYLE_TAGS)[number];

export const AUDIENCE_TAGS = [
  "Family-Friendly",
  "Single-Player",
  "Multiplayer",
  "Co-op",
  "PAX Together",
  "Competitive",
  "Local Multiplayer",
  "Online Multiplayer",
] as const;
export type AudienceTag = (typeof AUDIENCE_TAGS)[number];

export const BUSINESS_TAGS = ["Free-to-Play", "Early Access Demo", "Indie", "Retail"] as const;
export type BusinessTag = (typeof BUSINESS_TAGS)[number];

export const OTHER_TAGS = ["Merch", "Apparel", "Components"] as const;
export type OtherTag = (typeof OTHER_TAGS)[number];

/** All possible tag values across every category. */
export const ALL_TAGS = [
  ...VIDEO_GAME_GENRES,
  ...TABLETOP_GENRES,
  ...TABLETOP_MECHANICS,
  ...STYLE_TAGS,
  ...AUDIENCE_TAGS,
  ...BUSINESS_TAGS,
  ...OTHER_TAGS,
] as const;
export type Tag = (typeof ALL_TAGS)[number];
