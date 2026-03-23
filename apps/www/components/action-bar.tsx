"use client";

import { Check, Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

interface ActionBarProps {
  isWatchlisted: boolean;
  isPlayed: boolean;
  rating: number | null;
  onToggleWatchlist: () => void;
  onTogglePlayed: () => void;
  onSetRating: (value: number | null) => void;
}

export function ActionBar({
  isWatchlisted,
  isPlayed,
  rating,
  onToggleWatchlist,
  onTogglePlayed,
  onSetRating,
}: ActionBarProps) {
  return (
    <div className="fixed bottom-14 left-0 right-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 px-4 py-2">
        {/* Watchlist */}
        <Button
          variant={isWatchlisted ? "default" : "outline"}
          size="sm"
          onClick={onToggleWatchlist}
          className="flex-1"
        >
          <Heart className={cn("mr-1.5 size-4", isWatchlisted && "fill-current")} />
          {isWatchlisted ? "Watchlisted" : "Watchlist"}
        </Button>

        {/* Played */}
        <Button
          variant={isPlayed ? "default" : "outline"}
          size="sm"
          onClick={onTogglePlayed}
          className="flex-1"
        >
          <Check className={cn("mr-1.5 size-4", isPlayed && "stroke-[3]")} />
          {isPlayed ? "Played" : "Played?"}
        </Button>

        {/* Rating — only available after marking as played */}
        {isPlayed && (
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => onSetRating(rating === star ? null : star)}
                className="rounded p-1 transition-colors hover:bg-accent"
                aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
              >
                <Star
                  className={cn(
                    "size-5",
                    rating != null && star <= rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground",
                  )}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
