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
    website: "https://acme.com",
    storeUrl: null,
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
  describe("exhibitor output", () => {
    it("always emits every exhibitor regardless of demo status", () => {
      const exhibitor = makeExhibitor();
      const demo = makeDemo();
      const { exhibitors } = harmonize([exhibitor], [], [demo]);

      expect(exhibitors).toHaveLength(1);
      expect(exhibitors[0].id).toBe("100001");
      expect(exhibitors[0].name).toBe("Acme Games");
      expect(exhibitors[0].website).toBe("https://acme.com");
    });

    it("sets demoCount based on linked demos", () => {
      const demo1 = makeDemo({ id: "58001", name: "Blast" });
      const demo2 = makeDemo({ id: "58002", name: "Rush" });
      const { exhibitors } = harmonize([makeExhibitor()], [], [demo1, demo2]);

      expect(exhibitors[0].demoCount).toBe(2);
    });

    it("sets demoCount to 0 when no demos exist", () => {
      const { exhibitors } = harmonize([makeExhibitor()], [], []);
      expect(exhibitors[0].demoCount).toBe(0);
    });

    it("merges tabletop entries and sets isTabletop", () => {
      const exhibitor = makeExhibitor({ id: "200001", paxTags: ["Action"] });
      const tabletop = makeExhibitor({
        id: "200001",
        paxTags: ["Tabletop", "Dice"],
        sourcePage: "tabletop",
      });
      const { exhibitors } = harmonize([exhibitor], [tabletop], []);

      expect(exhibitors).toHaveLength(1);
      expect(exhibitors[0].isTabletop).toBe(true);
      expect(exhibitors[0].paxTags).toContain("Tabletop");
      expect(exhibitors[0].paxTags).toContain("Dice");
      expect(exhibitors[0].paxTags).toContain("Action");
      expect(exhibitors[0].sourcePages).toContain("exhibitors");
      expect(exhibitors[0].sourcePages).toContain("tabletop");
    });

    it("adds tabletop-only entries not in main exhibitors", () => {
      const tabletop = makeExhibitor({
        id: "400001",
        name: "Board Only Co",
        paxTags: ["Tabletop"],
        sourcePage: "tabletop",
      });
      const { exhibitors } = harmonize([], [tabletop], []);

      expect(exhibitors).toHaveLength(1);
      expect(exhibitors[0].isTabletop).toBe(true);
    });

    it("preserves website and storeUrl", () => {
      const { exhibitors } = harmonize(
        [makeExhibitor({ website: "https://test.com", storeUrl: "https://store.test.com" })],
        [],
        [],
      );
      expect(exhibitors[0].website).toBe("https://test.com");
      expect(exhibitors[0].storeUrl).toBe("https://store.test.com");
    });
  });

  describe("game output", () => {
    it("does NOT create a game for exhibitors without demos", () => {
      const { games } = harmonize([makeExhibitor()], [], []);
      expect(games).toHaveLength(0);
    });

    it("creates one game per demo", () => {
      const demo1 = makeDemo({ id: "58001", name: "Acme Blast" });
      const demo2 = makeDemo({ id: "58002", name: "Acme Rush" });
      const demo3 = makeDemo({ id: "58003", name: "Acme Quest" });
      const { games } = harmonize([makeExhibitor()], [], [demo1, demo2, demo3]);

      expect(games).toHaveLength(3);
      const names = games.map((g) => g.name).sort();
      expect(names).toEqual(["Acme Blast", "Acme Quest", "Acme Rush"]);

      for (const game of games) {
        expect(game.exhibitor).toBe("Acme Games");
        expect(game.exhibitorId).toBe("100001");
        expect(game.boothLocation).toBe("15043");
        expect(game.id).toStartWith("demo:");
      }
    });

    it("sets type to 'both' when tabletop exhibitor has a demo", () => {
      const exhibitor = makeExhibitor({ id: "300001" });
      const tabletop = makeExhibitor({
        id: "300001",
        paxTags: ["Tabletop"],
        sourcePage: "tabletop",
      });
      const demo = makeDemo({ exhibitorId: "300001", name: "Board Blast" });
      const { games } = harmonize([exhibitor], [tabletop], [demo]);

      expect(games).toHaveLength(1);
      expect(games[0].type).toBe("both");
      expect(games[0].name).toBe("Board Blast");
    });

    it("falls back to exhibitor image when demo image is missing", () => {
      const demo = makeDemo({ imageUrl: null });
      const { games } = harmonize([makeExhibitor()], [], [demo]);
      expect(games[0].imageUrl).toBe("https://example.com/acme.png");
    });

    it("falls back to exhibitor description when demo description is missing", () => {
      const demo = makeDemo({ description: null });
      const { games } = harmonize([makeExhibitor()], [], [demo]);
      expect(games[0].description).toBe("A great studio");
    });

    it('sanitizes imageUrl "undefined" string to null and falls back to exhibitor', () => {
      const demo = makeDemo({ imageUrl: "undefined" });
      const { games } = harmonize([makeExhibitor()], [], [demo]);
      expect(games[0].imageUrl).toBe("https://example.com/acme.png");
    });

    it("all demo-sourced games have exhibitorId populated", () => {
      const exhibitor = makeExhibitor();
      const tabletopOnly = makeExhibitor({
        id: "400001",
        name: "Board Co",
        sourcePage: "tabletop",
      });
      const demo = makeDemo();
      const { games } = harmonize([exhibitor], [tabletopOnly], [demo]);
      for (const game of games) {
        expect(game.exhibitorId).toBeTruthy();
      }
    });
  });

  describe("unmatched demos", () => {
    it("reports demos with no matching exhibitor", () => {
      const demo = makeDemo({ exhibitorId: "999999" });
      const { unmatched } = harmonize([makeExhibitor()], [], [demo]);
      expect(unmatched).toHaveLength(1);
      expect(unmatched[0].id).toBe("58001");
    });
  });
});
