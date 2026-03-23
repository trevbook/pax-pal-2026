"use client";

import type { GameType } from "@pax-pal/core";
import { Dice5, Gamepad2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

function Placeholder({ type, className }: { type: GameType; className?: string }) {
  const Icon = type === "tabletop" ? Dice5 : Gamepad2;
  return (
    <div className={cn("flex items-center justify-center bg-muted", className)}>
      <Icon className="size-10 text-muted-foreground/50" />
    </div>
  );
}

export function GameImage({
  src,
  alt,
  type,
  className,
  sizes,
}: {
  src: string | null;
  alt: string;
  type: GameType;
  className?: string;
  sizes?: string;
}) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return <Placeholder type={type} className={className} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes ?? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
      className={cn("object-cover", className)}
      onError={() => setError(true)}
    />
  );
}
