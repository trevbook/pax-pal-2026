import type { GameType, HarmonizedGame, RawDemo, RawExhibitor } from "@pax-pal/core";
import { toSlug } from "@pax-pal/core";

export interface HarmonizeResult {
  games: HarmonizedGame[];
  unmatched: RawDemo[];
}

/**
 * Merge exhibitors, demos, and tabletop entries into a unified game list.
 *
 * Strategy:
 * 1. Start with all exhibitors as the base set (keyed by data-id).
 * 2. Merge tabletop entries by data-id — mark type accordingly.
 * 3. Match demos to exhibitors via data-exhibitor-id.
 * 4. Assign initial game types based on source signals.
 */
export function harmonize(
  exhibitors: RawExhibitor[],
  tabletop: RawExhibitor[],
  demos: RawDemo[],
): HarmonizeResult {
  // Build a map of exhibitor id -> HarmonizedGame
  const gameMap = new Map<string, HarmonizedGame>();

  // Step 1: Seed from main exhibitors
  for (const ex of exhibitors) {
    gameMap.set(ex.id, exhibitorToGame(ex));
  }

  // Step 2: Merge tabletop entries
  for (const tt of tabletop) {
    const existing = gameMap.get(tt.id);
    if (existing) {
      // Mark as tabletop (or "both" if already had video_game signals)
      if (!existing.sourcePages.includes("tabletop")) {
        existing.sourcePages.push("tabletop");
      }
      existing.type = resolveType(existing);
      // Merge any additional tags from the tabletop page
      for (const tag of tt.paxTags) {
        if (!existing.paxTags.includes(tag)) {
          existing.paxTags.push(tag);
        }
      }
    } else {
      // Tabletop-only entry not in main exhibitors
      const game = exhibitorToGame(tt);
      game.type = "tabletop";
      gameMap.set(tt.id, game);
    }
  }

  // Step 3: Match demos to exhibitors via exhibitorId
  const unmatched: RawDemo[] = [];

  for (const demo of demos) {
    const exhibitor = gameMap.get(demo.exhibitorId);
    if (exhibitor) {
      exhibitor.demoId = demo.id;
      if (!exhibitor.sourcePages.includes("demos")) {
        exhibitor.sourcePages.push("demos");
      }
      // If demo has an image and exhibitor doesn't, use it
      if (!exhibitor.imageUrl && demo.imageUrl) {
        exhibitor.imageUrl = demo.imageUrl;
      }
      // If demo has a description and exhibitor doesn't, use it
      if (!exhibitor.description && demo.description) {
        exhibitor.description = demo.description;
      }
      exhibitor.type = resolveType(exhibitor);
    } else {
      unmatched.push(demo);
    }
  }

  const games = Array.from(gameMap.values());
  return { games, unmatched };
}

function exhibitorToGame(ex: RawExhibitor): HarmonizedGame {
  return {
    id: ex.id,
    name: ex.name,
    slug: toSlug(ex.name),
    type: inferInitialType(ex),
    exhibitor: ex.name,
    boothLocation: ex.boothLocation,
    description: ex.description,
    imageUrl: ex.imageUrl,
    showroomUrl: ex.showroomUrl,
    isFeatured: ex.isFeatured,
    paxTags: [...ex.paxTags],
    sourcePages: [ex.sourcePage],
    demoId: null,
    lastScrapedAt: ex.lastScrapedAt,
  };
}

/** Infer initial type from PAX tags and source page. */
function inferInitialType(ex: RawExhibitor): GameType {
  const hasTabletopSignal =
    ex.sourcePage === "tabletop" ||
    ex.paxTags.some((t) => t === "Tabletop" || t.startsWith("cat-Tabletop"));
  return hasTabletopSignal ? "tabletop" : "video_game";
}

/**
 * Resolve the game type based on all available source signals.
 * - Has demos page → video game signal
 * - Has tabletop page or Tabletop tag → tabletop signal
 * - Both signals → "both"
 */
function resolveType(game: HarmonizedGame): GameType {
  const hasTabletop =
    game.sourcePages.includes("tabletop") || game.paxTags.some((t) => t === "Tabletop");
  const hasDemo = game.sourcePages.includes("demos") || game.demoId !== null;

  if (hasTabletop && hasDemo) return "both";
  if (hasTabletop) return "tabletop";
  return "video_game";
}
