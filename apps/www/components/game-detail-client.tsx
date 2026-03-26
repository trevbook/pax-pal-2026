"use client";

import type { GameType } from "@pax-pal/core";
import { AlertTriangle } from "lucide-react";
import { useCallback, useState } from "react";
import type { GameReview } from "@/app/actions/social";
import { useTracking } from "@/hooks/use-tracking";
import { ActionBar } from "./action-bar";
import { PlayedModal } from "./played-modal";
import { ReportModal } from "./report-modal";
import { ReviewsSection } from "./reviews-section";

interface GameDetailClientProps {
  game: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    boothId: string | null;
    type: GameType;
    exhibitor: string;
  };
  confirmed: boolean;
  initialReviews: GameReview[];
}

/** Client wrapper that provides tracking state + action bar + played/report modals + reviews. */
export function GameDetailClient({ game, confirmed, initialReviews }: GameDetailClientProps) {
  const tracking = useTracking(game);
  const [reportOpen, setReportOpen] = useState(false);
  const [playedModalOpen, setPlayedModalOpen] = useState(false);
  const [reviews, setReviews] = useState<GameReview[]>(initialReviews);

  const handleMarkPlayed = useCallback(
    (rating: number | null, comment: string | null) => {
      tracking.markPlayedWithReview(rating, comment);
    },
    [tracking.markPlayedWithReview],
  );

  const handleReviewPublished = useCallback((review: GameReview) => {
    setReviews((prev) => {
      // Replace existing review by same user, or prepend
      const filtered = prev.filter((r) => r.username !== review.username);
      return [review, ...filtered];
    });
  }, []);

  return (
    <>
      {/* Unconfirmed alert banner */}
      {!confirmed && (
        <div className="mt-6 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 dark:border-yellow-700 dark:bg-yellow-950/40">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              This game hasn't been confirmed for PAX East 2026. We identified it through web
              searches based on {game.exhibitor}'s booth listing, but they haven't listed a playable
              demo on the PAX website.{" "}
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="font-medium underline underline-offset-2 hover:text-yellow-900 dark:hover:text-yellow-100"
              >
                Report incorrect data
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Community reviews */}
      <ReviewsSection reviews={reviews} />

      {/* Sticky action bar above bottom nav */}
      <ActionBar
        isWatchlisted={tracking.isWatchlisted}
        isPlayed={tracking.isPlayed}
        rating={tracking.rating}
        onToggleWatchlist={tracking.toggleWatchlist}
        onTogglePlayed={tracking.togglePlayed}
        onSetRating={tracking.setRating}
        onPlayedClick={() => setPlayedModalOpen(true)}
      />

      {/* Played + review modal */}
      <PlayedModal
        open={playedModalOpen}
        onOpenChange={setPlayedModalOpen}
        game={game}
        onMarkPlayed={handleMarkPlayed}
        onReviewPublished={handleReviewPublished}
      />

      {/* Report section — at the bottom of the page content */}
      <div className="mt-8 border-t border-border pt-6 text-center">
        <ReportModal
          gameId={game.id}
          gameName={game.name}
          hasReported={tracking.hasReported}
          onReported={tracking.markReported}
          open={reportOpen}
          onOpenChange={setReportOpen}
        />
      </div>
    </>
  );
}
