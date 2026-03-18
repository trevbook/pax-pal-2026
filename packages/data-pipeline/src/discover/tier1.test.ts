import { describe, expect, it } from "bun:test";
import type { HarmonizedExhibitor } from "@pax-pal/core";
import {
  buildBoothIndex,
  detectGameLikeNames,
  detectSkips,
  detectUmbrellas,
  runTier1,
} from "./tier1";

const now = new Date().toISOString();

function makeExhibitor(overrides: Partial<HarmonizedExhibitor> = {}): HarmonizedExhibitor {
  return {
    id: "100001",
    name: "Acme Games",
    slug: "acme-games",
    boothLocation: "15043",
    description: "A great studio",
    imageUrl: "https://example.com/acme.png",
    website: "https://acme.com",
    storeUrl: null,
    showroomUrl: "https://east.paxsite.com/showroom?gtID=100001",
    isFeatured: false,
    isTabletop: false,
    paxTags: ["Action", "PC"],
    sourcePages: ["exhibitors"],
    demoCount: 0,
    exhibitorKind: null,
    discoveredGameCount: 0,
    lastScrapedAt: now,
    ...overrides,
  };
}

describe("buildBoothIndex", () => {
  it("groups exhibitors by boothLocation", () => {
    const a = makeExhibitor({ id: "1", boothLocation: "100" });
    const b = makeExhibitor({ id: "2", boothLocation: "100" });
    const c = makeExhibitor({ id: "3", boothLocation: "200" });
    const index = buildBoothIndex([a, b, c]);

    expect(index.get("100")).toHaveLength(2);
    expect(index.get("200")).toHaveLength(1);
  });

  it("ignores exhibitors with null boothLocation", () => {
    const a = makeExhibitor({ id: "1", boothLocation: null });
    const index = buildBoothIndex([a]);
    expect(index.size).toBe(0);
  });
});

describe("detectUmbrellas", () => {
  it("flags exhibitors sharing a booth with demo-having exhibitors", () => {
    const umbrella = makeExhibitor({ id: "1", boothLocation: "100", demoCount: 0 });
    const demoHaver = makeExhibitor({ id: "2", boothLocation: "100", demoCount: 3 });
    const boothIndex = buildBoothIndex([umbrella, demoHaver]);
    const result = detectUmbrellas([umbrella], boothIndex);

    expect(result.has("1")).toBe(true);
  });

  it("does NOT flag when all boothmates also have zero demos", () => {
    const a = makeExhibitor({ id: "1", boothLocation: "100", demoCount: 0 });
    const b = makeExhibitor({ id: "2", boothLocation: "100", demoCount: 0 });
    const boothIndex = buildBoothIndex([a, b]);
    const result = detectUmbrellas([a, b], boothIndex);

    expect(result.size).toBe(0);
  });

  it("does NOT flag exhibitors with no booth", () => {
    const a = makeExhibitor({ id: "1", boothLocation: null, demoCount: 0 });
    const boothIndex = buildBoothIndex([a]);
    const result = detectUmbrellas([a], boothIndex);

    expect(result.size).toBe(0);
  });
});

describe("detectSkips", () => {
  it("flags exhibitors with no description and no website", () => {
    const ex = makeExhibitor({ id: "1", description: null, website: null });
    const result = detectSkips([ex]);
    expect(result.has("1")).toBe(true);
  });

  it("does NOT flag when description is present", () => {
    const ex = makeExhibitor({ id: "1", description: "Has a description", website: null });
    const result = detectSkips([ex]);
    expect(result.has("1")).toBe(false);
  });

  it("does NOT flag when website is present", () => {
    const ex = makeExhibitor({ id: "1", description: null, website: "https://example.com" });
    const result = detectSkips([ex]);
    expect(result.has("1")).toBe(false);
  });
});

describe("detectGameLikeNames", () => {
  it("flags names without corporate suffixes", () => {
    const ex = makeExhibitor({ id: "1", name: "AERTHLINGS" });
    const result = detectGameLikeNames([ex]);
    expect(result.has("1")).toBe(true);
  });

  it("does NOT flag names with corporate suffixes", () => {
    const cases = [
      "Atari Interactive, Inc.",
      "Acme Games LLC",
      "Nordic Studios",
      "Big Entertainment Group",
    ];
    for (const name of cases) {
      const ex = makeExhibitor({ id: "1", name });
      const result = detectGameLikeNames([ex]);
      expect(result.has("1")).toBe(false);
    }
  });

  it("does NOT flag very long names", () => {
    const ex = makeExhibitor({ id: "1", name: "A".repeat(51) });
    const result = detectGameLikeNames([ex]);
    expect(result.has("1")).toBe(false);
  });

  it("does NOT flag names with commas", () => {
    const ex = makeExhibitor({ id: "1", name: "Atari Interactive, Inc." });
    const result = detectGameLikeNames([ex]);
    expect(result.has("1")).toBe(false);
  });
});

describe("runTier1", () => {
  it("only processes exhibitors with demoCount === 0", () => {
    const withDemo = makeExhibitor({ id: "1", demoCount: 2 });
    const withoutDemo = makeExhibitor({ id: "2", demoCount: 0 });
    const result = runTier1([withDemo, withoutDemo]);

    expect(result.signals.size).toBe(1);
    expect(result.signals.has("2")).toBe(true);
  });

  it("splits into forTier2 and skipped correctly", () => {
    const hasData = makeExhibitor({ id: "1", demoCount: 0, description: "A game studio" });
    const noData = makeExhibitor({
      id: "2",
      demoCount: 0,
      description: null,
      website: null,
    });
    const result = runTier1([hasData, noData]);

    expect(result.forTier2).toEqual(["1"]);
    expect(result.skipped).toEqual(["2"]);
  });

  it("populates boothPartners", () => {
    const a = makeExhibitor({ id: "1", boothLocation: "100", demoCount: 0 });
    const b = makeExhibitor({ id: "2", boothLocation: "100", demoCount: 0 });
    const result = runTier1([a, b]);

    expect(result.signals.get("1")?.boothPartners).toEqual(["2"]);
    expect(result.signals.get("2")?.boothPartners).toEqual(["1"]);
  });

  it("sets likelyUmbrella when booth has demo-having partners", () => {
    const umbrella = makeExhibitor({ id: "1", boothLocation: "100", demoCount: 0 });
    const demoHaver = makeExhibitor({ id: "2", boothLocation: "100", demoCount: 5 });
    const result = runTier1([umbrella, demoHaver]);

    expect(result.signals.get("1")?.likelyUmbrella).toBe(true);
  });
});
