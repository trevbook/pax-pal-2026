import type {
  GameType,
  HarmonizedExhibitor,
  HarmonizedGame,
  RawDemo,
  RawExhibitor,
} from "@pax-pal/core";
import { toSlug } from "@pax-pal/core";

export interface HarmonizeResult {
  exhibitors: HarmonizedExhibitor[];
  games: HarmonizedGame[];
  unmatched: RawDemo[];
}

/**
 * Merged exhibitor state used internally during harmonization.
 * Combines data from the exhibitors and tabletop pages before output.
 */
interface MergedExhibitor {
  exhibitor: RawExhibitor;
  sourcePages: ("exhibitors" | "tabletop")[];
  paxTags: string[];
}

/**
 * Merge exhibitors, demos, and tabletop entries into separate exhibitor and game lists.
 *
 * Strategy:
 * 1. Build an exhibitor lookup from exhibitors + tabletop (merging overlapping IDs).
 * 2. Group demos by exhibitorId.
 * 3. Emit ALL exhibitors into exhibitors[] (these are companies, not games).
 * 4. For each exhibitor with demos: emit one HarmonizedGame per demo into games[].
 * 5. Exhibitors without demos produce NO games (they await the discover stage).
 * 6. Collect unmatched demos (exhibitorId not found in lookup).
 */
export function harmonize(
  exhibitors: RawExhibitor[],
  tabletop: RawExhibitor[],
  demos: RawDemo[],
): HarmonizeResult {
  // Step 1: Build merged exhibitor lookup
  const exhibitorMap = new Map<string, MergedExhibitor>();

  for (const ex of exhibitors) {
    exhibitorMap.set(ex.id, {
      exhibitor: ex,
      sourcePages: [ex.sourcePage],
      paxTags: [...ex.paxTags],
    });
  }

  for (const tt of tabletop) {
    const existing = exhibitorMap.get(tt.id);
    if (existing) {
      if (!existing.sourcePages.includes("tabletop")) {
        existing.sourcePages.push("tabletop");
      }
      for (const tag of tt.paxTags) {
        if (!existing.paxTags.includes(tag)) {
          existing.paxTags.push(tag);
        }
      }
    } else {
      exhibitorMap.set(tt.id, {
        exhibitor: tt,
        sourcePages: [tt.sourcePage],
        paxTags: [...tt.paxTags],
      });
    }
  }

  // Step 2: Group demos by exhibitorId
  const demosByExhibitor = new Map<string, RawDemo[]>();
  const unmatched: RawDemo[] = [];

  for (const demo of demos) {
    if (exhibitorMap.has(demo.exhibitorId)) {
      const group = demosByExhibitor.get(demo.exhibitorId);
      if (group) {
        group.push(demo);
      } else {
        demosByExhibitor.set(demo.exhibitorId, [demo]);
      }
    } else {
      unmatched.push(demo);
    }
  }

  // Step 3: Build output lists
  const harmonizedExhibitors: HarmonizedExhibitor[] = [];
  const games: HarmonizedGame[] = [];

  for (const merged of exhibitorMap.values()) {
    const demosForExhibitor = demosByExhibitor.get(merged.exhibitor.id) ?? [];

    // Every exhibitor goes into the exhibitors list
    harmonizedExhibitors.push(mergedToExhibitor(merged, demosForExhibitor.length));

    // Only demo-sourced entries become games
    for (const demo of demosForExhibitor) {
      games.push(demoToGame(demo, merged));
    }
  }

  return { exhibitors: harmonizedExhibitors, games, unmatched };
}

function mergedToExhibitor(merged: MergedExhibitor, demoCount: number): HarmonizedExhibitor {
  const { exhibitor, sourcePages, paxTags } = merged;
  const isTabletop = sourcePages.includes("tabletop") || paxTags.some((t) => t === "Tabletop");
  return {
    id: exhibitor.id,
    name: exhibitor.name,
    slug: toSlug(exhibitor.name),
    boothLocation: exhibitor.boothLocation,
    description: exhibitor.description,
    imageUrl: exhibitor.imageUrl,
    website: exhibitor.website,
    storeUrl: exhibitor.storeUrl,
    showroomUrl: exhibitor.showroomUrl,
    isFeatured: exhibitor.isFeatured,
    isTabletop,
    paxTags,
    sourcePages: [...sourcePages],
    demoCount,
    lastScrapedAt: exhibitor.lastScrapedAt,
  };
}

function demoToGame(demo: RawDemo, merged: MergedExhibitor): HarmonizedGame {
  const { exhibitor, sourcePages, paxTags } = merged;
  const allSourcePages: ("exhibitors" | "tabletop" | "demos")[] = [...sourcePages, "demos"];

  return {
    id: `demo:${demo.id}`,
    name: demo.name,
    slug: toSlug(demo.name),
    type: resolveType(allSourcePages, paxTags),
    exhibitor: exhibitor.name,
    exhibitorId: exhibitor.id,
    boothLocation: exhibitor.boothLocation,
    description: demo.description ?? exhibitor.description,
    imageUrl: sanitizeImageUrl(demo.imageUrl) ?? exhibitor.imageUrl,
    showroomUrl: exhibitor.showroomUrl,
    isFeatured: exhibitor.isFeatured,
    paxTags,
    sourcePages: allSourcePages,
    demoId: demo.id,
    lastScrapedAt:
      demo.lastScrapedAt > exhibitor.lastScrapedAt ? demo.lastScrapedAt : exhibitor.lastScrapedAt,
  };
}

/** Sanitize image URLs — the scraper sometimes produces the literal string "undefined". */
function sanitizeImageUrl(url: string | null): string | null {
  if (!url || url === "undefined") return null;
  return url;
}

/**
 * Resolve game type from source page signals and PAX tags.
 * - Tabletop page or Tabletop tag → tabletop signal
 * - Demos page → video game signal
 * - Both signals → "both"
 */
function resolveType(sourcePages: readonly string[], paxTags: readonly string[]): GameType {
  const hasTabletop = sourcePages.includes("tabletop") || paxTags.some((t) => t === "Tabletop");
  const hasDemo = sourcePages.includes("demos");

  if (hasTabletop && hasDemo) return "both";
  if (hasTabletop) return "tabletop";
  return "video_game";
}
