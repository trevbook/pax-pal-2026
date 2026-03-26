import {
  AlertTriangle,
  Clock,
  ExternalLink,
  Globe,
  MapPin,
  Monitor,
  Smartphone,
  Users,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getReviewsForGame } from "@/app/actions/social";
import { GameCard } from "@/components/game-card";
import { GameDetailClient } from "@/components/game-detail-client";
import { GameImage } from "@/components/game-image";
import { MediaGallery } from "@/components/media-gallery";
import { PressLinks } from "@/components/press-links";
import { TagChip } from "@/components/tag-chip";
import { TypeBadge } from "@/components/type-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getAllActiveGames, getGameBySlug } from "@/lib/db";
import { formatBoothDisplay } from "@/lib/format-booth";
import { isConfirmed } from "@/lib/game-card-data";

// SSG: generate all game slugs at build time
export async function generateStaticParams() {
  const games = await getAllActiveGames();
  return games.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return { title: "Game Not Found — PAX Pal 2026" };
  return {
    title: `${game.name} — PAX Pal 2026`,
    description: game.summary || `${game.name} at PAX East 2026`,
  };
}

// Platform icon mapping
const PLATFORM_ICONS: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  PC: { icon: Monitor, label: "PC" },
  PlayStation: { icon: Zap, label: "PlayStation" },
  Xbox: { icon: Zap, label: "Xbox" },
  Switch: { icon: Zap, label: "Switch" },
  Mobile: { icon: Smartphone, label: "Mobile" },
  VR: { icon: Globe, label: "VR" },
};

