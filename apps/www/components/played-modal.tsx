"use client";

import { Copy, Star } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { GameReview } from "@/app/actions/social";
import { claimUsername, submitReview } from "@/app/actions/social";
import { useUser } from "@/hooks/use-user";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

interface PlayedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: {
    id: string;
    name: string;
    slug: string;
  };
  /** Called when the user marks as played (with or without a public review). */
  onMarkPlayed: (rating: number | null, comment: string | null) => void;
  /** Called when a review is successfully published, so we can show it immediately. */
  onReviewPublished?: (review: GameReview) => void;
}

type ModalStep = "review" | "claim" | "recovery-phrase";

export function PlayedModal({
  open,
  onOpenChange,
  game,
  onMarkPlayed,
  onReviewPublished,
}: PlayedModalProps) {
  const { user, setUser } = useUser();
  const [step, setStep] = useState<ModalStep>("review");
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Username claim state (inline, no second modal)
  const [newUsername, setNewUsername] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");

  const resetState = useCallback(() => {
    setStep("review");
    setRating(null);
    setComment("");
    setError(null);
    setNewUsername("");
    setRecoveryPhrase("");
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) resetState();
      onOpenChange(open);
    },
    [onOpenChange, resetState],
  );

  const handleJustPlayed = useCallback(() => {
    onMarkPlayed(rating, comment.trim() || null);
    handleOpenChange(false);
    toast.success("Marked as played!");
  }, [rating, comment, onMarkPlayed, handleOpenChange]);

  const handleSubmitReview = useCallback(async () => {
    if (!user || !comment.trim() || !rating) return;

    setError(null);
    setSubmitting(true);
    try {
      const result = await submitReview({
        gameSlug: game.slug,
        gameName: game.name,
        username: user.username,
        secretToken: user.secretToken,
        rating,
        comment: comment.trim(),
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      onMarkPlayed(rating, comment.trim());
      onReviewPublished?.({
        username: user.username,
        rating,
        comment: comment.trim(),
        createdAt: new Date().toISOString(),
      });
      handleOpenChange(false);
      toast.success("Review published!");
    } catch {
      setError("Failed to submit review. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    user,
    comment,
    rating,
    game.slug,
    game.name,
    onMarkPlayed,
    onReviewPublished,
    handleOpenChange,
  ]);

  const handleClaimUsername = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await claimUsername(newUsername);
      if (!result.success) {
        setError(
          result.error === "taken"
            ? "That username is already taken."
            : "Username must be 3–20 characters (letters, numbers, _ or -).",
        );
        return;
      }
      setUser({
        username: result.username,
        secretToken: result.secretToken,
        recoveryPhrase: result.recoveryPhrase,
      });
      setRecoveryPhrase(result.recoveryPhrase);
      setStep("recovery-phrase");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [newUsername, setUser]);

  const canSubmitReview = user && comment.trim().length > 0 && rating !== null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        {step === "review" && (
          <>
            <DialogHeader>
              <DialogTitle>You played {game.name}!</DialogTitle>
              <DialogDescription>
                Rate it and leave a review to help other PAX attendees.
              </DialogDescription>
            </DialogHeader>

            {/* Star rating */}
            <div>
              <p className="mb-2 text-sm font-medium">How was it?</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(rating === star ? null : star)}
                    className="rounded p-1 transition-colors hover:bg-accent"
                    aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                  >
                    <Star
                      className={cn(
                        "size-7",
                        rating != null && star <= rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label htmlFor="review-comment" className="text-sm font-medium">
                Quick review <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                placeholder="What did you think? A sentence or two is great..."
                className="mt-1.5"
                rows={3}
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{comment.length}/500</p>
            </div>

            {/* Social nudge — inline username claim prompt */}
            {comment.trim() && !user && (
              <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
                <p className="mb-2 text-sm">
                  <span className="font-medium">Want this review to be public?</span> Claim a
                  username and it'll show up on this game's page.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Pick a username"
                    value={newUsername}
                    onChange={(e) =>
                      setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
                    }
                    maxLength={20}
                    className="h-9 text-sm"
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      !submitting &&
                      newUsername.length >= 3 &&
                      handleClaimUsername()
                    }
                  />
                  <Button
                    size="sm"
                    onClick={handleClaimUsername}
                    disabled={submitting || newUsername.length < 3}
                    className="shrink-0"
                  >
                    {submitting ? "..." : "Claim"}
                  </Button>
                </div>
              </div>
            )}

            {/* Logged in indicator */}
            {user && (
              <p className="text-sm text-muted-foreground">
                Posting as <span className="font-medium text-foreground">{user.username}</span>
              </p>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={handleJustPlayed} className="flex-1">
                Just Mark Played
              </Button>
              <Button
                onClick={handleSubmitReview}
                disabled={!canSubmitReview || submitting}
                className="flex-1"
              >
                {submitting ? "Submitting..." : "Submit Review"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "recovery-phrase" && (
          <>
            <DialogHeader>
              <DialogTitle>Username claimed!</DialogTitle>
              <DialogDescription>
                Save your recovery phrase somewhere safe — it's the only way to get your account
                back if you clear your browser data.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-950/40">
              <p className="mb-2 text-xs font-medium text-yellow-800 dark:text-yellow-200">
                Your recovery phrase:
              </p>
              <p className="font-mono text-lg font-bold tracking-wide text-yellow-900 dark:text-yellow-100">
                {recoveryPhrase}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  navigator.clipboard.writeText(recoveryPhrase);
                  toast.success("Recovery phrase copied!");
                }}
              >
                <Copy className="mr-1.5 size-3.5" />
                Copy phrase
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Screenshot this or write it down. Now hit "Back to review" to publish your review!
            </p>

            <DialogFooter>
              <Button onClick={() => setStep("review")} className="w-full">
                Back to review
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
