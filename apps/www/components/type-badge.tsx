import type { GameType } from "@pax-pal/core";
import { cn } from "@/lib/utils";

const config: Record<GameType, { label: string; className: string }> = {
  video_game: {
    label: "Video Game",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
  tabletop: {
    label: "Tabletop",
    className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  },
  both: {
    label: "Video + Tabletop",
    className:
      "bg-gradient-to-r from-blue-100 to-green-100 text-purple-800 dark:from-blue-900/40 dark:to-green-900/40 dark:text-purple-300",
  },
};

export function TypeBadge({ type, className }: { type: GameType; className?: string }) {
  const { label, className: variantClass } = config[type];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variantClass,
        className,
      )}
    >
      {label}
    </span>
  );
}
