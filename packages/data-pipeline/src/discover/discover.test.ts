import { describe, expect, it } from "bun:test";
import type { HarmonizedExhibitor, HarmonizedGame } from "@pax-pal/core";
import type { DiscoverOptions } from "./discover";
import { discover } from "./discover";
import type { DiscoveryResult, Tier1Signal } from "./types";

const now = new Date().toISOString();

function makeExhibitor(overrides: Partial<HarmonizedExhibitor> = {}): HarmonizedExhibitor {
  return {
    id: "1",
    name: "Indie Dev",
    slug: "indie-dev",
    boothLocation: "15043",
    description: "Come play Test Quest, our new RPG!",
    imageUrl: null,
    website: "https://indiedev.com",
    storeUrl: null,
    showroomUrl: null,
    isFeatured: false,
    isTabletop: false,
    paxTags: ["RPG"],
    sourcePages: ["exhibitors"],
    demoCount: 0,
    exhibitorKind: null,
    discoveredGameCount: 0,
    lastScrapedAt: now,
    ...overrides,
  };
}

function makeGame(overrides: Partial<HarmonizedGame> = {}): HarmonizedGame {
  return {
    id: "demo:58001",
    name: "Existing Game",
    slug: "existing-game",
    type: "video_game",
    exhibitor: "Some Studio",
    exhibitorId: "999",
    boothLocation: "10000",
    description: "An existing demo game",
    imageUrl: null,
    showroomUrl: null,
    isFeatured: false,
    paxTags: [],
    sourcePages: ["demos"],
    demoId: "58001",
    discoverySource: null,
    lastScrapedAt: now,
    ...overrides,
  };
}

/** Fake runTier2 that returns canned results without hitting the LLM. */
const fakeRunTier2: DiscoverOptions["_runTier2"] = async (
  forTier2Ids: string[],
  _allExhibitors: HarmonizedExhibitor[],
  _signals: Map<string, Tier1Signal>,
) => {
  const results = new Map<string, DiscoveryResult>();
  for (const id of forTier2Ids) {
    if (id === "1") {
      results.set(id, {
        exhibitorId: id,
        exhibitorKind: "game_studio",
        games: [
          {
            name: "Test Quest",
            source: "description_explicit",
            confidence: 0.9,
            type: "video_game",
          },
        ],
        confidence: 0.9,
        needsWebSearch: false,
        reasoning: "Game name in description",
      });
    } else if (id === "3") {
      results.set(id, {
        exhibitorId: id,
        exhibitorKind: "peripheral",
        games: [],
        confidence: 0.95,
        needsWebSearch: false,
        reasoning: "Hardware company",
      });
    }
  }
  return { results, cachedCount: 0 };
};

/** Fake runTier2 that marks an exhibitor as needing web search. */
const fakeRunTier2WithWebSearch: DiscoverOptions["_runTier2"] = async (
  forTier2Ids: string[],
  _allExhibitors: HarmonizedExhibitor[],
  _signals: Map<string, Tier1Signal>,
) => {
  const results = new Map<string, DiscoveryResult>();
  for (const id of forTier2Ids) {
    if (id === "1") {
      results.set(id, {
        exhibitorId: id,
        exhibitorKind: "publisher",
        games: [],
        confidence: 0.5,
        needsWebSearch: true,
        reasoning: "No specific titles, needs web search",
      });
    }
  }
  return { results, cachedCount: 0 };
};

/** Fake runTier3 that returns canned web search results. */
const fakeRunTier3: DiscoverOptions["_runTier3"] = async (eligibleIds: string[]) => {
  const results = new Map<string, DiscoveryResult>();
  for (const id of eligibleIds) {
    results.set(id, {
      exhibitorId: id,
      exhibitorKind: "game_studio",
      games: [
        {
          name: "Web Found Game",
          source: "web_search",
          confidence: 0.85,
          type: "video_game",
        },
      ],
      confidence: 0.85,
      needsWebSearch: false,
      reasoning: "Found via web search",
    });
  }
  return { results, cachedCount: 0 };
};

const opts: DiscoverOptions = { _runTier2: fakeRunTier2 };

