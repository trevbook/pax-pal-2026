"use client";

import { Gamepad2, Heart, Star, type TrendingUp } from "lucide-react";
import Link from "next/link";
import { useTrackingStats } from "@/hooks/use-tracking";

export function HomeProgress() {
  const { watchlistCount, playedCount, totalTracked } = useTrackingStats();

  if (totalTracked === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Start Building Your PAX Game Plan!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse the game catalogue, search by vibe, or explore the expo map — then watchlist the
          games you want to check out.
        </p>
        <div className="mt-3 flex gap-2">
          <Link
            href="/games"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Browse Games
          </Link>
          <Link
            href="/search"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            Search
          </Link>
        </div>
      </section>
    );
  }

  const progressPct = totalTracked > 0 ? Math.round((playedCount / totalTracked) * 100) : 0;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Your PAX Progress</h2>
        <Link href="/my-games" className="text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {playedCount} of {totalTracked} played
          </span>
          <span>{progressPct}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatCard icon={Heart} label="Watchlisted" value={watchlistCount} />
        <StatCard icon={Gamepad2} label="Played" value={playedCount} />
        <StatCard icon={Star} label="To Go" value={Math.max(0, watchlistCount - playedCount)} />
      </div>
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 py-2.5">
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-lg font-bold leading-none">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
