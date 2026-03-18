import type { RawDemo, RawExhibitor } from "@pax-pal/core";
import { toSlug } from "@pax-pal/core";

// ---------------------------------------------------------------------------
// LeapEvent API response types
// ---------------------------------------------------------------------------

export interface ApiImage {
  big: string;
  med: string;
  small: string;
  thumb: string;
}

export interface ApiTag {
  id: string;
  tag: string;
}

export interface ApiCategory {
  id: string;
  name: string;
  color: string;
}

export interface ApiExhibitor {
  id: string;
  company: string;
  first_name: string;
  last_name: string;
  description: string;
  website: string;
  store_url: string;
  mobile_map_link: string | null;
  featured: boolean;
  booth: string;
  global_categories: ApiCategory[];
  tags: ApiTag[];
  image: ApiImage | [];
  show_specials: boolean;
  exclusives: boolean;
  artist: boolean;
}

export interface ApiSpecial {
  id: string;
  type: "exclusive" | "special";
  title: string;
  description: string;
  price: string | null;
  link: string;
  image: ApiImage | [];
  space_order_id: string;
  company: string;
  assignment: string;
  modified: string;
  category: ApiCategory[];
}

// ---------------------------------------------------------------------------
// Tabletop category ID (from /api/space_order_categories)
// ---------------------------------------------------------------------------

const TABLETOP_CATEGORY_ID = "19605";

// ---------------------------------------------------------------------------
// Transform functions — pure JSON in → typed objects out
// ---------------------------------------------------------------------------

/**
 * Transform API exhibitors into RawExhibitor arrays, split by tabletop membership.
 *
 * An exhibitor with the Tabletop category (id 19605) appears in BOTH the main
 * exhibitors list AND the tabletop list (matching the HTML scraper behavior where
 * the same exhibitor appears on both pages).
 */
export function transformExhibitors(apiExhibitors: ApiExhibitor[]): {
  exhibitors: RawExhibitor[];
  tabletop: RawExhibitor[];
} {
  const now = new Date().toISOString();
  const exhibitors: RawExhibitor[] = [];
  const tabletop: RawExhibitor[] = [];

  for (const api of apiExhibitors) {
    const name = api.company.trim();
    if (!name) continue;

    const isTabletop = api.global_categories.some((c) => c.id === TABLETOP_CATEGORY_ID);
    const slug = toSlug(name);

    const base: Omit<RawExhibitor, "sourcePage"> = {
      id: api.id,
      name,
      slug,
      boothLocation: api.booth || null,
      description: api.description?.trim() || null,
      imageUrl: extractImageUrl(api.image),
      website: api.website?.trim() || null,
      storeUrl: api.store_url?.trim() || null,
      showroomUrl: `https://east.paxsite.com/en-us/expo-hall/showroom.html?gtID=${api.id}&exhibitor-name=${slug}`,
      isFeatured: api.featured,
      paxTags: api.tags.map((t) => t.tag),
      lastScrapedAt: now,
    };

    // Every exhibitor goes in the main list
    exhibitors.push({ ...base, sourcePage: "exhibitors" });

    // Tabletop exhibitors also get a tabletop entry (mirrors the separate tabletop page)
    if (isTabletop) {
      tabletop.push({ ...base, sourcePage: "tabletop" });
    }
  }

  return { exhibitors, tabletop };
}

/**
 * Transform API specials into RawDemo array.
 * Only includes entries with type "exclusive" (demos), not "special" (merch/promos).
 */
export function transformDemos(apiSpecials: ApiSpecial[]): RawDemo[] {
  const now = new Date().toISOString();
  const demos: RawDemo[] = [];

  for (const api of apiSpecials) {
    if (api.type !== "exclusive") continue;

    const name = api.title?.trim();
    if (!name) continue;

    demos.push({
      id: api.id,
      name,
      exhibitorName: api.company?.trim() || "",
      exhibitorId: api.space_order_id,
      description: api.description?.trim() || null,
      imageUrl: extractImageUrl(api.image),
      lastScrapedAt: now,
    });
  }

  return demos;
}

/** Extract the small image URL from an API image field (object or empty array). */
function extractImageUrl(image: ApiImage | []): string | null {
  if (Array.isArray(image)) return null;
  return image.small || null;
}