export default async function GameDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const booth = formatBoothDisplay(game.boothId);
  const confirmed = isConfirmed(game.discoverySource, game.discoveryMeta?.inclusionTier);

  // Fetch sibling games from same exhibitor (reuse getAllActiveGames to avoid extra scan)
  const allGames = await getAllActiveGames();
  const otherGames = allGames.filter((g) => g.exhibitorId === game.exhibitorId && g.id !== game.id);

  // Fetch reviews for this game
  const reviews = await getReviewsForGame(slug);

  // Resolve similar games from pre-computed IDs (exclude self + exhibitor siblings as safety net)
  const gameById = new Map(allGames.map((g) => [g.id, g]));
  const similarGames = (game.similarGameIds ?? [])
    .map((id) => gameById.get(id))
    .filter(
      (g): g is NonNullable<typeof g> =>
        g != null && g.id !== game.id && g.exhibitorId !== game.exhibitorId,
    );

  // Build the Find on Map href
  let mapHref: string | null = null;
  if (game.boothId && game.boothId !== "UNSPECIFIED") {
    const boothDisplay = formatBoothDisplay(game.boothId);
    mapHref = boothDisplay?.href ?? null;
  }

  // BGG link
  const bggUrl = game.bggId ? `https://boardgamegeek.com/boardgame/${game.bggId}` : null;

  return (
    <div className="pb-28">
      <div className="mx-auto max-w-2xl px-4">
        {/* Hero image */}
        <div className="relative mt-4 aspect-[16/9] w-full overflow-hidden rounded-lg bg-muted">
          <GameImage src={game.imageUrl} alt={game.name} type={game.type} sizes="672px" />
        </div>
        {/* Title block */}
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <h1 className="flex-1 text-2xl font-bold leading-tight">{game.name}</h1>
            <TypeBadge type={game.type} className="mt-1 shrink-0" />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <Link
              href={`/games?exhibitor=${encodeURIComponent(game.exhibitorId)}`}
              className="font-medium hover:underline"
            >
              {game.exhibitor}
            </Link>
            {booth && (
              <>
                <span>·</span>
                {booth.href ? (
                  <Link href={booth.href} className="hover:underline">
                    <MapPin className="mr-0.5 inline size-3.5" />
                    {booth.label}
                  </Link>
                ) : (
                  <span>
                    <MapPin className="mr-0.5 inline size-3.5" />
                    {booth.label}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Find on Map button */}
        {mapHref && (
          <Link href={mapHref} className="mt-4 block">
            <Button variant="secondary" className="w-full">
              <MapPin className="mr-2 size-4" />
              Find on Map
            </Button>
          </Link>
        )}

        {/* Unconfirmed alert banner */}
        {!confirmed && (
          <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 dark:border-yellow-700 dark:bg-yellow-950/40">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                This game hasn't been confirmed for PAX East 2026. We identified it through web
                searches based on {game.exhibitor}'s booth listing, but they haven't listed a
                playable demo on the PAX website.
              </p>
            </div>
          </div>
        )}

        {/* Description */}
        {game.description && (
          <div className="mt-6">
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
              {game.description}
            </p>
          </div>
        )}

        {/* Media gallery — client component, lazy-loaded images */}
        {game.mediaUrls && game.mediaUrls.length > 0 && (
          <div className="mt-6">
            <MediaGallery urls={game.mediaUrls} videoThumbnails={game.videoThumbnails} />
          </div>
        )}

        <Separator className="my-6" />

        {/* Metadata — type-dependent */}
        <div className="flex flex-col gap-4">
          {/* Video game metadata */}
          {(game.type === "video_game" || game.type === "both") && (
            <>
              {game.platforms && game.platforms.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Platforms
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {game.platforms.map((p) => {
                      const mapping = PLATFORM_ICONS[p];
                      const Icon = mapping?.icon ?? Monitor;
                      return (
                        <span
                          key={p}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs"
                        >
                          <Icon className="size-3.5" />
                          {mapping?.label ?? p}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {game.genres && game.genres.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Genres
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {game.genres.map((g) => (
                      <TagChip key={g} label={g} />
                    ))}
                  </div>
                </div>
              )}

              {game.releaseStatus && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Release Status
                  </h3>
                  <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs capitalize">
                    {game.releaseStatus.replace(/_/g, " ")}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Tabletop metadata */}
          {(game.type === "tabletop" || game.type === "both") && (
            <>
              <div className="flex flex-wrap gap-4">
                {game.playerCount && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Users className="size-4 text-muted-foreground" />
                    <span>{game.playerCount} players</span>
                  </div>
                )}
                {game.playTime && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Clock className="size-4 text-muted-foreground" />
                    <span>{game.playTime}</span>
                  </div>
                )}
                {game.complexity != null && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-muted-foreground">Complexity:</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3].map((level) => (
                        <span
                          key={level}
                          className={`size-2.5 rounded-full ${
                            game.complexity != null && level <= game.complexity
                              ? "bg-foreground"
                              : "bg-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {game.mechanics && game.mechanics.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Mechanics
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {game.mechanics.map((m) => (
                      <TagChip key={m} label={m} />
                    ))}
                  </div>
                </div>
              )}

              {game.tabletopGenres && game.tabletopGenres.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Tabletop Genres
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {game.tabletopGenres.map((g) => (
                      <TagChip key={g} label={g} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* External links */}
        {(game.steamUrl ||
          bggUrl ||
          game.showroomUrl ||
          game.socialLinks?.twitter ||
          game.socialLinks?.discord ||
          game.socialLinks?.youtube ||
          game.socialLinks?.itchIo) && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Links
            </h3>
            <div className="flex flex-wrap gap-2">
              {game.steamUrl && (
                <a
                  href={game.steamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  Steam
                  <ExternalLink className="size-3" />
                </a>
              )}
              {bggUrl && (
                <a
                  href={bggUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  BoardGameGeek
                  <ExternalLink className="size-3" />
                </a>
              )}
              {game.showroomUrl && (
                <a
                  href={game.showroomUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  PAX Showroom
                  <ExternalLink className="size-3" />
                </a>
              )}
              {game.socialLinks?.twitter && (
                <a
                  href={game.socialLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  Twitter
                  <ExternalLink className="size-3" />
                </a>
              )}
              {game.socialLinks?.discord && (
                <a
                  href={game.socialLinks.discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  Discord
                  <ExternalLink className="size-3" />
                </a>
              )}
              {game.socialLinks?.youtube && (
                <a
                  href={game.socialLinks.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  YouTube
                  <ExternalLink className="size-3" />
                </a>
              )}
              {game.socialLinks?.itchIo && (
                <a
                  href={game.socialLinks.itchIo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  itch.io
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Press & coverage */}
        {game.pressLinks && game.pressLinks.length > 0 && (
          <div className="mt-4">
            <PressLinks links={game.pressLinks} />
          </div>
        )}

        {/* Full tag list — hidden for now, revisit later
        {game.tags.length > 0 && (
          <>
            <Separator className="my-6" />
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {game.tags.map((tag) => (
                  <TagChip key={tag} label={tag} />
                ))}
              </div>
            </div>
          </>
        )}
        */}

        {/* Other games by this exhibitor — show up to 3 */}
        {otherGames.length > 0 && (
          <>
            <Separator className="my-6" />
            <div>
              <Link
                href={`/games?exhibitor=${encodeURIComponent(game.exhibitorId)}`}
                className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground hover:underline"
              >
                More from {game.exhibitor} →
              </Link>
              <div className="flex flex-col gap-2">
                {otherGames.slice(0, 3).map((g) => (
                  <GameCard key={g.id} game={g} compact />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Similar games — pre-computed from embedding cosine similarity */}
        {similarGames.length > 0 && (
          <>
            <Separator className="my-6" />
            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Similar Games</h3>
              <div className="flex flex-col gap-2">
                {similarGames.map((g) => (
                  <GameCard key={g.id} game={g} compact />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Client interactive elements — action bar + report + reviews */}
        <Separator className="my-6" />
        <GameDetailClient
          game={{
            id: game.id,
            name: game.name,
            slug: game.slug,
            imageUrl: game.imageUrl,
            boothId: game.boothId,
            type: game.type,
            exhibitor: game.exhibitor,
          }}
          initialReviews={reviews}
        />
      </div>
    </div>
  );
}
