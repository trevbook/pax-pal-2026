import { describe, expect, test } from "bun:test";
import type { Game } from "@pax-pal/core";
import { dedup } from "./dedup";

function makeGame(overrides: Partial<Game> & { id: string; name: string }): Game {
  return {
    slug: overrides.name.toLowerCase().replace(/\s+/g, "-"),
    type: "video_game",
    tagline: null,
    summary: null,
    description: null,
    imageUrl: null,
    mediaUrls: [],
    videoThumbnails: {},
    exhibitor: "Test Studio",
    exhibitorId: "ex-1",
    boothId: null,
    showroomUrl: null,
    tags: [],
    paxTags: [],
    styleTags: [],
    isFeatured: false,
    platforms: null,
    genres: null,
    releaseStatus: null,
    steamUrl: null,
    bggId: null,
    steamAppId: null,
    pressLinks: [],
    socialLinks: { twitter: null, discord: null, youtube: null, itchIo: null },
    developerName: null,
    price: null,
    tabletopGenres: null,
    playerCount: null,
    playTime: null,
    complexity: null,
    mechanics: null,
    embedding: null,
    similarGameIds: [],
    similarGameScores: [],
    discoverySource: null,
    discoveryMeta: null,
    sourcePages: ["demos"],
    lastScrapedAt: "2026-03-25T00:00:00Z",
    enrichedAt: null,
    ...overrides,
  };
}

describe("dedup", () => {
  test("passes through unique games unchanged", () => {
    const games = [
      makeGame({ id: "demo:1", name: "Alpha" }),
      makeGame({ id: "demo:2", name: "Beta" }),
    ];
    const result = dedup(games);
    expect(result.games).toHaveLength(2);
    expect(result.stats.duplicatesRemoved).toBe(0);
    expect(result.stats.merged).toHaveLength(0);
  });

  test("removes exact name duplicates, keeping demo over discovered", () => {
    const games = [
      makeGame({ id: "discovered:ex-1:dinobreak", name: "Dinobreak" }),
      makeGame({ id: "demo:99", name: "Dinobreak", description: "A cool game" }),
    ];
    const result = dedup(games);
    expect(result.games).toHaveLength(1);
    expect(result.games[0].id).toBe("demo:99");
    expect(result.stats.duplicatesRemoved).toBe(1);
    expect(result.stats.merged).toHaveLength(1);
    expect(result.stats.merged[0].removed).toEqual(["discovered:ex-1:dinobreak"]);
  });

  test("removes duplicates with demo suffixes in name", () => {
    const games = [
      makeGame({ id: "demo:1", name: "Cool Game - PAX Demo", description: "desc" }),
      makeGame({ id: "discovered:ex-1:cool-game", name: "Cool Game" }),
    ];
    const result = dedup(games);
    expect(result.games).toHaveLength(1);
    expect(result.games[0].id).toBe("demo:1");
  });

  test("keeps the richer record among same-source duplicates", () => {
    const games = [
      makeGame({ id: "discovered:ex-1:foo", name: "Foo" }),
      makeGame({
        id: "discovered:ex-2:foo",
        name: "Foo",
        description: "Rich description",
        imageUrl: "https://img.test/foo.jpg",
        tags: ["Action"] as Game["tags"],
        embedding: [0.1, 0.2],
      }),
    ];
    const result = dedup(games);
    expect(result.games).toHaveLength(1);
    expect(result.games[0].id).toBe("discovered:ex-2:foo");
  });

  test("removes duplicates with trailing Demo (no punctuation)", () => {
    const games = [
      makeGame({ id: "demo:1", name: "AO: Containment Breach", description: "desc" }),
      makeGame({ id: "demo:2", name: "AO: Containment Breach Demo" }),
    ];
    const result = dedup(games);
    expect(result.games).toHaveLength(1);
    expect(result.stats.duplicatesRemoved).toBe(1);
  });

  test("handles three-way duplicates", () => {
    const games = [
      makeGame({ id: "demo:1", name: "Triple" }),
      makeGame({ id: "discovered:ex-1:triple", name: "Triple" }),
      makeGame({ id: "discovered:ex-2:triple", name: "Triple" }),
    ];
    const result = dedup(games);
    expect(result.games).toHaveLength(1);
    expect(result.games[0].id).toBe("demo:1");
    expect(result.stats.duplicatesRemoved).toBe(2);
    expect(result.stats.merged[0].removed).toHaveLength(2);
  });
});
