"use client";

import { ArrowLeft, ArrowRight, Play, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

/** Determine if a URL points to a video (YouTube, Steam movie, etc.) */
function isVideoUrl(url: string): boolean {
  return (
    url.includes("youtube.com") ||
    url.includes("youtu.be") ||
    url.includes(".mp4") ||
    url.includes(".webm") ||
    url.includes("/movie/") // Steam movie CDN pattern
  );
}

/** Convert a YouTube URL to an embed URL */
function toYouTubeEmbed(url: string): string | null {
  let videoId: string | null = null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      videoId = u.pathname.slice(1);
    } else if (u.hostname.includes("youtube.com")) {
      videoId = u.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

function Lightbox({
  urls,
  initialIndex,
  onClose,
}: {
  urls: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (api) api.scrollTo(initialIndex, true);
  }, [api, initialIndex]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap() + 1);
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") api?.scrollPrev();
      if (e.key === "ArrowRight") api?.scrollNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, api]);

  // Lock scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex cursor-zoom-out flex-col items-center justify-center bg-black/80"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Expanded media"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
        aria-label="Close"
      >
        <X className="size-5" />
      </button>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation prevents backdrop close */}
      <div
        className="flex w-full max-w-[90vw] cursor-default flex-col items-center"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Carousel setApi={setApi} className="w-full">
          <CarouselContent>
            {urls.map((url) => (
              <CarouselItem key={url} className="flex items-center justify-center">
                {isVideoUrl(url) ? (
                  <LightboxVideo url={url} />
                ) : (
                  // biome-ignore lint/performance/noImgElement: raw img for lightbox display
                  <img
                    src={url}
                    alt="Game media"
                    className="max-h-[85vh] w-auto max-w-full rounded-lg object-contain"
                    draggable={false}
                  />
                )}
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {urls.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-4 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 disabled:opacity-30"
              onClick={() => api?.scrollPrev()}
              disabled={!api?.canScrollPrev()}
              aria-label="Previous"
            >
              <ArrowLeft className="size-5" />
            </button>
            <button
              type="button"
              className="absolute right-4 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 disabled:opacity-30"
              onClick={() => api?.scrollNext()}
              disabled={!api?.canScrollNext()}
              aria-label="Next"
            >
              <ArrowRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {urls.length > 1 && (
        <span className="mt-3 text-xs font-medium text-white/70">
          {current} / {urls.length}
        </span>
      )}
    </div>,
    document.body,
  );
}

function LightboxVideo({ url }: { url: string }) {
  const embed = toYouTubeEmbed(url);
  if (embed) {
    return (
      <iframe
        src={embed}
        title="Game trailer"
        className="aspect-video w-full max-w-3xl rounded-lg"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  // Direct video file
  return (
    // biome-ignore lint/a11y/useMediaCaption: game trailer without captions
    <video
      src={url}
      controls
      preload="metadata"
      className="max-h-[85vh] w-auto max-w-full rounded-lg"
    />
  );
}

// ---------------------------------------------------------------------------
// Thumbnail
// ---------------------------------------------------------------------------

function Thumbnail({
  url,
  index,
  onClick,
}: {
  url: string;
  index: number;
  onClick: (index: number) => void;
}) {
  const video = isVideoUrl(url);

  return (
    <button
      type="button"
      className="relative block w-full cursor-zoom-in overflow-hidden rounded-md"
      onClick={() => onClick(index)}
      aria-label={video ? `Play video ${index + 1}` : `View image ${index + 1}`}
    >
      {video ? (
        <div className="flex aspect-video items-center justify-center bg-muted">
          <Play className="size-8 text-muted-foreground" />
        </div>
      ) : (
        <div className="relative aspect-video">
          <Image
            src={url}
            alt={`Screenshot ${index + 1}`}
            fill
            sizes="(max-width: 640px) 45vw, 200px"
            className="object-cover"
            loading="lazy"
          />
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// MediaGallery (exported)
// ---------------------------------------------------------------------------

export function MediaGallery({ urls }: { urls: string[] }) {
  const [lightbox, setLightbox] = useState<{ index: number } | null>(null);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(1);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap() + 1);
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  const openLightbox = useCallback((index: number) => {
    setLightbox({ index });
  }, []);

  if (urls.length === 0) return null;

  return (
    <>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Media
        </h3>
        <Carousel setApi={setApi} opts={{ loop: true, align: "start" }} className="w-full">
          <CarouselContent className="-ml-2">
            {urls.map((url, i) => (
              <CarouselItem key={url} className="basis-1/2 pl-2 sm:basis-1/3">
                <Thumbnail url={url} index={i} onClick={openLightbox} />
              </CarouselItem>
            ))}
          </CarouselContent>
          {urls.length > 2 && (
            <>
              <CarouselPrevious className="absolute -left-3 top-1/2 z-10 size-8 -translate-y-1/2 border-none bg-background/80 shadow-sm backdrop-blur-sm disabled:opacity-30" />
              <CarouselNext className="absolute -right-3 top-1/2 z-10 size-8 -translate-y-1/2 border-none bg-background/80 shadow-sm backdrop-blur-sm disabled:opacity-30" />
            </>
          )}
        </Carousel>
        {urls.length > 1 && (
          <p className="mt-1.5 text-center text-xs text-muted-foreground">
            {current} / {urls.length}
          </p>
        )}
      </div>

      {lightbox && (
        <Lightbox urls={urls} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
