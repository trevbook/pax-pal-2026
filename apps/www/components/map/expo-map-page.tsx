"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import boothsData from "@/lib/data/booths.json";
import { type MapTab, MapToggle } from "./map-toggle";
import { MapViewer } from "./map-viewer";
import { TabletopMap } from "./tabletop-map";
import type { BoothMap } from "./types";

const booths = boothsData as unknown as BoothMap;

export function ExpoMapPage() {
  const searchParams = useSearchParams();

  // Determine initial tab from query params
  const tabParam = searchParams.get("tab");
  const boothsParam = searchParams.get("booths");
  const initialTab: MapTab = tabParam === "tabletop" ? "tabletop" : "expo";

  // Parse multi-booth highlight from query params
  const highlightBooths = boothsParam
    ? boothsParam
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean)
    : undefined;

  const [activeTab, setActiveTab] = useState<MapTab>(initialTab);

  return (
    <div className="flex h-[calc(100dvh-theme(spacing.12)-theme(spacing.14))] flex-col">
      {/* Sticky toggle bar */}
      <div className="shrink-0 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm">
        <MapToggle activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Map content */}
      <div className="relative min-h-0 flex-1">
        {activeTab === "expo" ? (
          <MapViewer booths={booths} highlightBooths={highlightBooths} />
        ) : (
          <TabletopMap />
        )}
      </div>
    </div>
  );
}
