import { describe, expect, test } from "bun:test";
import type {
  Game,
  GameType,
  HarmonizedExhibitor,
  HarmonizedGame,
  RawDemo,
  RawExhibitor,
  Tag,
} from "./index";
import {
  ALL_TAGS,
  AUDIENCE_TAGS,
  BUSINESS_TAGS,
  GAME_TYPES,
  OTHER_TAGS,
  PLATFORMS,
  TABLETOP_MECHANICS,
  toSlug,
  VIDEO_GAME_GENRES,
} from "./index";

describe("taxonomy constants", () => {
  test("GAME_TYPES has expected values", () => {
    expect(GAME_TYPES).toEqual(["video_game", "tabletop", "both"]);
  });

  test("PLATFORMS is non-empty", () => {
    expect(PLATFORMS.length).toBeGreaterThan(0);
  });

  test("VIDEO_GAME_GENRES is non-empty", () => {
    expect(VIDEO_GAME_GENRES.length).toBeGreaterThan(0);
  });

  test("TABLETOP_MECHANICS is non-empty", () => {
    expect(TABLETOP_MECHANICS.length).toBeGreaterThan(0);
  });

  test("ALL_TAGS includes all category tags", () => {
    const allTagSet = new Set<string>(ALL_TAGS);
    for (const tag of VIDEO_GAME_GENRES) expect(allTagSet.has(tag)).toBe(true);
    for (const tag of TABLETOP_MECHANICS) expect(allTagSet.has(tag)).toBe(true);
    for (const tag of AUDIENCE_TAGS) expect(allTagSet.has(tag)).toBe(true);
    for (const tag of BUSINESS_TAGS) expect(allTagSet.has(tag)).toBe(true);
    for (const tag of OTHER_TAGS) expect(allTagSet.has(tag)).toBe(true);
  });

  test("ALL_TAGS has no duplicates", () => {
    const unique = new Set(ALL_TAGS);
    expect(unique.size).toBe(ALL_TAGS.length);
  });
});

describe("toSlug", () => {
  test("lowercases and replaces spaces with hyphens", () => {
    expect(toSlug("Hello World")).toBe("hello-world");
  });

  test("strips special characters", () => {
    expect(toSlug("Game: The Sequel!")).toBe("game-the-sequel");
  });

  test("collapses multiple hyphens", () => {
    expect(toSlug("a -- b")).toBe("a-b");
  });

  test("trims leading/trailing hyphens", () => {
    expect(toSlug("--test--")).toBe("test");
  });

  test("handles empty string", () => {
    expect(toSlug("")).toBe("");
  });
});

describe("type compatibility", () => {
  test("RawExhibitor satisfies shape", () => {
    const raw: RawExhibitor = {
      id: "123",
      name: "Test Game",
      slug: "test-game",
      boothLocation: "Hall A",
      description: "A test game",
      imageUrl: null,
      website: "https://example.com",
      storeUrl: null,
      showroomUrl: null,
      isFeatured: false,
      paxTags: ["cat-tabletop"],
      sourcePage: "exhibitors",
      lastScrapedAt: new Date().toISOString(),
    };
    expect(raw.id).toBe("123");
  });

  test("HarmonizedExhibitor satisfies shape", () => {
    const exhibitor: HarmonizedExhibitor = {
      id: "123",
      name: "Publisher Inc",
      slug: "publisher-inc",
      boothLocation: "Hall A",
      description: "A publisher",
      imageUrl: null,
      website: "https://publisher.com",
      storeUrl: null,
      showroomUrl: null,
      isFeatured: false,
      isTabletop: false,
      paxTags: [],
      sourcePages: ["exhibitors"],
      demoCount: 3,
      exhibitorKind: null,
      discoveredGameCount: 0,
      lastScrapedAt: new Date().toISOString(),
    };
    expect(exhibitor.demoCount).toBe(3);
  });

  test("RawDemo satisfies shape", () => {
    const demo: RawDemo = {
      id: "456",
      name: "Demo Game",
      exhibitorName: "Publisher Inc",
      exhibitorId: "123",
      description: null,
      imageUrl: null,
      lastScrapedAt: new Date().toISOString(),
    };
    expect(demo.exhibitorId).toBe("123");
  });

  test("HarmonizedGame satisfies shape", () => {
    const game: HarmonizedGame = {
      id: "demo:456",
      name: "Test Game",
      slug: "test-game",
      type: "video_game",
      exhibitor: "Publisher Inc",
      exhibitorId: "123",
      boothLocation: null,
      description: null,
      imageUrl: null,
      showroomUrl: null,
      isFeatured: false,
      paxTags: [],
      sourcePages: ["exhibitors", "demos"],
      demoId: "456",
      discoverySource: null,
      lastScrapedAt: new Date().toISOString(),
    };
    expect(game.type).toBe("video_game");
  });

  test("Game satisfies shape", () => {
    const game: Game = {
      id: "123",
      name: "Test Game",
      slug: "test-game",
      type: "both",
      summary: "A great game",
      description: "Full description here",
      imageUrl: "https://example.com/img.png",
      mediaUrls: [],
      exhibitor: "Publisher Inc",
      exhibitorId: "123",
      boothId: "A-101",
      showroomUrl: null,
      tags: ["RPG", "Co-op"] satisfies Tag[],
      paxTags: ["cat-tabletop", "tag-rpg"],
      styleTags: ["Retro"],
      isFeatured: true,
      platforms: ["PC", "Switch"],
      genres: ["RPG"],
      releaseStatus: "Early Access",
      steamUrl: null,
      bggId: null,
      steamAppId: null,
      pressLinks: [],
      socialLinks: { twitter: null, discord: null, youtube: null, itchIo: null },
      developerName: null,
      price: null,
      tabletopGenres: ["Board Game"],
      playerCount: "2-4",
      playTime: "60-90 min",
      complexity: 3.2,
      mechanics: ["Co-op Play"],
      embedding: null,
      discoverySource: null,
      discoveryMeta: null,
      sourcePages: ["exhibitors", "tabletop", "demos"],
      lastScrapedAt: new Date().toISOString(),
      enrichedAt: new Date().toISOString(),
    };
    expect(game.type satisfies GameType).toBe("both");
  });
});
