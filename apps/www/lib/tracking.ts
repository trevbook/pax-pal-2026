import type { GameType } from "@pax-pal/core";

// ---------------------------------------------------------------------------
// localStorage schema for game tracking (watchlist, played, ratings)
// ---------------------------------------------------------------------------

export interface TrackedGameData {
  name: string;
  slug: string;
  imageUrl: string | null;
  boothId: string | null;
  type: GameType;
  exhibitor: string;
}

export interface WatchlistEntry extends TrackedGameData {
  addedAt: string; // ISO timestamp
}

export interface PlayedEntry extends TrackedGameData {
  playedAt: string; // ISO timestamp
  rating: number | null; // 1-5, null if not rated
  comment: string | null; // review comment, null if not reviewed
}

export interface LocalTrackingData {
  watchlist: Record<string, WatchlistEntry>;
  played: Record<string, PlayedEntry>;
  reportedGameIds: string[];
}

const STORAGE_KEY = "pax-pal-tracking";

function getDefault(): LocalTrackingData {
  return { watchlist: {}, played: {}, reportedGameIds: [] };
}

/** Read full tracking data from localStorage. */
export function readTracking(): LocalTrackingData {
  if (typeof window === "undefined") return getDefault();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefault();
    return JSON.parse(raw) as LocalTrackingData;
  } catch {
    return getDefault();
  }
}

/** Write full tracking data to localStorage. */
export function writeTracking(data: LocalTrackingData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Build the denormalized game data stored alongside tracking entries. */
export function toTrackedGameData(game: {
  name: string;
  slug: string;
  imageUrl: string | null;
  boothId: string | null;
  type: GameType;
  exhibitor: string;
}): TrackedGameData {
  return {
    name: game.name,
    slug: game.slug,
    imageUrl: game.imageUrl,
    boothId: game.boothId,
    type: game.type,
    exhibitor: game.exhibitor,
  };
}
