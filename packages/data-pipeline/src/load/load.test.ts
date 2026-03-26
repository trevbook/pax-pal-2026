import { describe, expect, it } from "bun:test";
import type { Game, HarmonizedExhibitor } from "@pax-pal/core";
import { chunk, contentHash, load, toExhibitorItem, toGameItem } from "./load";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = new Date().toISOString();

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: "demo:58001",
    name: "Cool Game",
    slug: "cool-game",
    type: "video_game",
    summary: "A cool game summary",
    description: "An exciting action roguelike",
    imageUrl: "https://example.com/original.png",
    mediaUrls: [],
    videoThumbnails: {},
    exhibitor: "Cool Studio",
    exhibitorId: "100001",
    boothId: "15043",
    showroomUrl: null,
    tags: ["Action", "Roguelike"],
    paxTags: ["Action", "Roguelike"],
    styleTags: [],
    isFeatured: false,
    platforms: ["PC"],
    genres: ["Action", "Roguelike"],
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
    embedding: [0.1, 0.2, 0.3],
    similarGameIds: [],
    discoverySource: null,
    discoveryMeta: null,
    sourcePages: ["exhibitors", "demos"],
    lastScrapedAt: now,
    enrichedAt: now,
    ...overrides,
  };
}

function makeExhibitor(overrides: Partial<HarmonizedExhibitor> = {}): HarmonizedExhibitor {
  return {
    id: "100001",
    name: "Cool Studio",
    slug: "cool-studio",
    boothLocation: "15043",
    description: "We make cool games",
    imageUrl: "https://example.com/studio.png",
    website: "https://coolstudio.com",
    storeUrl: null,
    showroomUrl: null,
    isFeatured: false,
    isTabletop: false,
    paxTags: ["Indie"],
    sourcePages: ["exhibitors"],
    demoCount: 1,
    exhibitorKind: "game_studio",
    discoveredGameCount: 0,
    lastScrapedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// toGameItem
// ---------------------------------------------------------------------------

describe("toGameItem", () => {
  it("sets pk to GAME#{id}", () => {
    const item = toGameItem(makeGame({ id: "demo:99" }));
    expect(item.pk).toBe("GAME#demo:99");
  });

  it("strips the embedding field", () => {
    const game = makeGame({ embedding: [1, 2, 3, 4, 5] });
    const item = toGameItem(game);
    expect(item.embedding).toBeUndefined();
  });

  it("sets status to active", () => {
    const item = toGameItem(makeGame());
    expect(item.status).toBe("active");
  });

  it("includes a _contentHash", () => {
    const item = toGameItem(makeGame());
    expect(item._contentHash).toBeString();
    expect((item._contentHash as string).length).toBe(16);
  });

  it("sets boothId to NONE when null", () => {
    const item = toGameItem(makeGame({ boothId: null }));
    expect(item.boothId).toBe("NONE");
  });

  it("preserves existing boothId", () => {
    const item = toGameItem(makeGame({ boothId: "15043" }));
    expect(item.boothId).toBe("15043");
  });
});

// ---------------------------------------------------------------------------
// toExhibitorItem
// ---------------------------------------------------------------------------

describe("toExhibitorItem", () => {
  it("sets pk to EXHIBITOR#{id}", () => {
    const item = toExhibitorItem(makeExhibitor({ id: "200" }));
    expect(item.pk).toBe("EXHIBITOR#200");
  });

  it("maps exhibitorKind to kind", () => {
    const item = toExhibitorItem(makeExhibitor({ exhibitorKind: "publisher" }));
    expect(item.kind).toBe("publisher");
  });

  it("sets kind to NONE when exhibitorKind is null", () => {
    const item = toExhibitorItem(makeExhibitor({ exhibitorKind: null }));
    expect(item.kind).toBe("NONE");
  });

  it("sets status to active", () => {
    const item = toExhibitorItem(makeExhibitor());
    expect(item.status).toBe("active");
  });

  it("includes a _contentHash", () => {
    const item = toExhibitorItem(makeExhibitor());
    expect(item._contentHash).toBeString();
    expect((item._contentHash as string).length).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// contentHash
// ---------------------------------------------------------------------------

describe("contentHash", () => {
  it("is deterministic", () => {
    const a = contentHash({ name: "foo", value: 1 });
    const b = contentHash({ name: "foo", value: 1 });
    expect(a).toBe(b);
  });

  it("changes when data changes", () => {
    const a = contentHash({ name: "foo", value: 1 });
    const b = contentHash({ name: "foo", value: 2 });
    expect(a).not.toBe(b);
  });

  it("ignores _contentHash field", () => {
    const a = contentHash({ name: "foo" });
    const b = contentHash({ name: "foo", _contentHash: "abc123" });
    expect(a).toBe(b);
  });

  it("ignores embedding field", () => {
    const a = contentHash({ name: "foo" });
    const b = contentHash({ name: "foo", embedding: [1, 2, 3] });
    expect(a).toBe(b);
  });

  it("is order-independent for keys", () => {
    const a = contentHash({ b: 2, a: 1 });
    const b = contentHash({ a: 1, b: 2 });
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// chunk
// ---------------------------------------------------------------------------

describe("chunk", () => {
  it("splits array into chunks of the given size", () => {
    const result = chunk([1, 2, 3, 4, 5], 2);
    expect(result).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("handles exact multiples", () => {
    const result = chunk([1, 2, 3, 4], 2);
    expect(result).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("handles empty array", () => {
    const result = chunk([], 5);
    expect(result).toEqual([]);
  });

  it("handles chunk size larger than array", () => {
    const result = chunk([1, 2], 10);
    expect(result).toEqual([[1, 2]]);
  });
});

// ---------------------------------------------------------------------------
// load (dry-run mode)
// ---------------------------------------------------------------------------

describe("load", () => {
  it("dry-run does not call AWS and returns skipped stats", async () => {
    const games = [makeGame(), makeGame({ id: "demo:58002", name: "Another Game" })];
    const exhibitors = [makeExhibitor()];

    const result = await load(games, exhibitors, {
      gamesTableName: "TestGames",
      exhibitorsTableName: "TestExhibitors",
      vectorIndexArn: "arn:aws:s3vectors:us-east-1:123:bucket/test/index/test",
      dryRun: true,
    });

    expect(result.stats.games.total).toBe(2);
    expect(result.stats.games.skipped).toBe(2);
    expect(result.stats.games.written).toBe(0);
    expect(result.stats.exhibitors.total).toBe(1);
    expect(result.stats.exhibitors.skipped).toBe(1);
    expect(result.stats.exhibitors.written).toBe(0);
    expect(result.stats.vectors.total).toBe(2);
    expect(result.stats.vectors.skipped).toBe(2);
    expect(result.stats.vectors.written).toBe(0);
  });

  it("calls DynamoDB and S3 Vectors with injected clients", async () => {
    const dynamoWrites: { tableName: string; items: unknown[] }[] = [];
    const vectorWrites: { indexArn: string; vectors: unknown[] }[] = [];

    // Mock DynamoDB document client
    const mockDocClient = {
      send: async (cmd: unknown) => {
        const command = cmd as { input: { RequestItems: Record<string, unknown[]> } };
        for (const [tableName, items] of Object.entries(command.input.RequestItems)) {
          dynamoWrites.push({ tableName, items });
        }
        return {};
      },
    };

    // Mock S3 Vectors client
    const mockS3VectorsClient = {
      send: async (cmd: unknown) => {
        const command = cmd as { input: { indexArn: string; vectors: unknown[] } };
        vectorWrites.push({
          indexArn: command.input.indexArn,
          vectors: command.input.vectors,
        });
        return {};
      },
    };

    const games = [makeGame()];
    const exhibitors = [makeExhibitor()];

    const result = await load(games, exhibitors, {
      gamesTableName: "TestGames",
      exhibitorsTableName: "TestExhibitors",
      vectorIndexArn: "arn:aws:s3vectors:us-east-1:123:bucket/test/index/test",
      _docClient: mockDocClient as never,
      _s3VectorsClient: mockS3VectorsClient as never,
    });

    // DynamoDB writes
    expect(dynamoWrites.length).toBe(2); // 1 batch for games, 1 for exhibitors
    expect(dynamoWrites[0].tableName).toBe("TestGames");
    expect(dynamoWrites[1].tableName).toBe("TestExhibitors");

    // S3 Vectors writes
    expect(vectorWrites.length).toBe(1);
    expect(vectorWrites[0].indexArn).toBe("arn:aws:s3vectors:us-east-1:123:bucket/test/index/test");

    // Stats
    expect(result.stats.games.written).toBe(1);
    expect(result.stats.exhibitors.written).toBe(1);
    expect(result.stats.vectors.written).toBe(1);
  });

  it("skips vectors for games without embeddings", async () => {
    const vectorWrites: unknown[][] = [];

    const mockDocClient = { send: async () => ({}) };
    const mockS3VectorsClient = {
      send: async (cmd: unknown) => {
        const command = cmd as { input: { vectors: unknown[] } };
        vectorWrites.push(command.input.vectors);
        return {};
      },
    };

    const games = [
      makeGame({ embedding: [0.1, 0.2] }),
      makeGame({ id: "demo:58002", name: "No Embedding", embedding: null }),
    ];

    const result = await load(games, [makeExhibitor()], {
      gamesTableName: "TestGames",
      exhibitorsTableName: "TestExhibitors",
      vectorIndexArn: "arn:aws:s3vectors:us-east-1:123:bucket/test/index/test",
      _docClient: mockDocClient as never,
      _s3VectorsClient: mockS3VectorsClient as never,
    });

    expect(result.stats.vectors.written).toBe(1);
    expect(result.stats.vectors.skipped).toBe(1);
  });
});
