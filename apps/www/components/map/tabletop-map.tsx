"use client";

import { Info } from "lucide-react";
import { useEffect, useRef } from "react";
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";

const TABLETOP_WIDTH = 4150;
const TABLETOP_HEIGHT = 4000;

export function TabletopMap() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex size-full flex-col">
      <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0" />
        <span>
          Tabletop hall reference map — tap a game&apos;s &quot;Find on Map&quot; link for booth
          locations.
        </span>
      </div>

      <div ref={containerRef} className="flex-1">
        <TransformWrapper
          initialScale={0.1}
          minScale={0.05}
          maxScale={4}
          centerOnInit
          limitToBounds={false}
        >
          <FitToHeight containerRef={containerRef} />
          <TransformComponent wrapperStyle={{ maxWidth: "100%", maxHeight: "100%" }}>
            {/* biome-ignore lint/a11y/useAltText: reference map image */}
            {/* biome-ignore lint/performance/noImgElement: next/image incompatible with zoom pan pinch */}
            <img
              src="/images/tabletop-map.jpg"
              width={TABLETOP_WIDTH}
              height={TABLETOP_HEIGHT}
              draggable={false}
              className="block"
            />
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  );
}

function FitToHeight({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const { setTransform } = useControls();
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const container = containerRef.current;
    if (!container) return;

    const containerHeight = container.clientHeight;
    const containerWidth = container.clientWidth;

    const scale = containerHeight / TABLETOP_HEIGHT;
    const scaledWidth = TABLETOP_WIDTH * scale;
    const offsetX = (containerWidth - scaledWidth) / 2;

    requestAnimationFrame(() => {
      setTransform(offsetX, 0, scale, 0);
    });
  }, [containerRef, setTransform]);

  return null;
}
