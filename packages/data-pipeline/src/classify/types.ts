import {
  AUDIENCE_TAGS,
  BUSINESS_TAGS,
  PLATFORMS,
  STYLE_TAGS,
  TABLETOP_GENRES,
  TABLETOP_MECHANICS,
  VIDEO_GAME_GENRES,
} from "@pax-pal/core";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Per-game classification output from the LLM
// ---------------------------------------------------------------------------

export const gameClassificationSchema = z.object({
  genres: z
    .array(z.enum(VIDEO_GAME_GENRES))
    .nullable()
    .describe("Video game genres (null for tabletop-only)"),
  tabletopGenres: z
    .array(z.enum(TABLETOP_GENRES))
    .nullable()
    .describe("Tabletop game genres (null for video-game-only)"),
  mechanics: z
    .array(z.enum(TABLETOP_MECHANICS))
    .nullable()
    .describe("Tabletop mechanics (null for video-game-only)"),
  audienceTags: z.array(z.enum(AUDIENCE_TAGS)).describe("Audience/player-mode tags"),
  businessTags: z.array(z.enum(BUSINESS_TAGS)).describe("Business model tags"),
  styleTags: z.array(z.enum(STYLE_TAGS)).describe("Visual/gameplay style modifiers"),
  platforms: z
    .array(z.enum(PLATFORMS))
    .nullable()
    .describe("Gaming platforms (null for tabletop-only)"),
});

export type GameClassification = z.infer<typeof gameClassificationSchema>;

/** Batch classification: one entry per game in the batch. */
export const batchClassificationSchema = z.object({
  classifications: z.array(
    gameClassificationSchema.extend({
      gameId: z.string().describe("The game ID this classification is for"),
    }),
  ),
});

export type BatchClassification = z.infer<typeof batchClassificationSchema>;

// ---------------------------------------------------------------------------
// Classify stage types
// ---------------------------------------------------------------------------

export interface ClassifyStats {
  totalGames: number;
  classified: number;
  cached: number;
  batches: number;
}
