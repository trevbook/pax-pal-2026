"use client";

import type { GameType } from "@pax-pal/core";
import { useCallback, useEffect, useState } from "react";
import { type GameReview, getReviewsForGame } from "@/app/actions/social";
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
  initialReviews: GameReview[];
}

/** Client wrapper that provides tracking state + action bar + played/report modals + reviews. */
export function GameDetailClient({ game, initialReviews }: GameDetailClientProps) {
  const tracking = useTracking(game);
  const [reportOpen, setReportOpen] = useState(false);
  const [playedModalOpen, setPlayedModalOpen] = useState(false);
  const [reviews, setReviews] = useState<GameReview[]>(initialReviews);

  // Hydrate with fresh reviews — static pages bake in build-time data
  useEffect(() => {
    getReviewsForGame(game.slug).then((fresh) => {
      if (fresh.length > 0 || initialReviews.length > 0) {
        setReviews(fresh);
      }
    });
  }, [game.slug, initialReviews.length]);

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
