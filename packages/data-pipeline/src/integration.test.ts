import { describe, expect, it } from "bun:test";
import { harmonize } from "./harmonize/harmonize";
import { parseDemoPage } from "./scrape/demos";
import { parseExhibitorPage } from "./scrape/exhibitors";
import { fetchHtml } from "./scrape/fetch-html";

/**
 * Integration tests that run against the real sample HTML files.
 * These catch edge cases in the actual PAX data that synthetic HTML can't cover:
 * special characters in names, missing fields, unusual booth formats, etc.
 */
describe("integration: scrape + harmonize against sample HTML", () => {
  // Scrape all three pages upfront (shared across tests)
  const exhibitorsHtml = fetchHtml("exhibitors", "local");
  const demosHtml = fetchHtml("demos", "local");
  const tabletopHtml = fetchHtml("tabletop", "local");

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
    it("merges all sources into 346 games with 0 unmatched demos", async () => {
      const [exHtml, demoHtml, ttHtml] = await Promise.all([
        exhibitorsHtml,
        demosHtml,
        tabletopHtml,
      ]);
      const exhibitors = parseExhibitorPage(exHtml, "exhibitors");
      const demos = parseDemoPage(demoHtml);
      const tabletop = parseExhibitorPage(ttHtml, "tabletop");

      const { games, unmatched } = harmonize(exhibitors, tabletop, demos);

      expect(games).toHaveLength(346);
      expect(unmatched).toHaveLength(0);
    });

    it("produces all three game types", async () => {
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
      expect(types.has("tabletop")).toBe(true);
      expect(types.has("both")).toBe(true);
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
