"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getRecommendations } from "@/app/recommendations/actions";
import { useTrackingList } from "@/hooks/use-tracking";
import type { GameCardData } from "@/lib/game-card-data";
import { GameCard } from "./game-card";
import { Skeleton } from "./ui/skeleton";

const DEBOUNCE_MS = 1000;

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

  useEffect(() => {
    if (uniqueIds.length === 0) {
      setResults([]);
      setHasFetched(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const recs = await getRecommendations(uniqueIds);
        setResults(recs);
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
  }, [uniqueIds]);

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
