import { describe, expect, it } from "bun:test";
import type { HarmonizedGame } from "@pax-pal/core";
import type { GameClassification } from "../classify/types";
import type { EnrichmentMeta } from "../enrich/types";
import { assembleGame, buildEmbeddingText, embed, hashText } from "./embed";

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
    description: "An exciting action roguelike",
    imageUrl: "https://example.com/original.png",
    showroomUrl: null,
    isFeatured: false,
    paxTags: ["Action", "Roguelike", "Indie", "PC"],
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
// buildEmbeddingText
// ---------------------------------------------------------------------------

describe("buildEmbeddingText", () => {
  it("includes name, description, tags, type, and exhibitor", () => {
    const game = makeGame();
    const text = buildEmbeddingText(game, null, null);

    expect(text).toContain("Cool Game");
    expect(text).toContain("An exciting action roguelike");
    expect(text).toContain("Tags: Action, Roguelike, Indie, PC");
    expect(text).toContain("Type: video_game");
    expect(text).toContain("By: Cool Studio");
  });

  it("includes web summary when available", () => {
    const game = makeGame();
    const meta = makeMeta(game.id, {
      web: {
        summary: "A fast-paced roguelike with pixel art",
        description: null,
        imageUrl: null,
        platforms: [],
        genres: [],
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

    const text = buildEmbeddingText(game, meta, null);
    expect(text).toContain("A fast-paced roguelike with pixel art");
  });

  it("includes classification genres and mechanics when present", () => {
    const game = makeGame({ type: "both" });
    const cls: GameClassification = {
      genres: ["RPG", "Action"],
      tabletopGenres: ["Board Game"],
      mechanics: ["Dice"],
      audienceTags: [],
      businessTags: [],
      styleTags: [],
      platforms: ["PC"],
    };

    const text = buildEmbeddingText(game, null, cls);
    expect(text).toContain("Genres: RPG, Action");
    expect(text).toContain("Tabletop genres: Board Game");
    expect(text).toContain("Mechanics: Dice");
  });

  it("handles game with no description", () => {
    const game = makeGame({ description: null, paxTags: [] });
    const text = buildEmbeddingText(game, null, null);

    expect(text).toContain("Cool Game");
    expect(text).toContain("Type: video_game");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");
  });

  it("does not include URLs, IDs, or timestamps", () => {
    const game = makeGame();
    const text = buildEmbeddingText(game, null, null);

    expect(text).not.toContain("demo:58001");
    expect(text).not.toContain("100001");
    expect(text).not.toContain("https://");
    expect(text).not.toContain("lastScrapedAt");
  });
});

// ---------------------------------------------------------------------------
// hashText
// ---------------------------------------------------------------------------

describe("hashText", () => {
  it("returns consistent hash for same input", () => {
    expect(hashText("hello")).toBe(hashText("hello"));
  });

  it("returns different hash for different input", () => {
    expect(hashText("hello")).not.toBe(hashText("world"));
  });

  it("returns 16-char hex string", () => {
    const hash = hashText("test");
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ---------------------------------------------------------------------------
// assembleGame
// ---------------------------------------------------------------------------

describe("assembleGame", () => {
  it("produces a valid Game record from harmonized + meta + embedding", () => {
    const game = makeGame();
    const meta = makeMeta(game.id, {
      web: {
        summary: "A great action game",
        description: "Extended description here",
        imageUrl: "https://example.com/web.png",
        platforms: ["PC"],
        genres: ["Action"],
        releaseStatus: "unreleased",
        releaseDate: "2026-Q2",
        steamUrl: "https://store.steampowered.com/app/123",
        playerCount: null,
        playTime: null,
        mechanics: [],
        pressLinks: [
          {
            url: "https://pcgamer.com/review",
            title: "Review",
            source: "PC Gamer",
            type: "review",
          },
        ],
        socialLinks: {
          twitter: "https://x.com/coolgame",
          discord: null,
          youtube: null,
          itchIo: null,
        },
        trailerUrl: "https://youtube.com/watch?v=abc",
        screenshotUrls: ["https://example.com/ss1.png"],
        developerName: "Cool Dev",
      },
    });
    const embedding = [0.1, 0.2, 0.3];

    const assembled = assembleGame(game, meta, sampleClassification, embedding);

    expect(assembled.id).toBe("demo:58001");
    expect(assembled.name).toBe("Cool Game");
    expect(assembled.type).toBe("video_game");
    expect(assembled.summary).toBe("A great action game");
    expect(assembled.description).toBe("Extended description here");
    expect(assembled.imageUrl).toBe("https://example.com/web.png");
    expect(assembled.genres).toEqual(["Action", "Roguelike"]);
    expect(assembled.platforms).toEqual(["PC"]);
    expect(assembled.tags).toContain("Action");
    expect(assembled.styleTags).toEqual(["Pixel Art"]);
    expect(assembled.steamUrl).toBe("https://store.steampowered.com/app/123");
    expect(assembled.pressLinks).toHaveLength(1);
    expect(assembled.socialLinks.twitter).toBe("https://x.com/coolgame");
    expect(assembled.developerName).toBe("Cool Dev");
    expect(assembled.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(assembled.enrichedAt).toBe(now);
    expect(assembled.mediaUrls).toContain("https://example.com/ss1.png");
    expect(assembled.mediaUrls).toContain("https://youtube.com/watch?v=abc");
  });

  it("uses Steam header image over web image", () => {
    const game = makeGame();
    const meta = makeMeta(game.id, {
      web: {
        summary: null,
        description: null,
        imageUrl: "https://example.com/web.png",
        platforms: [],
        genres: [],
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
      steam: {
        steamAppId: 123,
        name: "Cool Game",
        shortDescription: null,
        headerImage: "https://cdn.steam.com/header.jpg",
        screenshots: [],
        movies: [],
        price: "$19.99",
        genres: [],
        categories: [],
        releaseDate: null,
        reviewScore: null,
        recommendationCount: null,
        platforms: { windows: true, mac: false, linux: false },
      },
    });

    const assembled = assembleGame(game, meta, sampleClassification, null);
    expect(assembled.imageUrl).toBe("https://cdn.steam.com/header.jpg");
    expect(assembled.price).toBe("$19.99");
  });

  it("falls back to original image when no enrichment", () => {
    const game = makeGame();
    const assembled = assembleGame(game, null, null, null);
    expect(assembled.imageUrl).toBe("https://example.com/original.png");
  });

  it("uses BGG data for tabletop fields", () => {
    const game = makeGame({ type: "tabletop" });
    const tabletopCls: GameClassification = {
      genres: null,
      tabletopGenres: ["Board Game"],
      mechanics: ["Dice", "Worker Placement"],
      audienceTags: [],
      businessTags: [],
      styleTags: [],
      platforms: null,
    };

    const meta = makeMeta(game.id, {
      bgg: {
        bggId: 54321,
        bggName: "Cool Game",
        matchMethod: "web_search",
        playerCount: "2-4",
        playTime: "60-90 min",
        complexity: 3.2,
        mechanics: ["Dice Rolling", "Worker Placement"],
        description: "BGG description here",
        imageUrl: "https://bgg.com/img.png",
        rating: 7.8,
        yearPublished: 2025,
      },
    });

    const assembled = assembleGame(game, meta, tabletopCls, null);
    expect(assembled.bggId).toBe(54321);
    expect(assembled.playerCount).toBe("2-4");
    expect(assembled.playTime).toBe("60-90 min");
    expect(assembled.complexity).toBe(3.2);
    expect(assembled.description).toBe("BGG description here");
    expect(assembled.tabletopGenres).toEqual(["Board Game"]);
    expect(assembled.mechanics).toEqual(["Dice", "Worker Placement"]);
  });

  it("handles game with no classification or enrichment", () => {
    const game = makeGame();
    const assembled = assembleGame(game, null, null, null);

    expect(assembled.tags).toEqual([]);
    expect(assembled.genres).toBeNull();
    expect(assembled.platforms).toBeNull();
    expect(assembled.embedding).toBeNull();
    expect(assembled.enrichedAt).toBeNull();
    expect(assembled.summary).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// embed (orchestrator with DI)
// ---------------------------------------------------------------------------

describe("embed", () => {
  const emptyClassifications = new Map<string, GameClassification>();

  it("calls _embedBatch with texts and assembles games", async () => {
    const game = makeGame();
    const cls = new Map([[game.id, sampleClassification]]);

    const fakeEmbed = async (texts: string[]) => {
      return texts.map(() => [0.1, 0.2, 0.3]);
    };

    const result = await embed([game], [], cls, { _embedBatch: fakeEmbed });

    expect(result.games).toHaveLength(1);
    expect(result.games[0].embedding).toEqual([0.1, 0.2, 0.3]);
    expect(result.games[0].name).toBe("Cool Game");
    expect(result.stats.embedded).toBe(1);
    expect(result.stats.cached).toBe(0);
  });

  it("respects limit option", async () => {
    const games = [
      makeGame({ id: "demo:1", name: "Game 1" }),
      makeGame({ id: "demo:2", name: "Game 2" }),
      makeGame({ id: "demo:3", name: "Game 3" }),
    ];

    const fakeEmbed = async (texts: string[]) => texts.map(() => [0.1]);

    const result = await embed(games, [], emptyClassifications, {
      limit: 2,
      _embedBatch: fakeEmbed,
    });

    expect(result.games).toHaveLength(2);
    expect(result.stats.totalGames).toBe(2);
  });

  it("batches in groups of 100", async () => {
    const games = Array.from({ length: 250 }, (_, i) =>
      makeGame({ id: `demo:${i}`, name: `Game ${i}` }),
    );

    let batchCount = 0;
    const fakeEmbed = async (texts: string[]) => {
      batchCount++;
      return texts.map(() => [0.1]);
    };

    const result = await embed(games, [], emptyClassifications, { _embedBatch: fakeEmbed });

    expect(batchCount).toBe(3); // 100 + 100 + 50
    expect(result.stats.batches).toBe(3);
    expect(result.stats.embedded).toBe(250);
  });

  it("passes enrichment meta to assembleGame", async () => {
    const game = makeGame();
    const meta = makeMeta(game.id, {
      web: {
        summary: "Web summary here",
        description: null,
        imageUrl: null,
        platforms: [],
        genres: [],
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

    const fakeEmbed = async (texts: string[]) => texts.map(() => [0.1]);

    const result = await embed([game], [meta], emptyClassifications, { _embedBatch: fakeEmbed });
    expect(result.games[0].summary).toBe("Web summary here");
  });
});
