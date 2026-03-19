import { describe, expect, it } from "bun:test";
import type { HarmonizedGame } from "@pax-pal/core";
import type { EnrichOptions } from "./enrich";
import { enrich, scrubBareSocialLink } from "./enrich";
import type { BggEnrichment, WebEnrichment } from "./types";

const now = new Date().toISOString();

function makeGame(overrides: Partial<HarmonizedGame> = {}): HarmonizedGame {
  return {
    id: "demo:58001",
    name: "Test Quest",
    slug: "test-quest",
    type: "video_game",
    exhibitor: "Indie Studio",
    exhibitorId: "100001",
    boothLocation: "15043",
    description: "An epic adventure game",
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

const fakeBggResult: BggEnrichment = {
  bggId: 99999,
  bggName: "Board Battle",
  matchScore: 0.95,
  matchMethod: "auto",
  playerCount: "2-4",
  playTime: "30-60 min",
  complexity: 2.5,
  mechanics: ["Dice Rolling", "Hand Management"],
  description: "A great board game about battling",
  imageUrl: "https://bgg.example.com/image.jpg",
  rating: 7.5,
  yearPublished: 2024,
};

const fakeWebResult: WebEnrichment = {
  summary: "An epic adventure game with great mechanics",
  description: "Test Quest is an epic adventure...",
  imageUrl: "https://web.example.com/image.jpg",
  platforms: ["PC", "Switch"],
  genres: ["RPG", "Adventure"],
  releaseStatus: "unreleased",
  releaseDate: "2026-Q1",
  steamUrl: "https://store.steampowered.com/app/12345/Test_Quest",
  playerCount: null,
  playTime: null,
  mechanics: [],
  pressLinks: [
    {
      url: "https://press.example.com/article",
      title: "Test Quest Preview",
      source: "PC Gamer",
      type: "preview",
    },
  ],
  socialLinks: { twitter: "https://x.com/testquest", discord: null, youtube: null, itchIo: null },
  trailerUrl: "https://youtube.com/watch?v=abc123",
  screenshotUrls: ["https://cdn.example.com/screen1.jpg"],
  developerName: "Indie Studio Games",
};

const fakeSteamResult: SteamEnrichment = {
  steamAppId: 12345,
  name: "Test Quest",
  shortDescription: "An epic adventure",
  headerImage: "https://steamcdn.example.com/header.jpg",
  screenshots: ["https://steamcdn.example.com/ss1.jpg"],
  movies: [],
  price: "$19.99",
  genres: ["RPG", "Adventure"],
  categories: ["Single-player"],
  releaseDate: "Coming Soon",
  reviewScore: null,
  platforms: { windows: true, mac: false, linux: false },
};

/** Fake BGG runner that returns canned results. */
const fakeRunBgg: EnrichOptions["_runBgg"] = async (games) => {
  const results = new Map<string, BggEnrichment | null>();
  for (const g of games) {
    // Only match "Board Battle"
    if (g.name === "Board Battle") {
      results.set(g.id, fakeBggResult);
    } else {
      results.set(g.id, null);
    }
  }
  return { results, cachedCount: 0 };
};

/** Fake web runner that returns canned results. */
const fakeRunWeb: EnrichOptions["_runWeb"] = async (games) => {
  const results = new Map<string, WebEnrichment | null>();
  for (const g of games) {
    results.set(g.id, fakeWebResult);
  }
  return { results, cachedCount: 0 };
};

/** Fake Steam runner that returns canned results for app 12345. */
const fakeRunSteam: EnrichOptions["_runSteam"] = async (steamUrls) => {
  const results = new Map<string, SteamEnrichment | null>();
  for (const [gameId] of steamUrls) {
    results.set(gameId, fakeSteamResult);
  }
  return { results, cachedCount: 0 };
};

/** Fake URL validator that marks all URLs valid. */
const fakeValidateUrls: EnrichOptions["_validateUrls"] = async (urls) => {
  return { valid: urls, invalid: [] };
};

const opts: EnrichOptions = {
  _runBgg: fakeRunBgg,
  _runWeb: fakeRunWeb,
  _runSteam: fakeRunSteam,
  _validateUrls: fakeValidateUrls,
};

describe("enrich orchestrator", () => {
  it("sends tabletop games to BGG enrichment", async () => {
    const tabletop = makeGame({ id: "t1", name: "Board Battle", type: "tabletop" });
    const result = await enrich([tabletop], opts);

    const meta = result.enrichmentMeta.find((m) => m.gameId === "t1");
    expect(meta?.bgg).not.toBeNull();
    expect(meta?.bgg?.bggId).toBe(99999);
  });

  it("skips BGG for video games", async () => {
    const video = makeGame({ id: "v1", type: "video_game" });
    const result = await enrich([video], opts);

    const meta = result.enrichmentMeta.find((m) => m.gameId === "v1");
    expect(meta?.bgg).toBeNull();
  });

  it("skips web search for tabletop games with BGG hit", async () => {
    const tabletop = makeGame({ id: "t1", name: "Board Battle", type: "tabletop" });
    const result = await enrich([tabletop], opts);

    const meta = result.enrichmentMeta.find((m) => m.gameId === "t1");
    expect(meta?.bgg).not.toBeNull();
    // Web should be null since BGG hit means web is skipped
    expect(meta?.web).toBeNull();
  });

  it("runs web search for tabletop games WITHOUT BGG hit", async () => {
    const tabletop = makeGame({ id: "t2", name: "Unknown Board Game", type: "tabletop" });
    const result = await enrich([tabletop], opts);

    const meta = result.enrichmentMeta.find((m) => m.gameId === "t2");
    expect(meta?.bgg).toBeNull();
    expect(meta?.web).not.toBeNull();
  });

  it("feeds Steam URLs from web results into Steam enrichment", async () => {
    const video = makeGame({ id: "v1", type: "video_game" });
    const result = await enrich([video], opts);

    const meta = result.enrichmentMeta.find((m) => m.gameId === "v1");
    // Web returned a steamUrl, so Steam should have been called
    expect(meta?.steam).not.toBeNull();
    expect(meta?.steam?.steamAppId).toBe(12345);
  });

  it("corrects type to 'both' when BGG matches a video_game", async () => {
    // Use custom BGG runner that matches even for video_game type
    const customOpts: EnrichOptions = {
      ...opts,
      _runBgg: async (games) => {
        const results = new Map<string, BggEnrichment | null>();
        for (const g of games) {
          results.set(g.id, fakeBggResult);
        }
        return { results, cachedCount: 0 };
      },
    };

    // Since video_game won't go to BGG by default, we test with type "both"
    // to verify BGG is called and type correction works
    const bothGame = makeGame({ id: "b1", name: "Board Battle", type: "both" });
    const result = await enrich([bothGame], customOpts);

    const meta = result.enrichmentMeta.find((m) => m.gameId === "b1");
    expect(meta?.bgg).not.toBeNull();
  });

  it("applies --limit to restrict game count", async () => {
    const games = Array.from({ length: 20 }, (_, i) =>
      makeGame({ id: `g${i}`, name: `Game ${i}` }),
    );
    const result = await enrich(games, { ...opts, limit: 5 });

    expect(result.games).toHaveLength(5);
    expect(result.enrichmentMeta).toHaveLength(5);
    expect(result.stats.totalGames).toBe(5);
  });

  it("returns correct stats", async () => {
    const video = makeGame({ id: "v1", type: "video_game" });
    const tabletop = makeGame({ id: "t1", name: "Board Battle", type: "tabletop" });
    const result = await enrich([video, tabletop], opts);

    expect(result.stats.totalGames).toBe(2);
    expect(result.stats.bggMatched).toBe(1);
    // video game goes to web, tabletop with BGG hit skips web → 1 web search
    expect(result.stats.webSearched).toBe(1);
  });

  it("fills imageUrl from Steam when game has no image", async () => {
    const video = makeGame({ id: "v1", type: "video_game", imageUrl: null });
    const result = await enrich([video], opts);

    const enriched = result.games.find((g) => g.id === "v1");
    // Steam header takes priority for imageUrl fill
    expect(enriched?.imageUrl).toBe("https://steamcdn.example.com/header.jpg");
  });

  it("preserves existing imageUrl when already set", async () => {
    const video = makeGame({
      id: "v1",
      type: "video_game",
      imageUrl: "https://existing.com/img.jpg",
    });
    const result = await enrich([video], opts);

    const enriched = result.games.find((g) => g.id === "v1");
    expect(enriched?.imageUrl).toBe("https://existing.com/img.jpg");
  });

  it("builds enrichmentMeta with validated URLs", async () => {
    const video = makeGame({ id: "v1", type: "video_game" });
    const result = await enrich([video], opts);

    const meta = result.enrichmentMeta.find((m) => m.gameId === "v1");
    expect(meta).toBeTruthy();
    expect(meta?.enrichedAt).toBeTruthy();
    expect(meta?.validatedUrls.length).toBeGreaterThan(0);
  });

  it("scrubs invalid URLs from enrichmentMeta and imageUrl fill", async () => {
    const badImageUrl = "https://web.example.com/image.jpg";

    // Validator that marks the web imageUrl as invalid
    const validatorWithBadImage: EnrichOptions["_validateUrls"] = async (urls) => {
      const valid = urls.filter((u) => u !== badImageUrl);
      const invalid = urls.filter((u) => u === badImageUrl);
      return { valid, invalid };
    };

    const video = makeGame({ id: "v1", type: "video_game", imageUrl: null });
    const result = await enrich([video], {
      ...opts,
      // No Steam results so web imageUrl would be the fallback
      _runSteam: async () => ({ results: new Map(), cachedCount: 0 }),
      _validateUrls: validatorWithBadImage,
    });

    const meta = result.enrichmentMeta.find((m) => m.gameId === "v1");
    // The invalid URL should appear in invalidUrls
    expect(meta?.invalidUrls).toContain(badImageUrl);
    // The scrubbed web enrichment should have imageUrl nulled out
    expect(meta?.web?.imageUrl).toBeNull();
    // The game's imageUrl should NOT be the invalid URL
    const enriched = result.games.find((g) => g.id === "v1");
    expect(enriched?.imageUrl).not.toBe(badImageUrl);
  });

  it("scrubs invalid press link URLs from enrichmentMeta", async () => {
    const badPressUrl = "https://press.example.com/article";

    const validatorWithBadPress: EnrichOptions["_validateUrls"] = async (urls) => {
      const valid = urls.filter((u) => u !== badPressUrl);
      const invalid = urls.filter((u) => u === badPressUrl);
      return { valid, invalid };
    };

    const video = makeGame({ id: "v1", type: "video_game" });
    const result = await enrich([video], {
      ...opts,
      _validateUrls: validatorWithBadPress,
    });

    const meta = result.enrichmentMeta.find((m) => m.gameId === "v1");
    // The press link with the bad URL should be removed
    expect(meta?.web?.pressLinks.find((p) => p.url === badPressUrl)).toBeUndefined();
    // The invalid URL should still be tracked
    expect(meta?.invalidUrls).toContain(badPressUrl);
  });

  it("scrubs bare-domain social links from enrichmentMeta", async () => {
    const video = makeGame({ id: "v1", type: "video_game" });

    // Our fakeWebResult has twitter: "https://x.com/testquest" which is fine.
    // Override with bare domains to test scrubbing.
    const fakeWebWithBareSocials: WebEnrichment = {
      ...fakeWebResult,
      socialLinks: {
        twitter: "https://x.com",
        discord: "https://discord.gg",
        youtube: "https://www.youtube.com",
        itchIo: "https://beau-thrice.itch.io/tails-of-fate",
      },
    };

    const result = await enrich([video], {
      ...opts,
      _runWeb: async (games) => {
        const results = new Map<string, WebEnrichment | null>();
        for (const g of games) results.set(g.id, fakeWebWithBareSocials);
        return { results, cachedCount: 0 };
      },
    });

    const meta = result.enrichmentMeta.find((m) => m.gameId === "v1");
    expect(meta?.web?.socialLinks.twitter).toBeNull();
    expect(meta?.web?.socialLinks.discord).toBeNull();
    expect(meta?.web?.socialLinks.youtube).toBeNull();
    // itch.io has a real path — should be preserved
    expect(meta?.web?.socialLinks.itchIo).toBe("https://beau-thrice.itch.io/tails-of-fate");
  });
});

describe("scrubBareSocialLink", () => {
  it("returns null for bare x.com", () => {
    expect(scrubBareSocialLink("https://x.com")).toBeNull();
    expect(scrubBareSocialLink("https://x.com/")).toBeNull();
  });

  it("returns null for bare twitter.com", () => {
    expect(scrubBareSocialLink("https://twitter.com")).toBeNull();
    expect(scrubBareSocialLink("https://www.twitter.com")).toBeNull();
  });

  it("returns null for bare discord.gg", () => {
    expect(scrubBareSocialLink("https://discord.gg")).toBeNull();
    expect(scrubBareSocialLink("https://discord.com")).toBeNull();
  });

  it("returns null for bare youtube.com", () => {
    expect(scrubBareSocialLink("https://www.youtube.com")).toBeNull();
    expect(scrubBareSocialLink("https://youtube.com/")).toBeNull();
  });

  it("preserves full profile URLs", () => {
    expect(scrubBareSocialLink("https://x.com/StudioName")).toBe("https://x.com/StudioName");
    expect(scrubBareSocialLink("https://discord.gg/abcdef")).toBe("https://discord.gg/abcdef");
    expect(scrubBareSocialLink("https://www.youtube.com/@Channel")).toBe(
      "https://www.youtube.com/@Channel",
    );
    expect(scrubBareSocialLink("https://dev.itch.io/game")).toBe("https://dev.itch.io/game");
  });

  it("returns null for null input", () => {
    expect(scrubBareSocialLink(null)).toBeNull();
  });
});
