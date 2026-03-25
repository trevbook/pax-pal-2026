import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { BoothMap } from "@/components/map/types";
import boothsData from "@/lib/data/booths.json";
import { getGamesByBooth } from "@/lib/db";
import { formatBoothDisplay } from "@/lib/format-booth";
import { BoothMapClient } from "./client";

const booths = boothsData as unknown as BoothMap;

export default async function BoothDetailPage({
  params,
}: {
  params: Promise<{ boothId: string }>;
}) {
  const { boothId } = await params;
  const decoded = decodeURIComponent(boothId);
  const bbox = booths[decoded];

  // If booth starts with TT or is "Tabletop Hall", redirect to tabletop tab
  if (decoded.startsWith("TT") || decoded === "Tabletop Hall") {
    redirect("/map?tab=tabletop");
  }

  // Fetch games at this booth
  const games = await getGamesByBooth(decoded);
  const exhibitorName = games.length > 0 ? games[0].exhibitor : null;
  const boothDisplay = formatBoothDisplay(decoded);

  return (
    <div className="flex h-[calc(100dvh-theme(spacing.12)-theme(spacing.14))] flex-col">
      {/* Info bar */}
      <div className="shrink-0 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/map"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Back to full map"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0 text-fuchsia-500" />
              <h1 className="truncate text-sm font-semibold">
                {boothDisplay?.label ?? `Booth ${decoded}`}
                {exhibitorName ? ` — ${exhibitorName}` : ""}
              </h1>
            </div>

            {games.length > 0 && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {games.length} game{games.length !== 1 ? "s" : ""}
                {games.length <= 3 ? `: ${games.map((g) => g.name).join(", ")}` : " at this booth"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Map viewer */}
      <div className="relative min-h-0 flex-1">
        {bbox ? (
          <BoothMapClient boothId={decoded} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <MapPin className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Booth location not available on map — it may be in an unmapped area.
            </p>
            <Link href="/map" className="text-sm text-primary underline hover:no-underline">
              View full map
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
