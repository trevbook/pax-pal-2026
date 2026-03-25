"use client";

import { Loader2 } from "lucide-react";
import { GameCard } from "@/components/game-card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { GameCardData } from "@/lib/game-card-data";

export function BoothSheet({
  boothId,
  games,
  loading,
  open,
  onOpenChange,
}: {
  boothId: string | null;
  games: GameCardData[];
  loading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[70vh]">
        <DrawerHeader>
          <DrawerTitle>{boothId ? `Booth ${boothId}` : "Booth"}</DrawerTitle>
          <DrawerDescription>
            {loading
              ? "Loading games..."
              : `${games.length} game${games.length !== 1 ? "s" : ""} at this booth`}
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : games.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No games found at this booth.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {games.map((game) => (
                <GameCard key={game.id} game={game} compact />
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
