import type { RawExhibitor } from "@pax-pal/core";
import { toSlug } from "@pax-pal/core";
import * as cheerio from "cheerio";

/**
 * Parse an exhibitor page (main expo hall or tabletop expo hall).
 * Both pages share the same HTML structure — exhibitor-entry divs with
 * data-id, data-exhib-full-name, tags as CSS classes, etc.
 */
export function parseExhibitorPage(
  html: string,
  source: "exhibitors" | "tabletop",
): RawExhibitor[] {
  const $ = cheerio.load(html);
  const now = new Date().toISOString();
  const results: RawExhibitor[] = [];

  $("div.exhibitor-entry[data-id]").each((_i, el) => {
    const $el = $(el);
    const id = $el.attr("data-id") ?? "";
    const name = ($el.attr("data-exhib-full-name") ?? "").trim();
    if (!id || !name) return;

    const isFeatured = $el.attr("data-is-featured") === "Featured";

    // Extract tags from CSS classes (tag-Action, tag-RPG, cat-Tabletop, etc.)
    const classes = ($el.attr("class") ?? "").split(/\s+/);
    const paxTags = classes
      .filter((c) => c.startsWith("tag-") || c.startsWith("cat-"))
      .map((c) => c.replace(/^(tag-|cat-)/, ""));

    // Booth location
    const boothText = $el.find(".exhibitor-location").text().trim();
    const boothLocation = boothText.replace(/^Booth:\s*/i, "").trim() || null;

    // Description (may be truncated with "..." link)
    const descEl = $el.find(".exhibitor-description");
    const description = descEl.text().replace(/\s+/g, " ").trim() || null;

    // Image — from the <img> inside .gtImageArea
    const imgEl = $el.find(".gtImageArea img");
    const imageUrl = imgEl.attr("src") || null;

    // Showroom URL — from first .gtExhibitorLink
    const linkEl = $el.find("a.gtExhibitorLink").first();
    const rawHref = linkEl.attr("href") || null;
    const showroomUrl = rawHref ? `https://east.paxsite.com${rawHref}` : null;

    results.push({
      id,
      name,
      slug: toSlug(name),
      boothLocation,
      description,
      imageUrl,
      showroomUrl,
      isFeatured,
      paxTags,
      sourcePage: source,
      lastScrapedAt: now,
    });
  });

  return results;
}
