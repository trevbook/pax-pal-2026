import type { Metadata } from "next";
import { MyGames } from "@/components/my-games";

export const metadata: Metadata = {
  title: "My Games — PAX Pal 2026",
  description: "Your personal game tracking hub — watchlist, played games, and ratings.",
};

export default function MyGamesPage() {
  return <MyGames />;
}
