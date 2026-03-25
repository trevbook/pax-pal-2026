"use client";

import type { BBox } from "./types";

const PADDING = 4;

/**
 * SVG overlay that renders transparent tap targets for each booth bounding box.
 * Must be rendered inside an SVG with viewBox matching the map image dimensions.
 */
export function BoothOverlay({
  booths,
  highlightedBooths,
  onBoothTap,
}: {
  booths: Record<string, BBox>;
  highlightedBooths?: Set<string>;
  onBoothTap?: (boothId: string) => void;
}) {
  return (
    <g>
      {Object.entries(booths).map(([boothId, bbox]) => {
        const [x1, y1, x2, y2] = bbox;
        const isHighlighted = highlightedBooths?.has(boothId);

        return (
          // biome-ignore lint/a11y/useSemanticElements: SVG rect used as tap target — no semantic HTML equivalent inside SVG
          <rect
            key={boothId}
            role="button"
            tabIndex={0}
            x={x1 - PADDING}
            y={y1 - PADDING}
            width={x2 - x1 + PADDING * 2}
            height={y2 - y1 + PADDING * 2}
            rx={3}
            className={
              isHighlighted
                ? "fill-fuchsia-500/30 stroke-fuchsia-500 stroke-[3] cursor-pointer"
                : "fill-transparent stroke-transparent hover:fill-primary/15 hover:stroke-primary/50 hover:stroke-[2] cursor-pointer"
            }
            onClick={(e) => {
              e.stopPropagation();
              onBoothTap?.(boothId);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onBoothTap?.(boothId);
              }
            }}
          >
            <title>Booth {boothId}</title>
          </rect>
        );
      })}
    </g>
  );
}

/**
 * Highlight overlay for a specific booth — magenta circle + red dot + pulsing animation.
 */
export function BoothHighlight({ boothId, bbox }: { boothId: string; bbox: BBox }) {
  const [x1, y1, x2, y2] = bbox;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  return (
    <g>
      {/* Pulsing magenta circle */}
      <circle cx={cx} cy={cy} r={90} className="fill-fuchsia-500/20 stroke-fuchsia-500 stroke-[3]">
        <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Solid red dot at center */}
      <circle cx={cx} cy={cy} r={6} className="fill-red-500" />

      <title>Booth {boothId}</title>
    </g>
  );
}
