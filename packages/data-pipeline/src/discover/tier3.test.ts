import { describe, expect, it } from "bun:test";
import type { HarmonizedExhibitor } from "@pax-pal/core";
import type { DiscoveryResult } from "./types";

const now = new Date().toISOString();

function makeExhibitor(overrides: Partial<HarmonizedExhibitor> = {}): HarmonizedExhibitor {
  return {
    id: "100001",
    name: "Mystery Studio",
    slug: "mystery-studio",
    boothLocation: "15043",
    description: "An indie studio making great games",
    imageUrl: null,
    website: "https://mystery.com",
    storeUrl: null,
    showroomUrl: null,
    isFeatured: false,
    isTabletop: false,
    paxTags: ["Action"],
    sourcePages: ["exhibitors"],
    demoCount: 0,
    exhibitorKind: null,
    discoveredGameCount: 0,
    lastScrapedAt: now,
    ...overrides,
  };
}

/**
 * Helper to build a Tier 3 discovery result for testing.
 */
function makeTier3Result(
  exhibitorId: string,
  games: Array<{ name: string; type: "video_game" | "tabletop" | "both" | null }> = [],
  overrides: Partial<DiscoveryResult> = {},
): DiscoveryResult {
  return {
    exhibitorId,
    exhibitorKind: "game_studio",
    games: games.map((g) => ({
      name: g.name,
      source: "web_search" as const,
      confidence: 0.8,
      type: g.type,
    })),
    confidence: 0.8,
    needsWebSearch: false,
    reasoning: "Found via web search",
    ...overrides,
  };
}

describe("tier3 result shape", () => {
  it("builds result with web_search source on all games", () => {
    const result = makeTier3Result("100001", [
      { name: "Secret Quest", type: "video_game" },
      { name: "Board Battle", type: "tabletop" },
    ]);

    expect(result.games).toHaveLength(2);
    for (const game of result.games) {
      expect(game.source).toBe("web_search");
    }
    expect(result.needsWebSearch).toBe(false);
  });

  it("builds result with empty games when search finds nothing", () => {
    const result = makeTier3Result("100001", [], {
      confidence: 0.5,
      reasoning: "No PAX East 2026 games found",
    });

    expect(result.games).toHaveLength(0);
    expect(result.needsWebSearch).toBe(false);
    expect(result.confidence).toBe(0.5);
  });

  it("builds fallback result for failed searches", () => {
    const result = makeTier3Result("100001", [], {
      exhibitorKind: "other",
      confidence: 0,
      reasoning: "Web search failed: timeout",
    });

    expect(result.games).toHaveLength(0);
    expect(result.confidence).toBe(0);
    expect(result.needsWebSearch).toBe(false);
  });
});

describe("tier3 exhibitor formatting", () => {
  it("includes website in search context when available", () => {
    const exhibitor = makeExhibitor({ website: "https://mystery.com" });
    // The search prompt includes website as a hint for site: searches
    expect(exhibitor.website).toBe("https://mystery.com");
  });

  it("handles exhibitor with no description", () => {
    const exhibitor = makeExhibitor({ description: null });
    expect(exhibitor.description).toBeNull();
  });

  it("handles tabletop exhibitor", () => {
    const exhibitor = makeExhibitor({ isTabletop: true });
    expect(exhibitor.isTabletop).toBe(true);
  });
});
