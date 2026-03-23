"use client";

import { Flag } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { ReportType } from "@/app/games/[slug]/actions";
import { submitReport } from "@/app/games/[slug]/actions";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Textarea } from "./ui/textarea";

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "not_at_pax", label: "This game isn't at PAX" },
  { value: "wrong_booth", label: "Wrong booth location" },
  { value: "wrong_info", label: "Wrong game name/info" },
  { value: "duplicate", label: "This is a duplicate" },
  { value: "other", label: "Other" },
];

interface ReportModalProps {
  gameId: string;
  gameName: string;
  hasReported: boolean;
  onReported: () => void;
}

export function ReportModal({ gameId, gameName, hasReported, onReported }: ReportModalProps) {
  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!reportType) return;
    if (reportType === "other" && !description.trim()) return;

    setSubmitting(true);
    try {
      await submitReport({
        gameId,
        gameName,
        reportType,
        description: description.trim() || null,
      });
      onReported();
      setOpen(false);
      setReportType(null);
      setDescription("");
      toast.success("Thanks! We'll look into it.");
    } catch {
      toast.error("Failed to submit report. It will be retried later.");
    } finally {
      setSubmitting(false);
    }
  }, [reportType, description, gameId, gameName, onReported]);

  if (hasReported) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        <Flag className="mr-1 inline size-3.5" />
        You've already reported this game.
      </p>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Something wrong with the data? Report an issue
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>What's wrong with this game?</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {REPORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setReportType(opt.value)}
              className={`rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                reportType === opt.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {reportType && (
          <div className="mt-1">
            <label htmlFor="report-desc" className="text-sm font-medium text-muted-foreground">
              Details {reportType === "other" ? "(required)" : "(optional)"}
            </label>
            <Textarea
              id="report-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="Tell us more…"
              className="mt-1.5"
              rows={3}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {description.length}/500
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reportType || submitting || (reportType === "other" && !description.trim())}
          >
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
