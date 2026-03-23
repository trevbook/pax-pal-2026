"use client";

import type { GameType } from "@pax-pal/core";
import { useTracking } from "@/hooks/use-tracking";
import { ActionBar } from "./action-bar";
import { ReportModal } from "./report-modal";

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
}

/** Client wrapper that provides tracking state + action bar + report modal. */
export function GameDetailClient({ game }: GameDetailClientProps) {
  const tracking = useTracking(game);

  return (
    <>
      {/* Sticky action bar above bottom nav */}
      <ActionBar
        isWatchlisted={tracking.isWatchlisted}
        isPlayed={tracking.isPlayed}
        rating={tracking.rating}
        onToggleWatchlist={tracking.toggleWatchlist}
        onTogglePlayed={tracking.togglePlayed}
        onSetRating={tracking.setRating}
      />

      {/* Report section — at the bottom of the page content */}
      <div className="mt-8 border-t border-border pt-6 text-center">
        <ReportModal
          gameId={game.id}
          gameName={game.name}
          hasReported={tracking.hasReported}
          onReported={tracking.markReported}
        />
      </div>
    </>
  );
}
