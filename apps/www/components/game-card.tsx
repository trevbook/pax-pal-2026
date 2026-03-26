import Link from "next/link";
import { formatBoothDisplay } from "@/lib/format-booth";
import type { GameCardData } from "@/lib/game-card-data";
import { cn } from "@/lib/utils";
import { GameImage } from "./game-image";
import { TagChip } from "./tag-chip";

// ---------------------------------------------------------------------------
// Tag chip priority: genres → mechanics → business tags → audience tags
// (style tags skipped on cards per spec)
// ---------------------------------------------------------------------------

const BUSINESS_SET = new Set(["Free-to-Play", "Early Access Demo", "Indie", "Retail"]);
const AUDIENCE_SET = new Set([
  "Family-Friendly",
  "Single-Player",
  "Multiplayer",
  "Co-op",
  "PAX Together",
  "Competitive",
  "Local Multiplayer",
  "Online Multiplayer",
]);

function getTopChips(game: GameCardData, max = 3): string[] {
  const chips: string[] = [];

  // 1. Genres (video game or tabletop)
  for (const g of game.genres ?? []) {
    if (chips.length >= max) return chips;
    chips.push(g);
  }
  for (const g of game.tabletopGenres ?? []) {
    if (chips.length >= max) return chips;
    chips.push(g);
  }

  // 2. Mechanics
  for (const m of game.mechanics ?? []) {
    if (chips.length >= max) return chips;
    chips.push(m);
  }

  // 3. Business tags from the mixed `tags` array
  for (const t of game.tags) {
    if (chips.length >= max) return chips;
    if (BUSINESS_SET.has(t) && !chips.includes(t)) chips.push(t);
  }

  // 4. Audience tags from the mixed `tags` array
  for (const t of game.tags) {
    if (chips.length >= max) return chips;
    if (AUDIENCE_SET.has(t) && !chips.includes(t)) chips.push(t);
  }

  return chips;
}

// ---------------------------------------------------------------------------
// GameCard variants
// ---------------------------------------------------------------------------

type GameCardVariant = "default" | "compact" | "mobile";

export function GameCard({
  game,
  compact = false,
  variant,
  className,
}: {
  game: GameCardData;
  /** @deprecated Use `variant="compact"` instead. */
  compact?: boolean;
  variant?: GameCardVariant;
  className?: string;
}) {
  const resolved = variant ?? (compact ? "compact" : "default");
  const booth = formatBoothDisplay(game.boothId);
  const chips = getTopChips(game);
  const isUnconfirmed = !game.confirmed;

  // ---- Compact: minimal horizontal row (booth sheet) ----
  if (resolved === "compact") {
    return (
      <Link
        href={`/games/${game.slug}`}
        className={cn(
          "group flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50",
          isUnconfirmed && "border-dashed border-muted-foreground/30",
          className,
        )}
      >
        <div className="relative size-16 shrink-0 overflow-hidden rounded-md">
          <GameImage src={game.imageUrl} alt={game.name} type={game.type} className="rounded-md" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <h3 className="truncate text-sm font-semibold leading-tight">{game.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {game.exhibitor}
            {booth ? ` · ${booth.label}` : ""}
          </p>
        </div>
      </Link>
    );
  }

  // ---- Mobile: horizontal row with tags (space-efficient for lists) ----
  if (resolved === "mobile") {
    return (
      <Link
        href={`/games/${game.slug}`}
        className={cn(
          "group flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50",
          isUnconfirmed && "border-dashed border-muted-foreground/30",
          className,
        )}
      >
        {/* Thumbnail */}
        <div className="relative size-20 shrink-0 overflow-hidden rounded-md">
          <GameImage src={game.imageUrl} alt={game.name} type={game.type} className="rounded-md" />
          {isUnconfirmed && (
            <span className="absolute bottom-0.5 left-0.5 rounded bg-yellow-100/90 px-1 py-px text-[8px] font-medium text-yellow-800 dark:bg-yellow-900/70 dark:text-yellow-300">
              Unconfirmed
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <h3 className="truncate text-sm font-semibold leading-tight">{game.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {game.exhibitor}
            {booth ? ` · ${booth.label}` : ""}
          </p>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {chips.map((chip) => (
                <TagChip key={chip} label={chip} />
              ))}
            </div>
          )}
        </div>
      </Link>
    );
  }

  // ---- Default: full vertical card ----
  return (
    <Link
      href={`/games/${game.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:bg-accent/50",
        isUnconfirmed && "border-dashed border-muted-foreground/30",
        className,
      )}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        <GameImage src={game.imageUrl} alt={game.name} type={game.type} />

        {isUnconfirmed && (
          <span
            className="absolute bottom-2 left-2 rounded bg-yellow-100/90 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900/70 dark:text-yellow-300"
            title="This game hasn't been confirmed for PAX East 2026."
          >
            Unconfirmed
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="text-sm font-semibold leading-tight group-hover:underline">{game.name}</h3>

        <p className="text-xs text-muted-foreground">
          {game.exhibitor}
          {booth ? ` · ${booth.label}` : ""}
        </p>

        {game.summary && (
          <p className="line-clamp-2 text-xs text-muted-foreground/80">{game.summary}</p>
        )}

        {chips.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-1.5">
            {chips.map((chip) => (
              <TagChip key={chip} label={chip} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
