"use client";

import { MapViewer } from "@/components/map/map-viewer";
import type { BoothMap } from "@/components/map/types";
import boothsData from "@/lib/data/booths.json";

const booths = boothsData as unknown as BoothMap;

export function BoothMapClient({ boothId }: { boothId: string }) {
  return <MapViewer booths={booths} highlightBooths={[boothId]} />;
}
