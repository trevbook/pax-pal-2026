import { describe, expect, it } from "bun:test";
import type { HarmonizedExhibitor } from "@pax-pal/core";
import { formatExhibitorForPrompt } from "./tier2";
import type { Tier1Signal } from "./types";

const now = new Date().toISOString();

function makeExhibitor(overrides: Partial<HarmonizedExhibitor> = {}): HarmonizedExhibitor {
  return {
    id: "100001",
    name: "Acme Games",
    slug: "acme-games",
    boothLocation: "15043",
    description: "A great studio making Terra Nova: Legend of the Runes",
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

function makeSignal(overrides: Partial<Tier1Signal> = {}): Tier1Signal {
  return {
    exhibitorId: "100001",
    likelyUmbrella: false,
    skipForTier2: false,
    skipReason: null,
    nameIsGame: false,
    boothPartners: [],
    ...overrides,
  };
}

describe("formatExhibitorForPrompt", () => {
  it("includes exhibitor name and id", () => {
    const result = formatExhibitorForPrompt(makeExhibitor(), makeSignal());
    expect(result).toContain("Name: Acme Games");
    expect(result).toContain("ID: 100001");
  });

  it("includes description", () => {
    const result = formatExhibitorForPrompt(makeExhibitor(), makeSignal());
    expect(result).toContain("Terra Nova");
  });

  it("truncates long descriptions", () => {
    const longDesc = "A".repeat(600);
    const ex = makeExhibitor({ description: longDesc });
    const result = formatExhibitorForPrompt(ex, makeSignal());
    expect(result).toContain("...");
    expect(result.length).toBeLessThan(700);
  });

  it("shows (no description) for null description", () => {
    const ex = makeExhibitor({ description: null });
    const result = formatExhibitorForPrompt(ex, makeSignal());
    expect(result).toContain("(no description)");
  });

  it("includes tier1 signals", () => {
    const signal = makeSignal({ likelyUmbrella: true, nameIsGame: true });
    const result = formatExhibitorForPrompt(makeExhibitor(), signal);
    expect(result).toContain("nameIsGame: true");
    expect(result).toContain("likelyUmbrella: true");
  });

  it("includes website", () => {
    const result = formatExhibitorForPrompt(makeExhibitor(), makeSignal());
    expect(result).toContain("Website: https://acme.com");
  });

  it("shows (none) for null website", () => {
    const ex = makeExhibitor({ website: null });
    const result = formatExhibitorForPrompt(ex, makeSignal());
    expect(result).toContain("Website: (none)");
  });

  it("includes paxTags", () => {
    const result = formatExhibitorForPrompt(makeExhibitor(), makeSignal());
    expect(result).toContain("paxTags: Action, PC");
  });

  it("includes isTabletop flag", () => {
    const ex = makeExhibitor({ isTabletop: true });
    const result = formatExhibitorForPrompt(ex, makeSignal());
    expect(result).toContain("isTabletop: true");
  });
});
