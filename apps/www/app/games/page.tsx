import type { Metadata } from "next";
import { GameCatalogue } from "@/components/game-catalogue";
import { getAllActiveGames } from "@/lib/db";

export const metadata: Metadata = {
  title: "Games — PAX Pal 2026",
  description: "Browse and filter all games at PAX East 2026.",
};

export const revalidate = 3600; // ISR: revalidate every 1 hour

export default async function GamesPage() {
  const games = await getAllActiveGames();

  return <GameCatalogue games={games} />;
}
