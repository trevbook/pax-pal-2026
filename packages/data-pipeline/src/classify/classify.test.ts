import { describe, expect, it } from "bun:test";
import type { HarmonizedGame } from "@pax-pal/core";
import type { EnrichmentMeta } from "../enrich/types";
import { buildGamePrompt, buildTags, classify } from "./classify";
import type { GameClassification } from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = new Date().toISOString();

function makeGame(overrides: Partial<HarmonizedGame> = {}): HarmonizedGame {
  return {
    id: "demo:58001",
    name: "Cool Game",
    slug: "cool-game",
    type: "video_game",
    exhibitor: "Cool Studio",
    exhibitorId: "100001",
    boothLocation: "15043",
    description: "An exciting action roguelike with pixel art style",
    imageUrl: null,
    showroomUrl: null,
    isFeatured: false,
    paxTags: ["Action", "Roguelike", "Indie", "PC", "Single Player"],
    sourcePages: ["exhibitors", "demos"],
    demoId: "58001",
    discoverySource: null,
    discoveryMeta: null,
    lastScrapedAt: now,
    ...overrides,
  };
}

function makeMeta(gameId: string, overrides: Partial<EnrichmentMeta> = {}): EnrichmentMeta {
  return {
    gameId,
    bgg: null,
    web: null,
    steam: null,
    validatedUrls: [],
    invalidUrls: [],
    enrichedAt: now,
    ...overrides,
  };
}

const sampleClassification: GameClassification = {
  genres: ["Action", "Roguelike"],
  tabletopGenres: null,
  mechanics: null,
  audienceTags: ["Single-Player"],
  businessTags: ["Indie"],
  styleTags: ["Pixel Art"],
  platforms: ["PC"],
};

// ---------------------------------------------------------------------------
// buildGamePrompt
// ---------------------------------------------------------------------------

describe("buildGamePrompt", () => {
  it("includes game name, type, and paxTags", () => {
    const game = makeGame();
    const prompt = buildGamePrompt({ game, meta: null });

    expect(prompt).toContain("Name: Cool Game");
    expect(prompt).toContain("Type: video_game");
    expect(prompt).toContain("PAX Tags: Action, Roguelike, Indie, PC, Single Player");
  });

  it("includes description truncated to 500 chars", () => {
    const longDesc = "A".repeat(600);
    const game = makeGame({ description: longDesc });
    const prompt = buildGamePrompt({ game, meta: null });

    expect(prompt).toContain(`Description: ${"A".repeat(500)}`);
    expect(prompt).not.toContain("A".repeat(501));
  });

  it("handles missing description", () => {
    const game = makeGame({ description: null });
    const prompt = buildGamePrompt({ game, meta: null });

    expect(prompt).toContain("Description: (none available)");
  });

  it("includes enrichment web genres and mechanics", () => {
    const game = makeGame();
    const meta = makeMeta(game.id, {
      web: {
        summary: "A game",
        description: null,
        imageUrl: null,
        platforms: ["PC"],
        genres: ["Action", "Roguelite"],
        releaseStatus: null,
        releaseDate: null,
        steamUrl: null,
        playerCount: null,
        playTime: null,
        mechanics: [],
        pressLinks: [],
        socialLinks: { twitter: null, discord: null, youtube: null, itchIo: null },
        trailerUrl: null,
        screenshotUrls: [],
        developerName: null,
      },
    });

    const prompt = buildGamePrompt({ game, meta });
    expect(prompt).toContain("Web genres: Action, Roguelite");
    expect(prompt).toContain("Web platforms: PC");
  });

  it("includes BGG mechanics when present", () => {
    const game = makeGame({ type: "tabletop" });
    const meta = makeMeta(game.id, {
      bgg: {
        bggId: 12345,
        bggName: "Cool Game",
        matchScore: 0.95,
        matchMethod: "auto",
        playerCount: "2-4",
        playTime: "60 min",
        complexity: 2.5,
        mechanics: ["Hand Management", "Set Collection"],
        description: null,
        imageUrl: null,
        rating: 7.5,
        yearPublished: 2025,
      },
    });

    const prompt = buildGamePrompt({ game, meta });
    expect(prompt).toContain("BGG mechanics: Hand Management, Set Collection");
  });

  it("includes Steam genres and categories", () => {
    const game = makeGame();
    const meta = makeMeta(game.id, {
      steam: {
        steamAppId: 123456,
        name: "Cool Game",
        shortDescription: null,
        headerImage: null,
        screenshots: [],
        movies: [],
        price: "$19.99",
        genres: ["Action", "RPG"],
        categories: ["Single-player", "Co-op"],
        releaseDate: null,
        reviewScore: null,
        recommendationCount: null,
        platforms: { windows: true, mac: false, linux: false },
      },
    });

    const prompt = buildGamePrompt({ game, meta });
    expect(prompt).toContain("Steam genres: Action, RPG");
    expect(prompt).toContain("Steam categories: Single-player, Co-op");
  });
});

