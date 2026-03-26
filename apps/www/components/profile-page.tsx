"use client";

import type { GameType } from "@pax-pal/core";
import { Check, Eye, Heart, MessageCircle, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProfileData, UserReview } from "@/app/actions/social";
import { formatBoothDisplay } from "@/lib/format-booth";
import { compareBoothId } from "@/lib/sort-booth";
import { cn } from "@/lib/utils";
import { GameImage } from "./game-image";
import { TypeBadge } from "./type-badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "played" | "watchlist" | "reviews";

// ---------------------------------------------------------------------------
// Stats Section
// ---------------------------------------------------------------------------

function StatsSection({
  playedCount,
  watchlistCount,
  ratedCount,
  avgRating,
  reviewCount,
}: {
  playedCount: number;
  watchlistCount: number;
  ratedCount: number;
  avgRating: number;
  reviewCount: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">PAX Stats</h2>
      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <div>
          <p className="text-2xl font-bold tabular-nums">{playedCount}</p>
          <p className="text-xs text-muted-foreground">Played</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{watchlistCount}</p>
          <p className="text-xs text-muted-foreground">Watchlisted</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{ratedCount}</p>
          <p className="text-xs text-muted-foreground">Rated</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">
            {avgRating > 0 ? `★ ${avgRating.toFixed(1)}` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Avg Rating</p>
        </div>
      </div>
      {reviewCount > 0 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {reviewCount} public review{reviewCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Game Row (read-only, no remove/edit)
// ---------------------------------------------------------------------------

function GameRow({
  slug,
  name,
  exhibitor,
  boothId,
  imageUrl,
  type,
  rating,
  comment,
}: {
  slug: string;
  name: string;
  exhibitor: string;
  boothId: string | null;
  imageUrl: string | null;
  type: string;
  rating?: number | null;
  comment?: string | null;
}) {
  const booth = formatBoothDisplay(boothId);

  return (
    <Link
      href={`/games/${slug}`}
      className="flex min-w-0 gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50"
    >
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md">
        <GameImage src={imageUrl} alt={name} type={type as GameType} className="rounded-md" />
        <TypeBadge
          type={type as GameType}
          className="absolute top-0.5 right-0.5 origin-top-right scale-75"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <h3 className="truncate text-sm font-semibold leading-tight">{name}</h3>
        <p className="truncate text-xs text-muted-foreground">
          {exhibitor}
          {booth ? ` · ${booth.label}` : ""}
        </p>
        {rating != null && (
          <div className="mt-0.5 flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  "size-3.5",
                  star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30",
                )}
              />
            ))}
          </div>
        )}
        {comment && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground italic">
            &ldquo;{comment}&rdquo;
          </p>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Review Card (shows game name + link instead of username)
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function ReviewCard({ review }: { review: UserReview }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <Link href={`/games/${review.gameSlug}`} className="text-sm font-medium hover:underline">
          {review.gameName}
        </Link>
        <span className="text-xs text-muted-foreground">{timeAgo(review.createdAt)}</span>
      </div>
      <div className="mt-1 flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`size-3.5 ${
              star <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{review.comment}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sorting helpers
// ---------------------------------------------------------------------------

function sortByName<T extends { name: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name));
}

function sortByBooth<T extends { boothId: string | null }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => compareBoothId(a.boothId, b.boothId));
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface ProfilePageProps {
  profile: ProfileData;
  reviews: UserReview[];
}

export function ProfilePage({ profile, reviews }: ProfilePageProps) {
  const [tab, setTab] = useState<Tab>("played");

  const playedEntries = useMemo(
    () => sortByName(Object.entries(profile.played).map(([id, entry]) => ({ id, ...entry }))),
    [profile.played],
  );

  const watchlistEntries = useMemo(
    () => sortByBooth(Object.entries(profile.watchlist).map(([id, entry]) => ({ id, ...entry }))),
    [profile.watchlist],
  );

  const stats = useMemo(() => {
    const rated = playedEntries.filter((e) => e.rating != null);
    const ratedCount = rated.length;
    const avgRating =
      ratedCount > 0 ? rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / ratedCount : 0;
    return { ratedCount, avgRating };
  }, [playedEntries]);

  const playedCount = playedEntries.length;
  const watchlistCount = watchlistEntries.length;

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{profile.username}</h1>
        <p className="text-sm text-muted-foreground">PAX East 2026 Recap</p>
      </div>

      {/* Stats */}
      <StatsSection
        playedCount={playedCount}
        watchlistCount={watchlistCount}
        ratedCount={stats.ratedCount}
        avgRating={stats.avgRating}
        reviewCount={reviews.length}
      />

      {/* Tabs */}
      <div className="mt-4 flex gap-2">
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
          <Eye className="size-3.5" />
          Watchlist ({watchlistCount})
        </button>
        <button
          type="button"
          onClick={() => setTab("reviews")}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            tab === "reviews"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          <MessageCircle className="size-3.5" />
          Reviews ({reviews.length})
        </button>
      </div>

      {/* Tab content */}
      <div className="mt-3 flex flex-col gap-2">
        {tab === "played" &&
          (playedCount === 0 ? (
            <EmptyTab message="No games played yet." />
          ) : (
            playedEntries.map((entry) => (
              <GameRow
                key={entry.id}
                slug={entry.slug}
                name={entry.name}
                exhibitor={entry.exhibitor}
                boothId={entry.boothId}
                imageUrl={entry.imageUrl}
                type={entry.type}
                rating={entry.rating}
                comment={entry.comment}
              />
            ))
          ))}

        {tab === "watchlist" &&
          (watchlistCount === 0 ? (
            <EmptyTab message="No games on the watchlist." />
          ) : (
            watchlistEntries.map((entry) => (
              <GameRow
                key={entry.id}
                slug={entry.slug}
                name={entry.name}
                exhibitor={entry.exhibitor}
                boothId={entry.boothId}
                imageUrl={entry.imageUrl}
                type={entry.type}
              />
            ))
          ))}

        {tab === "reviews" &&
          (reviews.length === 0 ? (
            <EmptyTab message="No public reviews yet." />
          ) : (
            reviews.map((review) => (
              <ReviewCard key={`${review.gameSlug}-${review.createdAt}`} review={review} />
            ))
          ))}
      </div>
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Heart className="size-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link href="/games" className="text-sm font-medium text-primary hover:underline">
        Browse Games
      </Link>
    </div>
  );
}
