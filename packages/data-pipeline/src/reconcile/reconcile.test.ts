import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HarmonizedGame } from "@pax-pal/core";
import { migrateEnrichCaches, namesMatch, normalizeForMatch, reconcile } from "./reconcile";

const now = new Date().toISOString();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDemoGame(overrides: Partial<HarmonizedGame> = {}): HarmonizedGame {
  return {
    id: "demo:58001",
    name: "Cool Game",
    slug: "cool-game",
    type: "video_game",
    exhibitor: "Cool Studio",
    exhibitorId: "100001",
    boothLocation: "15043",
    description: "A cool game",
    imageUrl: null,
    showroomUrl: null,
    isFeatured: false,
    paxTags: [],
    sourcePages: ["exhibitors", "demos"],
    demoId: "58001",
    discoverySource: null,
    discoveryMeta: null,
    lastScrapedAt: now,
    ...overrides,
  };
}

function makeDiscoveredGame(overrides: Partial<HarmonizedGame> = {}): HarmonizedGame {
  return {
    id: "discovered:100001:cool-game",
    name: "Cool Game",
    slug: "cool-game",
    type: "video_game",
    exhibitor: "Cool Studio",
    exhibitorId: "100001",
    boothLocation: "15043",
    description: "A cool game from discovery",
    imageUrl: null,
    showroomUrl: null,
    isFeatured: false,
    paxTags: [],
    sourcePages: ["exhibitors"],
    demoId: null,
    discoverySource: "description_explicit",
    discoveryMeta: null,
    lastScrapedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalizeForMatch
// ---------------------------------------------------------------------------

describe("normalizeForMatch", () => {
  it("strips PAX demo suffixes", () => {
    expect(normalizeForMatch("Cool Game - PAX Demo")).toBe("cool-game");
    expect(normalizeForMatch("Cool Game - PAX East Demo")).toBe("cool-game");
    expect(normalizeForMatch("Cool Game (Demo)")).toBe("cool-game");
    expect(normalizeForMatch("Cool Game - Demo Edition")).toBe("cool-game");
  });

  it("strips preview/hands-on suffixes", () => {
    expect(normalizeForMatch("Cool Game - Preview Build")).toBe("cool-game");
    expect(normalizeForMatch("Cool Game (Hands-On)")).toBe("cool-game");
    expect(normalizeForMatch("Cool Game - Playable Demo")).toBe("cool-game");
  });

  it("strips trailing Demo without punctuation", () => {
    expect(normalizeForMatch("AO: Containment Breach Demo")).toBe("ao-containment-breach");
    expect(normalizeForMatch("Cool Game Demo")).toBe("cool-game");
    expect(normalizeForMatch("Cool Game Demo Edition")).toBe("cool-game");
  });

  it("strips bracket-wrapped suffixes", () => {
    expect(normalizeForMatch("Cool Game [Demo]")).toBe("cool-game");
    expect(normalizeForMatch("Cool Game [PAX Preview]")).toBe("cool-game");
  });

  it("leaves normal names alone", () => {
    expect(normalizeForMatch("Cool Game")).toBe("cool-game");
    expect(normalizeForMatch("Cool Game 2: Reloaded")).toBe("cool-game-2-reloaded");
  });
});

// ---------------------------------------------------------------------------
// namesMatch
// ---------------------------------------------------------------------------

describe("namesMatch", () => {
  it("matches exact names", () => {
    expect(namesMatch("Cool Game", "Cool Game")).toBe(true);
  });

  it("matches case-insensitive", () => {
    expect(namesMatch("Cool Game", "cool game")).toBe(true);
  });

  it("matches when demo has PAX suffix", () => {
    expect(namesMatch("Cool Game", "Cool Game - PAX Demo")).toBe(true);
  });

  it("matches when demo has (Demo) suffix", () => {
    expect(namesMatch("Cool Game", "Cool Game (Demo)")).toBe(true);
  });

  it("does not match different games", () => {
    expect(namesMatch("Cool Game", "Other Game")).toBe(false);
  });

  it("does not match partial name overlaps", () => {
    expect(namesMatch("Cool Game", "Cool Game 2")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// reconcile
// ---------------------------------------------------------------------------

describe("reconcile", () => {
  it("promotes discovered game when demo match exists", () => {
    const demoGame = makeDemoGame();
    const discoveredGame = makeDiscoveredGame();

    const result = reconcile([demoGame], [discoveredGame]);

    expect(result.promotions).toHaveLength(1);
    expect(result.promotions[0].oldId).toBe("discovered:100001:cool-game");
    expect(result.promotions[0].newId).toBe("demo:58001");
    expect(result.promotions[0].gameName).toBe("Cool Game");

    // Output should contain only the demo game (promoted)
    expect(result.games).toHaveLength(1);
    expect(result.games[0].id).toBe("demo:58001");
  });

  it("promotes when demo name has PAX suffix", () => {
    const demoGame = makeDemoGame({ name: "Cool Game - PAX Demo" });
    const discoveredGame = makeDiscoveredGame();

    const result = reconcile([demoGame], [discoveredGame]);

    expect(result.promotions).toHaveLength(1);
    expect(result.promotions[0].oldId).toBe("discovered:100001:cool-game");
  });

  it("carries forward orphaned discoveries", () => {
    const demoGame = makeDemoGame({ name: "Other Game" });
    const discoveredGame = makeDiscoveredGame({
      name: "Unrelated Game",
      slug: "unrelated-game",
      id: "discovered:100001:unrelated-game",
    });

    const result = reconcile([demoGame], [discoveredGame]);

    expect(result.promotions).toHaveLength(0);
    expect(result.orphanedDiscoveries).toHaveLength(1);
    expect(result.orphanedDiscoveries[0].game.name).toBe("Unrelated Game");

    // Output has both demo game and orphan
    expect(result.games).toHaveLength(2);
    expect(result.games.map((g) => g.id)).toContain("demo:58001");
    expect(result.games.map((g) => g.id)).toContain("discovered:100001:unrelated-game");
  });

  it("counts regenerated games (exhibitor still has no demos)", () => {
    const discoveredGame = makeDiscoveredGame({ exhibitorId: "999999" });

    const result = reconcile([], [discoveredGame]);

    expect(result.stats.regenerated).toBe(1);
    expect(result.promotions).toHaveLength(0);
    expect(result.orphanedDiscoveries).toHaveLength(0);
  });

  it("handles mix of promotions, orphans, and regenerations", () => {
    // Exhibitor 100001: discovered "Cool Game" + "Bonus Game", demo for "Cool Game" exists
    const demoGame = makeDemoGame();
    const discoveredMatch = makeDiscoveredGame();
    const discoveredOrphan = makeDiscoveredGame({
      id: "discovered:100001:bonus-game",
      name: "Bonus Game",
      slug: "bonus-game",
    });

    // Exhibitor 200001: discovered "Mystery Game", no demo
    const discoveredRegenerate = makeDiscoveredGame({
      id: "discovered:200001:mystery-game",
      name: "Mystery Game",
      slug: "mystery-game",
      exhibitorId: "200001",
    });

    const result = reconcile([demoGame], [discoveredMatch, discoveredOrphan, discoveredRegenerate]);

    expect(result.stats.promoted).toBe(1);
    expect(result.stats.orphaned).toBe(1);
    expect(result.stats.regenerated).toBe(1);

    // Output: 1 demo + 1 orphan = 2 games
    expect(result.games).toHaveLength(2);
  });

  it("ignores previous demo-sourced games (only reconciles discovered)", () => {
    const freshDemo = makeDemoGame({ id: "demo:58002", name: "New Game" });
    const previousDemo = makeDemoGame({ id: "demo:58001", name: "Old Game" });

    const result = reconcile([freshDemo], [previousDemo]);

    // Previous demo-sourced games are not discovered, so nothing to reconcile
    expect(result.promotions).toHaveLength(0);
    expect(result.orphanedDiscoveries).toHaveLength(0);
    expect(result.stats.previousDiscoveredGames).toBe(0);
    expect(result.games).toHaveLength(1);
    expect(result.games[0].id).toBe("demo:58002");
  });

  it("handles empty previous games", () => {
    const demoGame = makeDemoGame();
    const result = reconcile([demoGame], []);

    expect(result.promotions).toHaveLength(0);
    expect(result.orphanedDiscoveries).toHaveLength(0);
    expect(result.games).toHaveLength(1);
  });

  it("handles empty fresh demo games", () => {
    const discoveredGame = makeDiscoveredGame();
    const result = reconcile([], [discoveredGame]);

    expect(result.stats.regenerated).toBe(1);
    expect(result.games).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// migrateEnrichCaches
// ---------------------------------------------------------------------------

describe("migrateEnrichCaches", () => {
  const tmpDir = join(import.meta.dirname, "__test_cache_tmp__");
  const bggDir = join(tmpDir, "bgg");
  const webDir = join(tmpDir, "web");
  const steamDir = join(tmpDir, "steam");

  beforeEach(async () => {
    await mkdir(bggDir, { recursive: true });
    await mkdir(webDir, { recursive: true });
    await mkdir(steamDir, { recursive: true });
  });

  afterEach(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("copies cache files from old ID to new ID", async () => {
    const oldId = "discovered:100001:cool-game";
    const newId = "demo:58001";

    // Create a cache file for the old ID
    await writeFile(join(bggDir, `${oldId}.json`), '{"bggId": 12345}', "utf-8");
    await writeFile(join(webDir, `${oldId}.json`), '{"summary": "A game"}', "utf-8");

    const promotions = [{ oldId, newId, exhibitorId: "100001", gameName: "Cool Game" }];
    const migrated = await migrateEnrichCaches(promotions, {
      bgg: bggDir,
      web: webDir,
      steam: steamDir,
    });

    expect(migrated).toBe(2); // bgg + web (steam had no file)

    const bggFiles = await readdir(bggDir);
    expect(bggFiles).toContain(`${newId}.json`);
    expect(bggFiles).toContain(`${oldId}.json`); // Original preserved

    const webFiles = await readdir(webDir);
    expect(webFiles).toContain(`${newId}.json`);
  });

  it("does not overwrite existing new ID cache files", async () => {
    const oldId = "discovered:100001:cool-game";
    const newId = "demo:58001";

    await writeFile(join(bggDir, `${oldId}.json`), '{"bggId": 12345}', "utf-8");
    await writeFile(join(bggDir, `${newId}.json`), '{"bggId": 99999}', "utf-8");

    const promotions = [{ oldId, newId, exhibitorId: "100001", gameName: "Cool Game" }];
    const migrated = await migrateEnrichCaches(promotions, { bgg: bggDir });

    expect(migrated).toBe(0);

    // Verify the existing file wasn't overwritten
    const content = await Bun.file(join(bggDir, `${newId}.json`)).json();
    expect(content.bggId).toBe(99999);
  });

  it("handles missing cache directories gracefully", async () => {
    const promotions = [
      {
        oldId: "discovered:100001:cool-game",
        newId: "demo:58001",
        exhibitorId: "100001",
        gameName: "Cool Game",
      },
    ];
    const migrated = await migrateEnrichCaches(promotions, {
      bgg: join(tmpDir, "nonexistent"),
    });

    expect(migrated).toBe(0);
  });

  it("returns 0 for empty promotions", async () => {
    const migrated = await migrateEnrichCaches([], { bgg: bggDir });
    expect(migrated).toBe(0);
  });
});