describe("discover", () => {
  it("preserves existing demo-sourced games", async () => {
    const existingGame = makeGame();
    const exhibitorWithDemo = makeExhibitor({ id: "999", demoCount: 1 });
    const result = await discover([exhibitorWithDemo], [existingGame], opts);

    const demoGame = result.games.find((g) => g.id === "demo:58001");
    expect(demoGame).toBeTruthy();
    expect(demoGame?.name).toBe("Existing Game");
  });

  it("adds discovered games from Tier 2 results", async () => {
    const exhibitor = makeExhibitor({ id: "1", demoCount: 0 });
    const result = await discover([exhibitor], [], opts);

    const discovered = result.games.filter((g) => g.id.startsWith("discovered:"));
    expect(discovered).toHaveLength(1);
    expect(discovered[0].name).toBe("Test Quest");
    expect(discovered[0].discoverySource).toBe("description_explicit");
    expect(discovered[0].exhibitorId).toBe("1");
  });

  it("sets correct game ID format for discovered games", async () => {
    const exhibitor = makeExhibitor({ id: "1", demoCount: 0 });
    const result = await discover([exhibitor], [], opts);

    const discovered = result.games.find((g) => g.id.startsWith("discovered:"));
    expect(discovered?.id).toBe("discovered:1:test-quest");
  });

  it("annotates exhibitors with exhibitorKind", async () => {
    const studio = makeExhibitor({ id: "1", demoCount: 0 });
    const peripheral = makeExhibitor({
      id: "3",
      name: "Zenni",
      description: "Eyewear retailer",
      demoCount: 0,
    });
    const result = await discover([studio, peripheral], [], opts);

    const annotatedStudio = result.exhibitors.find((e) => e.id === "1");
    expect(annotatedStudio?.exhibitorKind).toBe("game_studio");

    const annotatedPeripheral = result.exhibitors.find((e) => e.id === "3");
    expect(annotatedPeripheral?.exhibitorKind).toBe("peripheral");
  });

  it("sets discoveredGameCount on exhibitors", async () => {
    const exhibitor = makeExhibitor({ id: "1", demoCount: 0 });
    const result = await discover([exhibitor], [], opts);

    const annotated = result.exhibitors.find((e) => e.id === "1");
    expect(annotated?.discoveredGameCount).toBe(1);
  });

  it("skips exhibitors with no description and no website", async () => {
    const noData = makeExhibitor({
      id: "2",
      description: null,
      website: null,
      demoCount: 0,
    });
    const result = await discover([noData], [], opts);

    expect(result.stats.tier1Skipped).toBe(1);
    const discovered = result.games.filter((g) => g.id.startsWith("discovered:"));
    expect(discovered).toHaveLength(0);
  });

  it("returns correct stats", async () => {
    const studio = makeExhibitor({ id: "1", demoCount: 0 });
    const noData = makeExhibitor({
      id: "2",
      description: null,
      website: null,
      demoCount: 0,
    });
    const withDemo = makeExhibitor({ id: "999", demoCount: 3 });

    const result = await discover([studio, noData, withDemo], [], opts);

    expect(result.stats.totalNoDemoExhibitors).toBe(2);
    expect(result.stats.tier1Skipped).toBe(1);
    expect(result.stats.gamesDiscovered).toBe(1);
  });

  it("inherits exhibitor metadata on discovered games", async () => {
    const exhibitor = makeExhibitor({
      id: "1",
      demoCount: 0,
      boothLocation: "12345",
      paxTags: ["RPG", "Indie"],
      isTabletop: false,
    });
    const result = await discover([exhibitor], [], opts);

    const discovered = result.games.find((g) => g.id.startsWith("discovered:"));
    expect(discovered?.boothLocation).toBe("12345");
    expect(discovered?.paxTags).toEqual(["RPG", "Indie"]);
    expect(discovered?.demoId).toBeNull();
  });
});

describe("discover with tier3", () => {
  it("tier3 results replace tier2 results when webSearch is enabled", async () => {
    const exhibitor = makeExhibitor({ id: "1", demoCount: 0 });
    const result = await discover([exhibitor], [], {
      _runTier2: fakeRunTier2WithWebSearch,
      _runTier3: fakeRunTier3,
      webSearch: true,
    });

    const discovered = result.games.filter((g) => g.id.startsWith("discovered:"));
    expect(discovered).toHaveLength(1);
    expect(discovered[0].name).toBe("Web Found Game");
    expect(discovered[0].discoverySource).toBe("web_search");
  });

  it("tier3 is skipped when webSearch is false", async () => {
    const exhibitor = makeExhibitor({ id: "1", demoCount: 0 });
    const result = await discover([exhibitor], [], {
      _runTier2: fakeRunTier2WithWebSearch,
      _runTier3: fakeRunTier3,
      webSearch: false,
    });

    expect(result.stats.tier3Processed).toBe(0);
    expect(result.stats.tier3Cached).toBe(0);
    expect(result.stats.tier3Eligible).toBe(1);
    // No web_search games since tier3 didn't run
    const webGames = result.games.filter((g) => g.discoverySource === "web_search");
    expect(webGames).toHaveLength(0);
  });

  it("tier1-skipped exhibitors appear in tier3 eligible list", async () => {
    const noData = makeExhibitor({
      id: "2",
      description: null,
      website: null,
      demoCount: 0,
    });
    const result = await discover([noData], [], {
      _runTier2: fakeRunTier2WithWebSearch,
      _runTier3: fakeRunTier3,
      webSearch: true,
    });

    // Exhibitor "2" was skipped by tier1 (no data) and should be tier3 eligible
    expect(result.stats.tier3Eligible).toBeGreaterThanOrEqual(1);
    const discovered = result.games.filter((g) => g.exhibitorId === "2");
    expect(discovered).toHaveLength(1);
    expect(discovered[0].discoverySource).toBe("web_search");
  });
});
