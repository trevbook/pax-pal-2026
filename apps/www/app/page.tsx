import { Gamepad2, MapIcon, MessageCircle, Search, Star } from "lucide-react";
import Link from "next/link";
import { HomeProgress } from "@/components/home-progress";
import { RecommendedGames } from "@/components/recommended-games";
import { getAllActiveGames } from "@/lib/db";

const quickActions = [
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/chat", label: "Ask PAX Pal", icon: MessageCircle },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/my-games", label: "My Games", icon: Star },
];

export default async function HomePage() {
  const games = await getAllActiveGames();

  const exhibitors = new Set(games.map((g) => g.exhibitorId));
  const videoGameCount = games.filter((g) => g.type === "video_game" || g.type === "both").length;
  const tabletopCount = games.filter((g) => g.type === "tabletop" || g.type === "both").length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Hero */}
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">PAX Pal 2026</h1>
        <p className="mt-1.5 text-muted-foreground">
          Your PAX East companion — discover, track, and share.
        </p>

        {/* Search bar CTA */}
        <Link
          href="/search"
          className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50"
        >
          <Search className="size-4 shrink-0" />
          <span>Search games by name or vibe...</span>
        </Link>
      </section>

      {/* Quick actions */}
      <section className="mt-6 grid grid-cols-4 gap-2">
        {quickActions.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card py-3 text-xs font-medium transition-colors hover:bg-accent/50"
          >
            <Icon className="size-5 text-muted-foreground" />
            {label}
          </Link>
        ))}
      </section>

      {/* Progress / CTA */}
      <section className="mt-6">
        <HomeProgress />
      </section>

      {/* Recommended for you */}
      <RecommendedGames />

      {/* Quick stats */}
      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">PAX East 2026</h2>
        <p className="mt-1 text-sm text-muted-foreground">March 26–29, Boston Convention Center</p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold">{games.length}</p>
            <p className="text-[10px] text-muted-foreground">Games</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{exhibitors.size}</p>
            <p className="text-[10px] text-muted-foreground">Exhibitors</p>
          </div>
          <div>
            <p className="text-2xl font-bold">4</p>
            <p className="text-[10px] text-muted-foreground">Days</p>
          </div>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span>{videoGameCount} video games</span>
          <span>{tabletopCount} tabletop games</span>
        </div>
      </section>

      {/* Info blurb */}
      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">What is PAX Pal?</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          PAX Pal helps you discover games at PAX East 2026. Browse the full catalogue, search by
          vibe with AI-powered recommendations, and track your watchlist as you explore the expo
          hall.
        </p>
        <Link
          href="/about"
          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
        >
          Learn more &rarr;
        </Link>
      </section>
    </div>
  );
}
