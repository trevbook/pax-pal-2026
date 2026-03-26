import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PAX Pal 2026",
    short_name: "PAX Pal",
    description:
      "Your PAX East 2026 companion — discover games, track your favorites, and navigate the expo hall.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
