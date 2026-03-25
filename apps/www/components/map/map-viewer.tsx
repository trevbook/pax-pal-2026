"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";
import type { GameCardData } from "@/lib/game-card-data";
import { BoothHighlight, BoothOverlay } from "./booth-overlay";
import { BoothSheet } from "./booth-sheet";
import type { BoothMap } from "./types";

/** Natural dimensions of the expo hall map image. */
const MAP_WIDTH = 3400;
const MAP_HEIGHT = 4400;

interface MapViewerProps {
  booths: BoothMap;
  /** Booth IDs to highlight (for /map/[boothId] and ?booths= routes). */
  highlightBooths?: string[];
}

export function MapViewer({ booths, highlightBooths }: MapViewerProps) {
  const [selectedBooth, setSelectedBooth] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetGames, setSheetGames] = useState<GameCardData[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightSet = highlightBooths ? new Set(highlightBooths) : undefined;

  // Cache booth query results in memory
  const cacheRef = useRef<Map<string, GameCardData[]>>(new Map());

  const handleBoothTap = useCallback(async (boothId: string) => {
    setSelectedBooth(boothId);
    setSheetOpen(true);

    // Check cache
    const cached = cacheRef.current.get(boothId);
    if (cached) {
      setSheetGames(cached);
      return;
    }

    setSheetLoading(true);
    try {
      const res = await fetch(`/api/map/booth?id=${encodeURIComponent(boothId)}`);
      if (res.ok) {
        const games = (await res.json()) as GameCardData[];
        cacheRef.current.set(boothId, games);
        setSheetGames(games);
      } else {
        setSheetGames([]);
      }
    } catch {
      setSheetGames([]);
    } finally {
      setSheetLoading(false);
    }
  }, []);

  return (
    <div ref={containerRef} className="size-full">
      <TransformWrapper
        initialScale={0.1}
        minScale={0.05}
        maxScale={4}
        centerOnInit
        limitToBounds={false}
        panning={{ velocityDisabled: false }}
      >
        <FitMapOnMount containerRef={containerRef} />
        <TransformComponent wrapperStyle={{ maxWidth: "100%", maxHeight: "100%" }}>
          <div className="relative" style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}>
            {/* Map image — raw img required for exact pixel sizing inside zoom wrapper */}
            {/* biome-ignore lint/a11y/useAltText: map image is decorative, booths have titles */}
            {/* biome-ignore lint/performance/noImgElement: next/image incompatible with zoom pan pinch */}
            <img
              src="/images/expo-hall-map.jpg"
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              draggable={false}
              className="block"
            />

            {/* SVG overlay */}
            <svg
              viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
              className="absolute inset-0 size-full"
              style={{ pointerEvents: "none" }}
              aria-label="Booth overlay"
            >
              <g style={{ pointerEvents: "auto" }}>
                <BoothOverlay
                  booths={booths}
                  highlightedBooths={highlightSet}
                  onBoothTap={handleBoothTap}
                />
              </g>

              {/* Highlight markers for focused booths */}
              {highlightBooths?.map((id) => {
                const bbox = booths[id];
                if (!bbox) return null;
                return <BoothHighlight key={id} boothId={id} bbox={bbox} />;
              })}
            </svg>
          </div>
        </TransformComponent>
      </TransformWrapper>

      <BoothSheet
        boothId={selectedBooth}
        games={sheetGames}
        loading={sheetLoading}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}

/**
 * Inner component that fits the map to the viewport height on mount.
 * Must be inside TransformWrapper to access controls.
 */
function FitMapOnMount({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const { setTransform } = useControls();
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const container = containerRef.current;
    if (!container) return;

    const containerHeight = container.clientHeight;
    const containerWidth = container.clientWidth;

    const scale = containerHeight / MAP_HEIGHT;
    const scaledWidth = MAP_WIDTH * scale;
    const offsetX = (containerWidth - scaledWidth) / 2;

    requestAnimationFrame(() => {
      setTransform(offsetX, 0, scale, 0);
    });
  }, [containerRef, setTransform]);

  return null;
}
