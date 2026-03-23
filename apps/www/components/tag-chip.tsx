import { cn } from "@/lib/utils";

export function TagChip({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
