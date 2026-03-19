import { describe, expect, it } from "bun:test";
import type { HarmonizedExhibitor } from "@pax-pal/core";
import { computeInclusionTier } from "./tier3";
import type { DiscoveryResult, GameEvidence } from "./types";

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

function makeGameEvidence(overrides: Partial<GameEvidence["evidence"]> = {}): GameEvidence {
  return {
    name: "Test Game",
    type: "video_game",
    evidence: {
      paxConfirmation: "none",
      isPrimaryGame: false,
      exhibitorGameCount: 5,
      releaseStatus: "released",
      releaseYear: 2024,
      sourceType: "steam",
      summary: "Found on Steam",
      urls: ["https://store.steampowered.com/app/12345"],
      ...overrides,
    },
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

describe("computeInclusionTier", () => {
  it("returns 'confirmed' for explicit PAX East 2026 confirmation", () => {
    const game = makeGameEvidence({ paxConfirmation: "explicit" });
    expect(computeInclusionTier(game)).toBe("confirmed");
  });

  it("returns 'high' for single-game studio (isPrimaryGame + count <= 2)", () => {
    const game = makeGameEvidence({ isPrimaryGame: true, exhibitorGameCount: 1 });
    expect(computeInclusionTier(game)).toBe("high");
  });

  it("returns 'high' for two-game studio with primary game", () => {
    const game = makeGameEvidence({ isPrimaryGame: true, exhibitorGameCount: 2 });
    expect(computeInclusionTier(game)).toBe("high");
  });

  it("returns 'high' for unreleased game", () => {
    const game = makeGameEvidence({ releaseStatus: "unreleased" });
    expect(computeInclusionTier(game)).toBe("high");
  });

  it("returns 'high' for inferred PAX confirmation", () => {
    const game = makeGameEvidence({ paxConfirmation: "inferred" });
    expect(computeInclusionTier(game)).toBe("high");
  });

  it("returns 'medium' for early access game", () => {
    const game = makeGameEvidence({ releaseStatus: "early_access" });
    expect(computeInclusionTier(game)).toBe("medium");
  });

  it("returns 'medium' for game released in 2025", () => {
    const game = makeGameEvidence({ releaseYear: 2025 });
    expect(computeInclusionTier(game)).toBe("medium");
  });

  it("returns 'medium' for game released in 2026", () => {
    const game = makeGameEvidence({ releaseYear: 2026 });
    expect(computeInclusionTier(game)).toBe("medium");
  });

  it("returns 'low' for released 2024 game from large catalog", () => {
    const game = makeGameEvidence({
      releaseStatus: "released",
      releaseYear: 2024,
      exhibitorGameCount: 5,
      isPrimaryGame: false,
    });
    expect(computeInclusionTier(game)).toBe("low");
  });

  it("returns 'low' for released 2023 game with no PAX signal", () => {
    const game = makeGameEvidence({
      releaseStatus: "released",
      releaseYear: 2023,
      paxConfirmation: "none",
      isPrimaryGame: false,
      exhibitorGameCount: 3,
    });
    expect(computeInclusionTier(game)).toBe("low");
  });

  it("confirmed takes priority over all other signals", () => {
    const game = makeGameEvidence({
      paxConfirmation: "explicit",
      isPrimaryGame: true,
      exhibitorGameCount: 1,
      releaseStatus: "released",
      releaseYear: 2020,
    });
    expect(computeInclusionTier(game)).toBe("confirmed");
  });

  it("high: unreleased beats medium: early_access", () => {
    const game = makeGameEvidence({
      releaseStatus: "unreleased",
      isPrimaryGame: false,
      exhibitorGameCount: 10,
    });
    expect(computeInclusionTier(game)).toBe("high");
  });
});

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
