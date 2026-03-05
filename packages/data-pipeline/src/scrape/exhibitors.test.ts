import { describe, expect, it } from "bun:test";
import { parseExhibitorPage } from "./exhibitors";

const EXHIBITOR_HTML = `
<html><body>
<div data-is-featured="Featured" data-exhib-full-name="Acme Games" data-id="100001"
  class="mix gt-flex-col hasHeadingArea tag-Action tag-Indie tag-PC gtFeatured exhibitor-entry cat-Exhibitor alpha-A"
  id="100001" data-name="Acme-Games">
  <div class="gt-flex-row">
    <div class="gtImageArea" data-mh="gtImageArea">
      <a data-exhib-full-name="Acme Games" data-is-featured="Featured"
        data-button-text="Exhibitor Logo - Acme Games"
        href="/en-us/expo-hall/showroom.html?gtID=100001&amp;exhibitor-name=Acme-Games"
        data-id="100001" class="gtExhibitorLink" data-name="Acme-Games">
        <img src="https://example.com/acme-logo.png" alt="Acme Games">
      </a>
    </div>
    <div class="gtExhibitorInfo">
      <div class="exhibitor-name">
        <a class="gtExhibitorLink" href="/en-us/expo-hall/showroom.html?gtID=100001">Acme Games</a>
      </div>
      <div class="exhibitor-location"><span>Booth:</span> 15043 </div>
      <div class="exhibitor-description">A great game studio making awesome things.</div>
    </div>
  </div>
</div>

<div data-is-featured="Non Featured" data-exhib-full-name="Beta Board Co" data-id="100002"
  class="mix gt-flex-col tag-Tabletop tag-Dice exhibitor-entry cat-Tabletop alpha-B"
  id="100002" data-name="Beta-Board-Co">
  <div class="gt-flex-row">
    <div class="gtImageArea" data-mh="gtImageArea">
      <a href="/en-us/expo-hall/tabletop-expo-hall/showroom.html?gtID=100002&amp;exhibitor-name=Beta-Board-Co"
        data-id="100002" class="gtExhibitorLink">
        <img src="https://example.com/beta-logo.png" alt="Beta Board Co">
      </a>
    </div>
    <div class="gtExhibitorInfo">
      <div class="exhibitor-name"><a class="gtExhibitorLink">Beta Board Co</a></div>
      <div class="exhibitor-location"><span>Booth:</span> TT29A </div>
      <div class="exhibitor-description">Board games for everyone.</div>
    </div>
  </div>
</div>
</body></html>
`;

describe("parseExhibitorPage", () => {
  const results = parseExhibitorPage(EXHIBITOR_HTML, "exhibitors");

  it("parses all exhibitor entries", () => {
    expect(results).toHaveLength(2);
  });

  it("extracts id and name", () => {
    expect(results[0].id).toBe("100001");
    expect(results[0].name).toBe("Acme Games");
  });

  it("generates slug", () => {
    expect(results[0].slug).toBe("acme-games");
  });

  it("extracts booth location", () => {
    expect(results[0].boothLocation).toBe("15043");
    expect(results[1].boothLocation).toBe("TT29A");
  });

  it("extracts description text", () => {
    expect(results[0].description).toBe("A great game studio making awesome things.");
  });

  it("extracts image URL", () => {
    expect(results[0].imageUrl).toBe("https://example.com/acme-logo.png");
  });

  it("builds showroom URL", () => {
    expect(results[0].showroomUrl).toContain("showroom.html?gtID=100001");
  });

  it("detects featured status", () => {
    expect(results[0].isFeatured).toBe(true);
    expect(results[1].isFeatured).toBe(false);
  });

  it("extracts PAX tags from CSS classes", () => {
    expect(results[0].paxTags).toContain("Action");
    expect(results[0].paxTags).toContain("Indie");
    expect(results[0].paxTags).toContain("PC");
    expect(results[1].paxTags).toContain("Tabletop");
    expect(results[1].paxTags).toContain("Dice");
  });

  it("sets source page", () => {
    expect(results[0].sourcePage).toBe("exhibitors");
  });

  it("sets lastScrapedAt as ISO string", () => {
    expect(results[0].lastScrapedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
