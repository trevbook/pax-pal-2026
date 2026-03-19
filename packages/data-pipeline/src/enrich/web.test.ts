import { describe, expect, it } from "bun:test";
import type { DiscoveryMeta, HarmonizedGame } from "@pax-pal/core";
import { buildGamePrompt } from "./web";

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
    description: "An epic adventure game about testing code",
    imageUrl: null,
    showroomUrl: null,
    isFeatured: false,
    paxTags: ["RPG", "Indie"],
    sourcePages: ["demos"],
    demoId: "58001",
    discoverySource: null,
    lastScrapedAt: now,
    ...overrides,
  };
}

describe("buildGamePrompt", () => {
  it("includes game name and exhibitor", () => {
    const game = makeGame();
    const prompt = buildGamePrompt(game);
    expect(prompt).toContain("Test Quest");
    expect(prompt).toContain("Indie Studio");
  });

  it("includes game type", () => {
    const game = makeGame({ type: "tabletop" });
    const prompt = buildGamePrompt(game);
    expect(prompt).toContain("Type: tabletop");
  });

  it("includes description when present", () => {
    const game = makeGame({ description: "A great RPG about wizards" });
    const prompt = buildGamePrompt(game);
    expect(prompt).toContain("A great RPG about wizards");
  });

  it("omits description when null", () => {
    const game = makeGame({ description: null });
    const prompt = buildGamePrompt(game);
    expect(prompt).not.toContain("Description:");
  });

  it("includes discoveryMeta.evidenceUrls when present", () => {
    const meta: DiscoveryMeta = {
      inclusionTier: "high",
      paxConfirmation: "none",
      releaseStatus: "unreleased",
      releaseYear: 2026,
      evidenceSummary: "Found on Steam",
      evidenceUrls: ["https://store.steampowered.com/app/12345", "https://example.com/game"],
    };
    const game = makeGame({ discoveryMeta: meta });
    const prompt = buildGamePrompt(game);
    expect(prompt).toContain("Known URLs");
    expect(prompt).toContain("https://store.steampowered.com/app/12345");
    expect(prompt).toContain("https://example.com/game");
  });

  it("omits evidence URLs section when discoveryMeta is null", () => {
    const game = makeGame({ discoveryMeta: null });
    const prompt = buildGamePrompt(game);
    expect(prompt).not.toContain("Known URLs");
  });

  it("truncates long descriptions to 400 chars", () => {
    const longDesc = "A".repeat(500);
    const game = makeGame({ description: longDesc });
    const prompt = buildGamePrompt(game);
    // Should contain the truncated version, not the full 500-char string
    expect(prompt).toContain("A".repeat(400));
    expect(prompt).not.toContain("A".repeat(401));
  });
});
