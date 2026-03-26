"use client";

import { Check, Copy, Heart, Share2, Star, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  removeFromPlayed,
  removeFromWatchlist,
  setGameRating,
  useTrackingList,
} from "@/hooks/use-tracking";
import { useUser } from "@/hooks/use-user";
import { formatBoothDisplay } from "@/lib/format-booth";
import { compareBoothId } from "@/lib/sort-booth";
import type { PlayedEntry, TrackedGameData, WatchlistEntry } from "@/lib/tracking";
import { cn } from "@/lib/utils";
import { GameImage } from "./game-image";
import { TypeBadge } from "./type-badge";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { UsernameModal } from "./username-modal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "watchlist" | "played";
type SortOption = "name" | "booth" | "recent";

interface GameEntry extends TrackedGameData {
  id: string;
  addedAt: string;
  rating?: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function watchlistToEntries(watchlist: Record<string, WatchlistEntry>): GameEntry[] {
  return Object.entries(watchlist).map(([id, entry]) => ({
    id,
    ...entry,
  }));
}

function playedToEntries(played: Record<string, PlayedEntry>): GameEntry[] {
  return Object.entries(played).map(([id, entry]) => ({
    id,
    ...entry,
    addedAt: entry.playedAt,
    rating: entry.rating,
  }));
}

function sortEntries(entries: GameEntry[], sort: SortOption): GameEntry[] {
  const sorted = [...entries];
  switch (sort) {
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "booth":
      sorted.sort((a, b) => compareBoothId(a.boothId, b.boothId));
      break;
    case "recent":
      sorted.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
      break;
  }
  return sorted;
}

// ---------------------------------------------------------------------------
// Progress Section
// ---------------------------------------------------------------------------

function ProgressSection({
  watchlistCount,
  playedCount,
  ratedCount,
  avgRating,
  watchlistPlayedCount,
}: {
  watchlistCount: number;
  playedCount: number;
  ratedCount: number;
  avgRating: number;
  watchlistPlayedCount: number;
}) {
  const ratio = watchlistCount > 0 ? watchlistPlayedCount / watchlistCount : 0;
  const pct = Math.round(ratio * 100);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Your PAX Progress</h2>

      {/* Progress bar */}
      <div className="mb-1 flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {watchlistPlayedCount} / {watchlistCount}
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{pct}% of watchlist played</p>

      {/* Stats row */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{watchlistCount} watchlisted</span>
        <span className="text-border">·</span>
        <span>{playedCount} played</span>
        {ratedCount > 0 && (
          <>
            <span className="text-border">·</span>
            <span>{ratedCount} rated</span>
            <span className="text-border">·</span>
            <span>avg ★ {avgRating.toFixed(1)}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Game Row (compact card + controls)
// ---------------------------------------------------------------------------

function GameRow({
  entry,
  tab,
  onRemove,
  onSetRating,
}: {
  entry: GameEntry;
  tab: Tab;
  onRemove: () => void;
  onSetRating?: (rating: number | null) => void;
}) {
  const booth = formatBoothDisplay(entry.boothId);

  return (
    <div className="group flex items-center gap-2">
      {/* Card body — link to detail */}
      <Link
        href={`/games/${entry.slug}`}
        className="flex min-w-0 flex-1 gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50"
      >
        {/* Thumbnail */}
        <div className="relative size-16 shrink-0 overflow-hidden rounded-md">
          <GameImage
            src={entry.imageUrl}
            alt={entry.name}
            type={entry.type}
            className="rounded-md"
          />
          <TypeBadge
            type={entry.type}
            className="absolute top-0.5 right-0.5 origin-top-right scale-75"
          />
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <h3 className="truncate text-sm font-semibold leading-tight">{entry.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {entry.exhibitor}
            {booth ? ` · ${booth.label}` : ""}
          </p>
          {/* Star rating display on played tab */}
          {tab === "played" && onSetRating && (
            <div className="mt-0.5 flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSetRating(entry.rating === star ? null : star);
                  }}
                  className="rounded p-0.5 transition-colors hover:bg-accent"
                  aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                >
                  <Star
                    className={cn(
                      "size-3.5",
                      entry.rating != null && star <= entry.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/50",
                    )}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </Link>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Remove ${entry.name} from ${tab}`}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Share / Export
// ---------------------------------------------------------------------------

function generateShareText(
  watchlist: Record<string, WatchlistEntry>,
  played: Record<string, PlayedEntry>,
): string {
  const playedEntries = Object.values(played);
  const playedIds = new Set(Object.keys(played));

  const rated = playedEntries
    .filter((e) => e.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  const missedNames = Object.entries(watchlist)
    .filter(([id]) => !playedIds.has(id))
    .map(([, e]) => e.name);

  const lines = ["My PAX East 2026 Recap (via PAX Pal)"];
  lines.push(
    `Played ${playedEntries.length} game${playedEntries.length !== 1 ? "s" : ""}, rated ${rated.length}`,
  );

  if (rated.length > 0) {
    const topRated = rated
      .slice(0, 3)
      .map((e) => `${e.name} (${"★".repeat(e.rating ?? 0)})`)
      .join(", ");
    lines.push(`Top rated: ${topRated}`);
  }

  if (missedNames.length > 0) {
    const missedStr = missedNames.slice(0, 4).join(", ");
    const suffix = missedNames.length > 4 ? `, +${missedNames.length - 4} more` : "";
    lines.push(`Watchlisted but missed: ${missedStr}${suffix}`);
  }

  return lines.join("\n");
}

function ShareButton({
  watchlist,
  played,
}: {
  watchlist: Record<string, WatchlistEntry>;
  played: Record<string, PlayedEntry>;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const text = generateShareText(watchlist, played);

    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // User cancelled or API not available — fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Last resort
    }
  };

  return (
    <Button variant="outline" className="w-full" onClick={handleShare}>
      {copied ? (
        <>
          <Copy className="mr-2 size-4" />
          Copied to clipboard!
        </>
      ) : (
        <>
          <Share2 className="mr-2 size-4" />
          Share Your PAX Recap
        </>
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <Heart className="size-8 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Your game list is empty!</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Browse games and add them to your watchlist to plan your PAX adventure.
        </p>
      </div>
      <Button asChild>
        <Link href="/games">Browse Games →</Link>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Empty State
// ---------------------------------------------------------------------------

function TabEmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      {tab === "watchlist" ? (
        <Heart className="size-10 text-muted-foreground/40" />
      ) : (
        <Check className="size-10 text-muted-foreground/40" />
      )}
      <p className="text-sm text-muted-foreground">
        {tab === "watchlist"
          ? "No games on your watchlist yet. Browse games and tap the heart to add them!"
          : 'No games marked as played yet. Visit a game and tap "Played" after trying it!'}
      </p>
      <Button variant="outline" size="sm" asChild>
        <Link href="/games">Browse Games</Link>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function MyGames() {
  const data = useTrackingList();
  const { user } = useUser();
  const [tab, setTab] = useState<Tab>("watchlist");
  const [sort, setSort] = useState<SortOption>("name");
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("pax-pal-username-banner-dismissed") === "true";
  });

  // Derived data
  const watchlistEntries = useMemo(() => watchlistToEntries(data.watchlist), [data.watchlist]);
  const playedEntries = useMemo(() => playedToEntries(data.played), [data.played]);

  const watchlistCount = watchlistEntries.length;
  const playedCount = playedEntries.length;
  const hasAnyData = watchlistCount > 0 || playedCount > 0;

  // Stats for progress section
  const stats = useMemo(() => {
    const playedIds = new Set(Object.keys(data.played));
    const watchlistPlayedCount = Object.keys(data.watchlist).filter((id) =>
      playedIds.has(id),
    ).length;
    const rated = Object.values(data.played).filter((e) => e.rating != null);
    const ratedCount = rated.length;
    const avgRating =
      ratedCount > 0 ? rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / ratedCount : 0;
    return { watchlistPlayedCount, ratedCount, avgRating };
  }, [data.watchlist, data.played]);

  // Sorted entries for current tab
  const sortedEntries = useMemo(() => {
    const entries = tab === "watchlist" ? watchlistEntries : playedEntries;
    return sortEntries(entries, sort);
  }, [tab, watchlistEntries, playedEntries, sort]);

  // Full empty state
  if (!hasAnyData) {
    return (
      <div className="p-4">
        <h1 className="mb-4 text-2xl font-bold">My Games</h1>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">My Games</h1>

      {/* Social banner — only when not signed in and has played games */}
      {!user && playedCount > 0 && !bannerDismissed && (
        <div className="mb-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm">
              <span className="font-medium">Share your PAX journey</span> &mdash;{" "}
              <button
                type="button"
                onClick={() => setUsernameModalOpen(true)}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                claim a username
              </button>{" "}
              to make your reviews public.
            </p>
            <button
              type="button"
              onClick={() => {
                setBannerDismissed(true);
                localStorage.setItem("pax-pal-username-banner-dismissed", "true");
              }}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      <UsernameModal open={usernameModalOpen} onOpenChange={setUsernameModalOpen} />

      {/* Progress section */}
      <ProgressSection
        watchlistCount={watchlistCount}
        playedCount={playedCount}
        ratedCount={stats.ratedCount}
        avgRating={stats.avgRating}
        watchlistPlayedCount={stats.watchlistPlayedCount}
      />

      {/* Tabs */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("watchlist")}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            tab === "watchlist"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          <Heart className="size-3.5" />
          Watchlist ({watchlistCount})
        </button>
        <button
          type="button"
          onClick={() => setTab("played")}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            tab === "played"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          <Check className="size-3.5" />
          Played ({playedCount})
        </button>
      </div>

      {/* Sort controls */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {sortedEntries.length} {tab === "watchlist" ? "watchlisted" : "played"} game
          {sortedEntries.length !== 1 ? "s" : ""}
        </span>
        <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="booth">Booth Number</SelectItem>
            <SelectItem value="recent">Recently Added</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Game list */}
      <div className="mt-3 flex flex-col gap-2">
        {sortedEntries.length === 0 ? (
          <TabEmptyState tab={tab} />
        ) : (
          sortedEntries.map((entry) => (
            <GameRow
              key={entry.id}
              entry={entry}
              tab={tab}
              onRemove={() =>
                tab === "watchlist" ? removeFromWatchlist(entry.id) : removeFromPlayed(entry.id)
              }
              onSetRating={tab === "played" ? (r) => setGameRating(entry.id, r) : undefined}
            />
          ))
        )}
      </div>

      {/* Share / Export */}
      <div className="mt-6">
        <ShareButton watchlist={data.watchlist} played={data.played} />
      </div>
    </div>
  );
}
