import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ApiExhibitor, ApiSpecial } from "./api";

// ---------------------------------------------------------------------------
// Local HTML fetching (for --source local)
// ---------------------------------------------------------------------------

const HTML_DIR = join(import.meta.dirname, "../../../../miscellaneous/html");

const LOCAL_FILES = {
  exhibitors: "sample-expo-hall-exhibitors.html",
  demos: "sample-demos.html",
  tabletop: "sample-tabletop-exhibitors.html",
} as const;

export type PageName = keyof typeof LOCAL_FILES;

export async function fetchLocalHtml(page: PageName): Promise<string> {
  const filePath = join(HTML_DIR, LOCAL_FILES[page]);
  return readFile(filePath, "utf-8");
}

// ---------------------------------------------------------------------------
// LeapEvent API fetching (for --source live)
// ---------------------------------------------------------------------------

/**
 * Public API key for PAX East 2026 on the LeapEvent/GrowTix platform.
 * Embedded in the page HTML at east.paxsite.com — not a secret.
 */
const API_KEY = "bf9cc1a9-09d0-4bf7-9c13-96d85fe03f61";
const API_BASE = "https://conventions.leapevent.tech/api";

export interface ApiResponse {
  exhibitors: ApiExhibitor[];
  specials: ApiSpecial[];
}

export async function fetchApi(): Promise<ApiResponse> {
  const [exhibitorsRes, specialsRes] = await Promise.all([
    fetch(`${API_BASE}/space_orders?key=${API_KEY}`),
    fetch(`${API_BASE}/space_order_specials?key=${API_KEY}`),
  ]);

  if (!exhibitorsRes.ok) {
    throw new Error(`Failed to fetch exhibitors API: ${exhibitorsRes.status}`);
  }
  if (!specialsRes.ok) {
    throw new Error(`Failed to fetch specials API: ${specialsRes.status}`);
  }

  const exhibitorsData = (await exhibitorsRes.json()) as { space_orders: ApiExhibitor[] };
  const specialsData = (await specialsRes.json()) as { space_order_specials: ApiSpecial[] };

  return {
    exhibitors: exhibitorsData.space_orders,
    specials: specialsData.space_order_specials,
  };
}

// Re-export for backward compat with existing imports
export { fetchLocalHtml as fetchHtml };