// ---------------------------------------------------------------------------
// buildTags
// ---------------------------------------------------------------------------

describe("buildTags", () => {
  it("builds unified tags array from video game classification", () => {
    const tags = buildTags(sampleClassification);

    expect(tags).toContain("Action");
    expect(tags).toContain("Roguelike");
    expect(tags).toContain("Single-Player");
    expect(tags).toContain("Indie");
    expect(tags).toContain("Pixel Art");
    expect(tags).not.toContain("PC"); // platforms are not tags
  });

  it("includes tabletop genres and mechanics", () => {
    const tabletopClassification: GameClassification = {
      genres: null,
      tabletopGenres: ["Card Game"],
      mechanics: ["Deck-Builder", "Hand Management"],
      audienceTags: ["Family-Friendly"],
      businessTags: [],
      styleTags: [],
      platforms: null,
    };

    const tags = buildTags(tabletopClassification);
    expect(tags).toContain("Card Game");
    expect(tags).toContain("Deck-Builder");
    expect(tags).toContain("Hand Management");
    expect(tags).toContain("Family-Friendly");
  });

  it("handles type 'both' with all fields populated", () => {
    const bothClassification: GameClassification = {
      genres: ["RPG"],
      tabletopGenres: ["RPG/TTRPG"],
      mechanics: ["Dice"],
      audienceTags: ["Multiplayer", "Co-op"],
      businessTags: ["Indie"],
      styleTags: ["Narrative-Driven"],
      platforms: ["PC"],
    };

    const tags = buildTags(bothClassification);
    expect(tags).toContain("RPG");
    expect(tags).toContain("RPG/TTRPG");
    expect(tags).toContain("Dice");
    expect(tags).toContain("Multiplayer");
    expect(tags).toContain("Indie");
    expect(tags).toContain("Narrative-Driven");
    expect(tags).not.toContain("PC"); // platforms are not tags
  });
});

// ---------------------------------------------------------------------------
// classify (orchestrator with DI)
// ---------------------------------------------------------------------------

describe("classify", () => {
  const fakeClassifyOne = async () => sampleClassification;

  it("calls _classifyOne per game", async () => {
    const game = makeGame();
    const meta = makeMeta(game.id);
    const called: string[] = [];

    const fake = async (ctx: { game: HarmonizedGame; meta: EnrichmentMeta | null }) => {
      called.push(ctx.game.id);
      return sampleClassification;
    };

    const result = await classify([game], [meta], { _classifyOne: fake });

    expect(called).toEqual(["demo:58001"]);
    expect(result.stats.classified).toBe(1);
    expect(result.stats.cached).toBe(0);
    expect(result.classifications.size).toBe(1);
  });

  it("respects limit option", async () => {
    const games = [
      makeGame({ id: "demo:1", name: "Game 1" }),
      makeGame({ id: "demo:2", name: "Game 2" }),
      makeGame({ id: "demo:3", name: "Game 3" }),
    ];

    const result = await classify(games, [], { limit: 2, _classifyOne: fakeClassifyOne });

    expect(result.stats.totalGames).toBe(2);
    expect(result.games).toHaveLength(2);
  });

  it("looks up enrichment meta by game ID", async () => {
    const game = makeGame();
    const meta = makeMeta(game.id, {
      web: {
        summary: "Test",
        description: null,
        imageUrl: null,
        platforms: [],
        genres: ["Action"],
        releaseStatus: null,
        releaseDate: null,
        steamUrl: null,
        playerCount: null,
        playTime: null,
        mechanics: [],
        pressLinks: [],
        socialLinks: { twitter: null, discord: null, youtube: null, itchIo: null },
        trailerUrl: null,
        screenshotUrls: [],
        developerName: null,
      },
    });

    const captured: { meta: EnrichmentMeta | null } = { meta: null };
    const fake = async (ctx: { game: HarmonizedGame; meta: EnrichmentMeta | null }) => {
      captured.meta = ctx.meta;
      return sampleClassification;
    };

    await classify([game], [meta], { _classifyOne: fake });
    expect(captured.meta).not.toBeNull();
    expect(captured.meta?.web?.genres).toEqual(["Action"]);
  });

  it("runs concurrent chunks with configurable concurrency", async () => {
    const games = Array.from({ length: 25 }, (_, i) =>
      makeGame({ id: `demo:${i}`, name: `Game ${i}` }),
    );

    let callCount = 0;
    const fake = async () => {
      callCount++;
      return sampleClassification;
    };

    const result = await classify(games, [], { concurrency: 10, _classifyOne: fake });

    expect(callCount).toBe(25);
    expect(result.stats.batches).toBe(3); // 10 + 10 + 5
    expect(result.stats.classified).toBe(25);
  });
});
