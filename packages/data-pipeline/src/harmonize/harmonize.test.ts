import { describe, expect, it } from "bun:test";
import type { RawDemo, RawExhibitor } from "@pax-pal/core";
import { harmonize } from "./harmonize";

const now = new Date().toISOString();

function makeExhibitor(overrides: Partial<RawExhibitor> = {}): RawExhibitor {
  return {
    id: "100001",
    name: "Acme Games",
    slug: "acme-games",
    boothLocation: "15043",
    description: "A great studio",
    imageUrl: "https://example.com/acme.png",
    showroomUrl: "https://east.paxsite.com/showroom?gtID=100001",
    isFeatured: false,
    paxTags: ["Action", "PC"],
    sourcePage: "exhibitors",
    lastScrapedAt: now,
    ...overrides,
  };
}

function makeDemo(overrides: Partial<RawDemo> = {}): RawDemo {
  return {
    id: "58001",
    name: "Acme Blast",
    exhibitorName: "Acme Games",
    exhibitorId: "100001",
    description: null,
    imageUrl: "https://example.com/blast.png",
    lastScrapedAt: now,
    ...overrides,
  };
}

describe("harmonize", () => {
  it("creates games from exhibitors", () => {
    const { games } = harmonize([makeExhibitor()], [], []);
    expect(games).toHaveLength(1);
    expect(games[0].id).toBe("100001");
    expect(games[0].name).toBe("Acme Games");
    expect(games[0].type).toBe("video_game");
  });

  it("matches demos to exhibitors via exhibitorId", () => {
    const { games, unmatched } = harmonize([makeExhibitor()], [], [makeDemo()]);
    expect(unmatched).toHaveLength(0);
    expect(games[0].demoId).toBe("58001");
    expect(games[0].sourcePages).toContain("demos");
  });

  it("reports unmatched demos", () => {
    const demo = makeDemo({ exhibitorId: "999999" });
    const { unmatched } = harmonize([makeExhibitor()], [], [demo]);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].id).toBe("58001");
  });

  it("merges tabletop entries and sets type", () => {
    const exhibitor = makeExhibitor({ id: "200001", paxTags: ["Action"] });
    const tabletop = makeExhibitor({
      id: "200001",
      paxTags: ["Tabletop", "Dice"],
      sourcePage: "tabletop",
    });
    const { games } = harmonize([exhibitor], [tabletop], []);
    expect(games).toHaveLength(1);
    expect(games[0].type).toBe("tabletop");
    expect(games[0].paxTags).toContain("Tabletop");
    expect(games[0].paxTags).toContain("Dice");
    expect(games[0].paxTags).toContain("Action");
  });

  it("sets type to 'both' when tabletop + demo", () => {
    const exhibitor = makeExhibitor({ id: "300001" });
    const tabletop = makeExhibitor({
      id: "300001",
      paxTags: ["Tabletop"],
      sourcePage: "tabletop",
    });
    const demo = makeDemo({ exhibitorId: "300001" });
    const { games } = harmonize([exhibitor], [tabletop], [demo]);
    expect(games).toHaveLength(1);
    expect(games[0].type).toBe("both");
  });

  it("adds tabletop-only entries not in main exhibitors", () => {
    const tabletop = makeExhibitor({
      id: "400001",
      name: "Board Only Co",
      paxTags: ["Tabletop"],
      sourcePage: "tabletop",
    });
    const { games } = harmonize([], [tabletop], []);
    expect(games).toHaveLength(1);
    expect(games[0].type).toBe("tabletop");
  });

  it("uses demo image when exhibitor lacks one", () => {
    const exhibitor = makeExhibitor({ imageUrl: null });
    const demo = makeDemo({ imageUrl: "https://example.com/demo-img.png" });
    const { games } = harmonize([exhibitor], [], [demo]);
    expect(games[0].imageUrl).toBe("https://example.com/demo-img.png");
  });
});
