import type { Metadata } from "next";
import { SearchPage } from "@/components/search-page";

export const metadata: Metadata = {
  title: "Search — PAX Pal 2026",
  description: "Search PAX East 2026 games using text or natural language queries.",
};

export default function Page() {
  return <SearchPage />;
}
