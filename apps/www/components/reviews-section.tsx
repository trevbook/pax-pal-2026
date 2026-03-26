import { MessageCircle, Star } from "lucide-react";
import Link from "next/link";
import type { GameReview } from "@/app/actions/social";

interface ReviewsSectionProps {
  reviews: GameReview[];
}

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

export function ReviewsSection({ reviews }: ReviewsSectionProps) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <MessageCircle className="size-4" />
        Community Reviews
        {reviews.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{reviews.length}</span>
        )}
      </h3>

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reviews yet. Play this game and share what you think!
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <div
              key={`${review.username}-${review.createdAt}`}
              className="rounded-lg border border-border p-3"
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/profile/${review.username}`}
                  className="text-sm font-medium hover:underline"
                >
                  {review.username}
                </Link>
                <span className="text-xs text-muted-foreground">{timeAgo(review.createdAt)}</span>
              </div>
              <div className="mt-1 flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`size-3.5 ${
                      star <= review.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{review.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
