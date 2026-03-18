import { describe, expect, it } from "bun:test";
import type { ApiExhibitor, ApiImage, ApiSpecial } from "./api";
import { transformDemos, transformExhibitors } from "./api";

function makeImage(id = "abc123"): ApiImage {
  return {
    big: `https://conv-prod-app.s3.amazonaws.com/media/big/${id}.png`,
    med: `https://conv-prod-app.s3.amazonaws.com/media/med/${id}.png`,
    small: `https://conv-prod-app.s3.amazonaws.com/media/small/${id}.png`,
    thumb: `https://conv-prod-app.s3.amazonaws.com/media/thumb/${id}.png`,
  };
}

function makeApiExhibitor(overrides: Partial<ApiExhibitor> = {}): ApiExhibitor {
  return {
    id: "649900",
    company: "Acme Games",
    first_name: "John",
    last_name: "Doe",
    description: "A great studio",
    website: "acme.com",
    store_url: "",
    mobile_map_link: null,
    featured: false,
    booth: "15043",
    global_categories: [{ id: "19590", name: "Exhibitor", color: "" }],
    tags: [
      { id: "5003", tag: "Action" },
      { id: "5026", tag: "PC" },
    ],
    image: makeImage(),
    show_specials: false,
    exclusives: false,
    artist: false,
    ...overrides,
  };
}

function makeApiSpecial(overrides: Partial<ApiSpecial> = {}): ApiSpecial {
  return {
    id: "56595",
    type: "exclusive",
    title: "Acme Blast",
    description: "An awesome game",
    price: null,
    link: "",
    image: makeImage("demo123"),
    space_order_id: "649900",
    company: "Acme Games",
    assignment: "15043",
    modified: "2026-01-06 18:17:47",
    category: [],
    ...overrides,
  };
}

describe("transformExhibitors", () => {
  it("maps API fields to RawExhibitor", () => {
    const { exhibitors } = transformExhibitors([makeApiExhibitor()]);
    expect(exhibitors).toHaveLength(1);

    const ex = exhibitors[0];
    expect(ex.id).toBe("649900");
    expect(ex.name).toBe("Acme Games");
    expect(ex.boothLocation).toBe("15043");
    expect(ex.description).toBe("A great studio");
    expect(ex.isFeatured).toBe(false);
    expect(ex.website).toBe("acme.com");
    expect(ex.storeUrl).toBeNull();
    expect(ex.paxTags).toEqual(["Action", "PC"]);
    expect(ex.sourcePage).toBe("exhibitors");
    expect(ex.slug).toBe("acme-games");
    expect(ex.showroomUrl).toContain("gtID=649900");
  });

  it("uses small image URL", () => {
    const { exhibitors } = transformExhibitors([makeApiExhibitor()]);
    expect(exhibitors[0].imageUrl).toContain("/media/small/");
  });

  it("handles empty image array as null", () => {
    const { exhibitors } = transformExhibitors([makeApiExhibitor({ image: [] })]);
    expect(exhibitors[0].imageUrl).toBeNull();
  });

  it("trims trailing spaces from company names", () => {
    const { exhibitors } = transformExhibitors([makeApiExhibitor({ company: "AERTHLINGS " })]);
    expect(exhibitors[0].name).toBe("AERTHLINGS");
  });

  it("skips entries with empty company name", () => {
    const { exhibitors } = transformExhibitors([makeApiExhibitor({ company: "  " })]);
    expect(exhibitors).toHaveLength(0);
  });

  it("detects tabletop exhibitors via category id 19605", () => {
    const tabletopExhibitor = makeApiExhibitor({
      global_categories: [
        { id: "19590", name: "Exhibitor", color: "" },
        { id: "19605", name: "Tabletop", color: "" },
      ],
    });
    const { exhibitors, tabletop } = transformExhibitors([tabletopExhibitor]);

    // Tabletop exhibitors appear in BOTH lists
    expect(exhibitors).toHaveLength(1);
    expect(exhibitors[0].sourcePage).toBe("exhibitors");
    expect(tabletop).toHaveLength(1);
    expect(tabletop[0].sourcePage).toBe("tabletop");
  });

  it("non-tabletop exhibitors only appear in exhibitors list", () => {
    const { exhibitors, tabletop } = transformExhibitors([makeApiExhibitor()]);
    expect(exhibitors).toHaveLength(1);
    expect(tabletop).toHaveLength(0);
  });

  it("handles empty booth as null", () => {
    const { exhibitors } = transformExhibitors([makeApiExhibitor({ booth: "" })]);
    expect(exhibitors[0].boothLocation).toBeNull();
  });

  it("maps website and store_url", () => {
    const { exhibitors } = transformExhibitors([
      makeApiExhibitor({ website: "  https://acme.com  ", store_url: "https://store.acme.com" }),
    ]);
    expect(exhibitors[0].website).toBe("https://acme.com");
    expect(exhibitors[0].storeUrl).toBe("https://store.acme.com");
  });

  it("handles empty website and store_url as null", () => {
    const { exhibitors } = transformExhibitors([makeApiExhibitor({ website: "", store_url: "" })]);
    expect(exhibitors[0].website).toBeNull();
    expect(exhibitors[0].storeUrl).toBeNull();
  });
});

describe("transformDemos", () => {
  it("maps API fields to RawDemo", () => {
    const demos = transformDemos([makeApiSpecial()]);
    expect(demos).toHaveLength(1);

    const demo = demos[0];
    expect(demo.id).toBe("56595");
    expect(demo.name).toBe("Acme Blast");
    expect(demo.exhibitorName).toBe("Acme Games");
    expect(demo.exhibitorId).toBe("649900");
    expect(demo.description).toBe("An awesome game");
    expect(demo.imageUrl).toContain("/media/small/");
  });

  it("only includes type 'exclusive' (demos), not 'special'", () => {
    const specials = [
      makeApiSpecial({ id: "1", type: "exclusive", title: "Demo Game" }),
      makeApiSpecial({ id: "2", type: "special", title: "Merch Item" }),
    ];
    const demos = transformDemos(specials);
    expect(demos).toHaveLength(1);
    expect(demos[0].name).toBe("Demo Game");
  });

  it("handles empty image array as null", () => {
    const demos = transformDemos([makeApiSpecial({ image: [] })]);
    expect(demos[0].imageUrl).toBeNull();
  });

  it("trims title whitespace", () => {
    const demos = transformDemos([makeApiSpecial({ title: "  Cool Game  " })]);
    expect(demos[0].name).toBe("Cool Game");
  });

  it("skips entries with empty title", () => {
    const demos = transformDemos([makeApiSpecial({ title: "" })]);
    expect(demos).toHaveLength(0);
  });

  it("maps space_order_id to exhibitorId", () => {
    const demos = transformDemos([makeApiSpecial({ space_order_id: "123456" })]);
    expect(demos[0].exhibitorId).toBe("123456");
  });
});
