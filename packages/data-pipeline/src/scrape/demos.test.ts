import { describe, expect, it } from "bun:test";
import { parseDemoPage } from "./demos";

const DEMO_HTML = `
<html><body>
<div class="mix gt-entry gt-flex-col alpha-A" id="58318" data-name="Altered-Alma" data-id="58318">
  <a data-is-featured="Non Featured" data-special-type="exclusive"
    data-button-text="Altered Alma" data-exhib-full-name="Critical Reflex"
    data-exhibitor-id="648079" class="artist-modal-link" data-id="58318">
    <div class="gtSpecial-image-area">
      <div class="gtSpecial-image" style="background-image:url(https://example.com/altered-alma.png)"></div>
    </div>
    <div class="gtSpecial-bottom-area">
      <div class="bottomInfoTop">
        <div class="gt-company-container">
          <div class="gtSpecial-company-booth">Critical Reflex</div>
        </div>
      </div>
      <div class="gtSpecial-title">Altered Alma</div>
    </div>
  </a>
</div>

<div class="mix gt-entry gt-flex-col alpha-B" id="58400" data-name="Board-Quest" data-id="58400">
  <a data-is-featured="Non Featured" data-special-type="exclusive"
    data-button-text="Board Quest" data-exhib-full-name="Fun Co"
    data-exhibitor-id="649001" class="artist-modal-link" data-id="58400">
    <div class="gtSpecial-image-area">
      <div class="gtSpecial-image" style="background-image:url(https://example.com/board-quest.jpg)"></div>
    </div>
    <div class="gtSpecial-bottom-area">
      <div class="gtSpecial-title">Board Quest</div>
    </div>
  </a>
</div>
</body></html>
`;

describe("parseDemoPage", () => {
  const results = parseDemoPage(DEMO_HTML);

  it("parses all demo entries", () => {
    expect(results).toHaveLength(2);
  });

  it("extracts id", () => {
    expect(results[0].id).toBe("58318");
  });

  it("extracts game name from data-button-text", () => {
    expect(results[0].name).toBe("Altered Alma");
  });

  it("extracts exhibitor name", () => {
    expect(results[0].exhibitorName).toBe("Critical Reflex");
  });

  it("extracts exhibitor id for harmonization", () => {
    expect(results[0].exhibitorId).toBe("648079");
  });

  it("extracts image URL from background-image style", () => {
    expect(results[0].imageUrl).toBe("https://example.com/altered-alma.png");
  });

  it("sets lastScrapedAt", () => {
    expect(results[0].lastScrapedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
