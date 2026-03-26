"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getRecommendations } from "@/app/recommendations/actions";
import { useTrackingList } from "@/hooks/use-tracking";
import type { GameCardData } from "@/lib/game-card-data";
import { GameCard } from "./game-card";
import { Skeleton } from "./ui/skeleton";

const DEBOUNCE_MS = 1000;
const CACHE_KEY = "pax-pal-recommendations";

function readCache(idsKey: string): GameCardData[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { key: string; results: GameCardData[] };
    return cached.key === idsKey ? cached.results : null;
  } catch {
    return null;
  }
}

function writeCache(idsKey: string, results: GameCardData[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ key: idsKey, results }));
  } catch {
    // storage full — ignore
  }
}

export function RecommendedGames() {
  const tracking = useTrackingList();
  const [results, setResults] = useState<GameCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Combine and deduplicate watchlist + played IDs — sorted for stable identity
  const uniqueIds = useMemo(() => {
    const ids = new Set([...Object.keys(tracking.watchlist), ...Object.keys(tracking.played)]);
    return [...ids].sort();
  }, [tracking.watchlist, tracking.played]);

  const idsKey = uniqueIds.join(",");

  useEffect(() => {
    if (uniqueIds.length === 0) {
      setResults([]);
      setHasFetched(false);
      return;
    }

    // Use cached results if the watchlist hasn't changed
    const cached = readCache(idsKey);
    if (cached) {
      setResults(cached);
      setHasFetched(true);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const recs = await getRecommendations(uniqueIds);
        setResults(recs);
        writeCache(idsKey, recs);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setHasFetched(true);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [idsKey, uniqueIds]);

  // Don't render when there's nothing to show
  if (uniqueIds.length === 0) return null;
  if (hasFetched && !loading && results.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold">Recommended For You</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Based on your watchlist and played games
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {loading && !hasFetched
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
                key={i}
                className="flex gap-3 rounded-lg border border-border p-3"
              >
                <Skeleton className="size-16 shrink-0 rounded-md" />
                <div className="flex flex-1 flex-col justify-center gap-1">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              </div>
            ))
          : results.map((game) => <GameCard key={game.id} game={game} variant="compact" />)}
      </div>
    </section>
  );
}
