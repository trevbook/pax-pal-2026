"use client";

import { Copy, KeyRound, UserPlus } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { claimUsername, recoverUsername } from "@/app/actions/social";
import { useUser } from "@/hooks/use-user";
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

interface UsernameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ModalView = "claim" | "recover" | "success";

export function UsernameModal({ open, onOpenChange, onSuccess }: UsernameModalProps) {
  const { setUser } = useUser();
  const [view, setView] = useState<ModalView>("claim");
  const [username, setUsername] = useState("");
  const [phrase, setPhrase] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setView("claim");
    setUsername("");
    setPhrase("");
    setRecoveryPhrase("");
    setError(null);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) resetState();
      onOpenChange(open);
    },
    [onOpenChange, resetState],
  );

  const handleClaim = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await claimUsername(username);
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
      setView("success");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [username, setUser]);

  const handleRecover = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await recoverUsername(phrase);
      if (!result.success) {
        setError("No account found with that recovery phrase.");
        return;
      }
      setUser({
        username: result.username,
        secretToken: result.secretToken,
        recoveryPhrase: result.recoveryPhrase,
      });
      toast.success(`Welcome back, ${result.username}!`);
      handleOpenChange(false);
      onSuccess?.();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [phrase, setUser, handleOpenChange, onSuccess]);

  const handleCopyPhrase = useCallback(() => {
    navigator.clipboard.writeText(recoveryPhrase);
    toast.success("Recovery phrase copied!");
  }, [recoveryPhrase]);

  const handleSuccessDone = useCallback(() => {
    handleOpenChange(false);
    onSuccess?.();
  }, [handleOpenChange, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        {view === "claim" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="size-5" />
                Claim a Username
              </DialogTitle>
              <DialogDescription>
                Your game tracking data stays on this device. Claiming a username lets your reviews
                appear on game pages for other PAX attendees to see.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Input
                placeholder="Choose a username"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
                }
                maxLength={20}
                onKeyDown={(e) =>
                  e.key === "Enter" && !submitting && username.length >= 3 && handleClaim()
                }
              />
              <p className="text-xs text-muted-foreground">
                3–20 characters — letters, numbers, underscores, and hyphens.
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                onClick={handleClaim}
                disabled={submitting || username.length < 3}
                className="w-full"
              >
                {submitting ? "Claiming…" : "Claim Username"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setView("recover");
                  setError(null);
                }}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Already have an account? Recover it
              </button>
            </DialogFooter>
          </>
        )}

        {view === "recover" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="size-5" />
                Recover Your Account
              </DialogTitle>
              <DialogDescription>
                Enter the 4-word recovery phrase you saved when you created your account.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Input
                placeholder="e.g. wizard-loot-cosmic-arcade"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value.toLowerCase())}
                onKeyDown={(e) =>
                  e.key === "Enter" && !submitting && phrase.length > 5 && handleRecover()
                }
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                onClick={handleRecover}
                disabled={submitting || phrase.length < 5}
                className="w-full"
              >
                {submitting ? "Looking up…" : "Recover Account"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setView("claim");
                  setError(null);
                }}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Back to claim a new username
              </button>
            </DialogFooter>
          </>
        )}

        {view === "success" && (
          <>
            <DialogHeader>
              <DialogTitle>You're all set!</DialogTitle>
              <DialogDescription>
                Save your recovery phrase somewhere safe — it's the only way to recover your account
                if you clear your browser data.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-950/40">
              <p className="mb-2 text-xs font-medium text-yellow-800 dark:text-yellow-200">
                Your recovery phrase:
              </p>
              <p className="font-mono text-lg font-bold tracking-wide text-yellow-900 dark:text-yellow-100">
                {recoveryPhrase}
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={handleCopyPhrase}>
                <Copy className="mr-1.5 size-3.5" />
                Copy phrase
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Screenshot this or write it down. Your reviews will now appear publicly on game pages.
            </p>

            <DialogFooter>
              <Button onClick={handleSuccessDone} className="w-full">
                Got it, let's go!
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
