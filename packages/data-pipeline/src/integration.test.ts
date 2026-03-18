import { describe, expect, it } from "bun:test";
import { harmonize } from "./harmonize/harmonize";
import { parseDemoPage } from "./scrape/demos";
import { parseExhibitorPage } from "./scrape/exhibitors";
import { fetchLocalHtml } from "./scrape/fetch";

/**
 * Integration tests that run against the real sample HTML files.
 * These catch edge cases in the actual PAX data that synthetic HTML can't cover:
 * special characters in names, missing fields, unusual booth formats, etc.
 */
describe("integration: scrape + harmonize against sample HTML", () => {
  // Scrape all three pages upfront (shared across tests)
  const exhibitorsHtml = fetchLocalHtml("exhibitors");
  const demosHtml = fetchLocalHtml("demos");
  const tabletopHtml = fetchLocalHtml("tabletop");

  describe("scrape: exhibitors", () => {
    it("parses all 345 exhibitor entries", async () => {
      const result = parseExhibitorPage(await exhibitorsHtml, "exhibitors");
      expect(result).toHaveLength(345);
    });

    it("every entry has a non-empty id and name", async () => {
      const result = parseExhibitorPage(await exhibitorsHtml, "exhibitors");
      for (const ex of result) {
        expect(ex.id).toBeTruthy();
        expect(ex.name).toBeTruthy();
      }
    });

    it("all ids are unique", async () => {
      const result = parseExhibitorPage(await exhibitorsHtml, "exhibitors");
      const ids = result.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("featured exhibitors are detected", async () => {
      const result = parseExhibitorPage(await exhibitorsHtml, "exhibitors");
      const featured = result.filter((e) => e.isFeatured);
      expect(featured.length).toBeGreaterThan(0);
    });

    it("booth locations include various formats (numeric, alpha, descriptive)", async () => {
      const result = parseExhibitorPage(await exhibitorsHtml, "exhibitors");
      const booths = result.map((e) => e.boothLocation).filter(Boolean) as string[];
      const hasNumeric = booths.some((b) => /^\d+$/.test(b));
      const hasAlpha = booths.some((b) => /[A-Za-z]/.test(b));
      expect(hasNumeric).toBe(true);
      expect(hasAlpha).toBe(true);
    });
  });

  describe("scrape: demos", () => {
    it("parses all 109 demo entries", async () => {
      const result = parseDemoPage(await demosHtml);
      expect(result).toHaveLength(109);
    });

    it("every demo has an exhibitorId for harmonization", async () => {
      const result = parseDemoPage(await demosHtml);
      for (const demo of result) {
        expect(demo.exhibitorId).toBeTruthy();
      }
    });

    it("all demo ids are unique", async () => {
      const result = parseDemoPage(await demosHtml);
      const ids = result.map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("scrape: tabletop", () => {
    it("parses all 42 tabletop entries", async () => {
      const result = parseExhibitorPage(await tabletopHtml, "tabletop");
      expect(result).toHaveLength(42);
    });

    it("sets sourcePage to tabletop", async () => {
      const result = parseExhibitorPage(await tabletopHtml, "tabletop");
      for (const entry of result) {
        expect(entry.sourcePage).toBe("tabletop");
      }
    });
  });

  describe("harmonize", () => {
    it("emits all exhibitors and only demo-sourced games", async () => {
      const [exHtml, demoHtml, ttHtml] = await Promise.all([
        exhibitorsHtml,
        demosHtml,
        tabletopHtml,
      ]);
      const exhibitors = parseExhibitorPage(exHtml, "exhibitors");
      const demos = parseDemoPage(demoHtml);
      const tabletop = parseExhibitorPage(ttHtml, "tabletop");

      const result = harmonize(exhibitors, tabletop, demos);

      // All exhibitors are preserved (345 from main + tabletop-only entries)
      expect(result.exhibitors.length).toBeGreaterThanOrEqual(345);
      // Only demo-sourced entries become games
      expect(result.games).toHaveLength(109);
      expect(result.unmatched).toHaveLength(0);
    });

    it("demo-sourced games have demo: id prefix and game-specific names", async () => {
      const [exHtml, demoHtml, ttHtml] = await Promise.all([
        exhibitorsHtml,
        demosHtml,
        tabletopHtml,
      ]);
      const { games } = harmonize(
        parseExhibitorPage(exHtml, "exhibitors"),
        parseExhibitorPage(ttHtml, "tabletop"),
        parseDemoPage(demoHtml),
      );

      for (const game of games) {
        expect(game.id).toStartWith("demo:");
        expect(game.demoId).toBeTruthy();
        expect(game.sourcePages).toContain("demos");
      }
    });

    it("every game has exhibitorId populated", async () => {
      const [exHtml, demoHtml, ttHtml] = await Promise.all([
        exhibitorsHtml,
        demosHtml,
        tabletopHtml,
      ]);
      const { games } = harmonize(
        parseExhibitorPage(exHtml, "exhibitors"),
        parseExhibitorPage(ttHtml, "tabletop"),
        parseDemoPage(demoHtml),
      );

      for (const game of games) {
        expect(game.exhibitorId).toBeTruthy();
      }
    });

    it("demo-sourced games are video_game or both (never pure tabletop)", async () => {
      const [exHtml, demoHtml, ttHtml] = await Promise.all([
        exhibitorsHtml,
        demosHtml,
        tabletopHtml,
      ]);
      const { games } = harmonize(
        parseExhibitorPage(exHtml, "exhibitors"),
        parseExhibitorPage(ttHtml, "tabletop"),
        parseDemoPage(demoHtml),
      );

      const types = new Set(games.map((g) => g.type));
      expect(types.has("video_game")).toBe(true);
      expect(types.has("both")).toBe(true);
      // Pure "tabletop" type requires the discover stage (no demo signal)
      expect(types.has("tabletop")).toBe(false);
    });

    it("exhibitors track demo counts", async () => {
      const [exHtml, demoHtml, ttHtml] = await Promise.all([
        exhibitorsHtml,
        demosHtml,
        tabletopHtml,
      ]);
      const { exhibitors } = harmonize(
        parseExhibitorPage(exHtml, "exhibitors"),
        parseExhibitorPage(ttHtml, "tabletop"),
        parseDemoPage(demoHtml),
      );

      const withDemos = exhibitors.filter((e) => e.demoCount > 0);
      const withoutDemos = exhibitors.filter((e) => e.demoCount === 0);
      expect(withDemos.length).toBeGreaterThan(0);
      expect(withoutDemos.length).toBeGreaterThan(0);
      // Total demos across all exhibitors should equal 109
      const totalDemos = exhibitors.reduce((sum, e) => sum + e.demoCount, 0);
      expect(totalDemos).toBe(109);
    });

    it("every game has a valid slug", async () => {
      const [exHtml, demoHtml, ttHtml] = await Promise.all([
        exhibitorsHtml,
        demosHtml,
        tabletopHtml,
      ]);
      const { games } = harmonize(
        parseExhibitorPage(exHtml, "exhibitors"),
        parseExhibitorPage(ttHtml, "tabletop"),
        parseDemoPage(demoHtml),
      );

      for (const game of games) {
        expect(game.slug).toBeTruthy();
        expect(game.slug).not.toMatch(/[A-Z]/); // slugs should be lowercase
        expect(game.slug).not.toMatch(/\s/); // no whitespace
      }
    });
  });
});
