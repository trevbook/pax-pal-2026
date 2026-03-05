import type { RawDemo } from "@pax-pal/core";
import * as cheerio from "cheerio";

/**
 * Parse the demos page.
 *
 * Demo entries use a different structure than exhibitors:
 * - div.gt-entry with data-id, data-name
 * - Inner <a> with data-button-text (game name), data-exhib-full-name,
 *   data-exhibitor-id, and background-image for the demo image.
 */
export function parseDemoPage(html: string): RawDemo[] {
  const $ = cheerio.load(html);
  const now = new Date().toISOString();
  const results: RawDemo[] = [];

  $("div.gt-entry[data-id]").each((_i, el) => {
    const $el = $(el);
    const id = $el.attr("data-id") ?? "";
    if (!id) return;

    const link = $el.find("a.artist-modal-link").first();
    const name = (link.attr("data-button-text") ?? "").trim();
    const exhibitorName = (link.attr("data-exhib-full-name") ?? "").trim();
    const exhibitorId = link.attr("data-exhibitor-id") ?? "";

    if (!name) return;

    // Image from background-image on .gtSpecial-image
    const imgDiv = $el.find(".gtSpecial-image");
    const bgStyle = imgDiv.attr("style") ?? "";
    const bgMatch = bgStyle.match(/url\(([^)]+)\)/);
    const imageUrl = bgMatch ? bgMatch[1] : null;

    // Description — demos typically don't have inline descriptions in the list view
    // The description would be in the modal/detail view; we capture what's available
    const descEl = $el.find(".gtSpecial-description");
    const description = descEl.text().trim() || null;

    results.push({
      id,
      name,
      exhibitorName,
      exhibitorId,
      description,
      imageUrl,
      lastScrapedAt: now,
    });
  });

  return results;
}
