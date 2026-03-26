"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readTracking, toTrackedGameData, writeTracking } from "@/lib/tracking";

// ---------------------------------------------------------------------------
// External store for tracking data — allows multiple components to stay in sync
// ---------------------------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitChange(): void {
  for (const l of listeners) l();
}

/** Snapshot for useSyncExternalStore. */
let snapshot = readTracking();

function getSnapshot() {
  return snapshot;
}

const SERVER_SNAPSHOT: ReturnType<typeof readTracking> = {
  watchlist: {},
  played: {},
  reportedGameIds: [],
};

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

/** Mutate tracking data, persist, and notify subscribers. */
function mutate(fn: (data: ReturnType<typeof readTracking>) => void): void {
  const data = readTracking();
  fn(data);
  writeTracking(data);
  snapshot = data;
  emitChange();
}

// Also listen for storage events from other tabs
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "pax-pal-tracking") {
      snapshot = readTracking();
      emitChange();
    }
  });
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

interface GameInput {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  boothId: string | null;
  type: "video_game" | "tabletop" | "both";
  exhibitor: string;
}

/**
 * Track a single game — watchlist, played, rating.
 * Pass the game data so we can denormalize it on first add.
 */
export function useTracking(game: GameInput) {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isWatchlisted = game.id in data.watchlist;
  const isPlayed = game.id in data.played;
  const rating = data.played[game.id]?.rating ?? null;
  const comment = data.played[game.id]?.comment ?? null;
  const hasReported = data.reportedGameIds.includes(game.id);

  const toggleWatchlist = useCallback(() => {
    mutate((d) => {
      if (game.id in d.watchlist) {
        delete d.watchlist[game.id];
      } else {
        d.watchlist[game.id] = {
          ...toTrackedGameData(game),
          addedAt: new Date().toISOString(),
        };
      }
    });
    tryHaptic();
  }, [game]);

  const togglePlayed = useCallback(() => {
    mutate((d) => {
      if (game.id in d.played) {
        delete d.played[game.id];
      } else {
        d.played[game.id] = {
          ...toTrackedGameData(game),
          playedAt: new Date().toISOString(),
          rating: null,
          comment: null,
        };
      }
    });
    tryHaptic();
  }, [game]);

  const setRating = useCallback(
    (value: number | null) => {
      mutate((d) => {
        const entry = d.played[game.id];
        if (entry) {
          entry.rating = value;
        }
      });
    },
    [game.id],
  );

  const markPlayedWithReview = useCallback(
    (reviewRating: number | null, reviewComment: string | null) => {
      mutate((d) => {
        if (game.id in d.played) {
          const entry = d.played[game.id];
          entry.rating = reviewRating;
          entry.comment = reviewComment;
        } else {
          d.played[game.id] = {
            ...toTrackedGameData(game),
            playedAt: new Date().toISOString(),
            rating: reviewRating,
            comment: reviewComment,
          };
        }
      });
      tryHaptic();
    },
    [game],
  );

  const markReported = useCallback(() => {
    mutate((d) => {
      if (!d.reportedGameIds.includes(game.id)) {
        d.reportedGameIds.push(game.id);
      }
    });
  }, [game.id]);

  return {
    isWatchlisted,
    isPlayed,
    rating,
    comment,
    hasReported,
    toggleWatchlist,
    togglePlayed,
    setRating,
    markPlayedWithReview,
    markReported,
  };
}

/** Aggregate tracking stats for My Games badge + progress bar. */
export function useTrackingStats() {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const watchlistCount = Object.keys(data.watchlist).length;
  const playedCount = Object.keys(data.played).length;
  const totalTracked = new Set([...Object.keys(data.watchlist), ...Object.keys(data.played)]).size;

  return { watchlistCount, playedCount, totalTracked };
}

/** Access the full tracking data (watchlist + played maps). */
export function useTrackingList() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Remove a game from the watchlist by ID. */
export function removeFromWatchlist(gameId: string) {
  mutate((d) => {
    delete d.watchlist[gameId];
  });
  tryHaptic();
}

/** Remove a game from the played list by ID. */
export function removeFromPlayed(gameId: string) {
  mutate((d) => {
    delete d.played[gameId];
  });
  tryHaptic();
}

/** Set or clear a rating for a played game by ID. */
export function setGameRating(gameId: string, rating: number | null) {
  mutate((d) => {
    const entry = d.played[gameId];
    if (entry) entry.rating = rating;
  });
}

/** Trigger haptic feedback if the browser supports it. */
function tryHaptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(10);
  }
}
