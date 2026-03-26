"use client";

import { Info, Loader2, SlidersHorizontal, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRecommendedOrder } from "@/app/recommendations/actions";
import { semanticSearch } from "@/app/search/actions";
import { useTrackingList } from "@/hooks/use-tracking";
import type { GameCardData } from "@/lib/game-card-data";
import { compareBoothId } from "@/lib/sort-booth";
import { cn } from "@/lib/utils";
import { GameCard } from "./game-card";
import { Button } from "./ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./ui/drawer";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GameTab = "video_game" | "tabletop";
type SortOption = "name" | "booth" | "recommended";

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get games matching the active tab (type: "both" appears in both tabs). */
function filterByTab(games: GameCardData[], tab: GameTab): GameCardData[] {
  return games.filter((g) => g.type === tab || g.type === "both");
}

/** Derive distinct genre/mechanic values from the current tab's dataset. */
function getDistinctChips(games: GameCardData[], tab: GameTab): string[] {
  const set = new Set<string>();
  for (const g of games) {
    if (tab === "video_game") {
      for (const genre of g.genres ?? []) set.add(genre);
    } else {
      for (const mech of g.mechanics ?? []) set.add(mech);
    }
  }
  return Array.from(set).sort();
}

function matchesTextFilter(game: GameCardData, query: string): boolean {
  const q = query.toLowerCase();
  return game.name.toLowerCase().includes(q) || game.exhibitor.toLowerCase().includes(q);
}

function matchesChipFilter(game: GameCardData, chips: Set<string>, tab: GameTab): boolean {
  if (chips.size === 0) return true;
  const values = tab === "video_game" ? (game.genres ?? []) : (game.mechanics ?? []);
  return values.some((v) => chips.has(v));
}

function sortGames(
  games: GameCardData[],
  sort: SortOption,
  recommendedRank?: Map<string, number>,
): GameCardData[] {
  const copy = [...games];
  if (sort === "recommended" && recommendedRank && recommendedRank.size > 0) {
    const unranked = recommendedRank.size;
    copy.sort(
      (a, b) =>
        (recommendedRank.get(a.id) ?? unranked) - (recommendedRank.get(b.id) ?? unranked) ||
        a.name.localeCompare(b.name),
    );
  } else if (sort === "booth") {
    copy.sort((a, b) => compareBoothId(a.boothId, b.boothId));
  } else {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  }
  return copy;
}

// ---------------------------------------------------------------------------
// FilterChips — reused in desktop bar and mobile drawer
// ---------------------------------------------------------------------------

function FilterChips({
  available,
  selected,
  onToggle,
}: {
  available: string[];
  selected: Set<string>;
  onToggle: (chip: string) => void;
}) {
  if (available.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {available.map((chip) => {
        const isActive = selected.has(chip);
        return (
          <button
            key={chip}
            type="button"
            onClick={() => onToggle(chip)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortSelect
// ---------------------------------------------------------------------------

function SortSelect({
  value,
  onChange,
  hasTracked,
}: {
  value: SortOption;
  onChange: (v: SortOption) => void;
  hasTracked: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortOption)}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="name">Name (A–Z)</SelectItem>
        <SelectItem value="booth">Booth Number</SelectItem>
        <SelectItem value="recommended" disabled={!hasTracked}>
          Recommended
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// GameCatalogue
// ---------------------------------------------------------------------------

export function GameCatalogue({ games }: { games: GameCardData[] }) {
  const [tab, setTab] = useState<GameTab>("video_game");
  const [searchText, setSearchText] = useState("");
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortOption>("name");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [hideUnconfirmed, setHideUnconfirmed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Recommended sort state
  const tracking = useTrackingList();
  const playedIds = useMemo(() => Object.keys(tracking.played).sort(), [tracking.played]);
  const watchlistIds = useMemo(() => Object.keys(tracking.watchlist).sort(), [tracking.watchlist]);
  const hasTracked = playedIds.length > 0 || watchlistIds.length > 0;

  const [recommendedRank, setRecommendedRank] = useState<Map<string, number>>(new Map());
  const [recommendedLoading, setRecommendedLoading] = useState(false);
  const fetchedForRef = useRef<string>("");

  // Fetch recommended order when sort changes to "recommended"
  const idsKey = useMemo(
    () => `p:${playedIds.join(",")};w:${watchlistIds.join(",")}`,
    [playedIds, watchlistIds],
  );

  useEffect(() => {
    if (sort !== "recommended" || !hasTracked) return;

    if (fetchedForRef.current === idsKey && recommendedRank.size > 0) return;

    let cancelled = false;
    setRecommendedLoading(true);

    getRecommendedOrder({ played: playedIds, watchlist: watchlistIds }).then((orderedIds) => {
      if (cancelled) return;
      const rank = new Map<string, number>();
      for (let i = 0; i < orderedIds.length; i++) {
        rank.set(orderedIds[i], i);
      }
      setRecommendedRank(rank);
      setRecommendedLoading(false);
      fetchedForRef.current = idsKey;
    });

    return () => {
      cancelled = true;
    };
  }, [sort, idsKey, hasTracked, playedIds, watchlistIds, recommendedRank.size]);

  // Tab switch: reset chip filters and pagination, preserve search text (per spec)
  const handleTabChange = useCallback(
    (newTab: GameTab) => {
      if (newTab === tab) return;
      setTab(newTab);
      setSelectedChips(new Set());
      setVisibleCount(PAGE_SIZE);
    },
    [tab],
  );

  const toggleChip = useCallback((chip: string) => {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) {
        next.delete(chip);
      } else {
        next.add(chip);
      }
      return next;
    });
    setVisibleCount(PAGE_SIZE);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedChips(new Set());
    setSearchText("");
    setVisibleCount(PAGE_SIZE);
  }, []);

  // Semantic search state
  const [semanticScores, setSemanticScores] = useState<Map<string, number>>(new Map());
  const [semanticLoading, setSemanticLoading] = useState(false);
  const semanticAbortRef = useRef<string>("");

  // Debounced semantic search when search text changes
  useEffect(() => {
    const q = searchText.trim();
    if (!q || q.length < 3) {
      setSemanticScores(new Map());
      semanticAbortRef.current = "";
      return;
    }

    const token = q;
    setSemanticLoading(true);

    const timer = setTimeout(async () => {
      try {
        const typeFilter = tab === "video_game" ? "video_game" : "tabletop";
        const res = await semanticSearch(q, typeFilter);
        // Only apply if the query hasn't changed
        if (semanticAbortRef.current !== "" && semanticAbortRef.current !== token) return;
        const scores = new Map<string, number>();
        for (const r of res.results) {
          scores.set(r.game.id, r.score);
        }
        setSemanticScores(scores);
      } catch {
        // Silently fail — text search still works
      } finally {
        setSemanticLoading(false);
      }
    }, 400);

    semanticAbortRef.current = token;
    return () => clearTimeout(timer);
  }, [searchText, tab]);

  // Derived data
  const tabGames = useMemo(() => filterByTab(games, tab), [games, tab]);
  const availableChips = useMemo(() => getDistinctChips(tabGames, tab), [tabGames, tab]);

  const filteredGames = useMemo(() => {
    let result = tabGames;
    if (hideUnconfirmed) {
      result = result.filter((g) => g.confirmed);
    }
    if (selectedChips.size > 0) {
      result = result.filter((g) => matchesChipFilter(g, selectedChips, tab));
    }

    const q = searchText.trim();
    if (q) {
      // Combine local text matches with semantic results
      const textMatches = new Set(result.filter((g) => matchesTextFilter(g, q)).map((g) => g.id));
      const semanticMatches = semanticScores;
      // Include games that match text OR semantic search
      const matchedIds = new Set([...textMatches, ...semanticMatches.keys()]);
      result = result.filter((g) => matchedIds.has(g.id));

      // Score and sort by relevance when searching
      if (sort !== "recommended") {
        result.sort((a, b) => {
          const aText = textMatches.has(a.id) ? 0.3 : 0;
          const aSemantic = (semanticMatches.get(a.id) ?? 0) * 0.7;
          const bText = textMatches.has(b.id) ? 0.3 : 0;
          const bSemantic = (semanticMatches.get(b.id) ?? 0) * 0.7;
          return bText + bSemantic - (aText + aSemantic);
        });
        return result;
      }
    }

    return sortGames(result, sort, recommendedRank);
  }, [
    tabGames,
    hideUnconfirmed,
    searchText,
    selectedChips,
    sort,
    tab,
    recommendedRank,
    semanticScores,
  ]);

  const visibleGames = filteredGames.slice(0, visibleCount);
  const hasMore = visibleCount < filteredGames.length;
  const activeFilterCount = selectedChips.size + (hideUnconfirmed ? 1 : 0);
  const tabLabel = tab === "video_game" ? "video games" : "tabletop games";

  return (
    <div className="flex flex-col gap-0">
      {/* Type tabs — sticky below header */}
      <div className="sticky top-12 z-40 border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl">
          <button
            type="button"
            onClick={() => handleTabChange("video_game")}
            className={cn(
              "flex-1 py-3 text-center text-sm font-medium transition-colors",
              tab === "video_game"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Video Games
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("tabletop")}
            className={cn(
              "flex-1 py-3 text-center text-sm font-medium transition-colors",
              tab === "tabletop"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Tabletop
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 pt-4">
        {/* Desktop filter bar — hidden on mobile */}
        <div className="hidden gap-3 sm:flex sm:flex-col">
          <div className="flex items-center gap-3">
            <div className="relative max-w-xs">
              <Input
                placeholder={`Search ${tabLabel}…`}
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
              />
              {semanticLoading && (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            <SortSelect value={sort} onChange={setSort} hasTracked={hasTracked} />
            <div className="flex items-center gap-2">
              <Switch
                id="hide-unconfirmed-desktop"
                checked={hideUnconfirmed}
                onCheckedChange={setHideUnconfirmed}
              />
              <Label htmlFor="hide-unconfirmed-desktop" className="text-sm">
                Hide unconfirmed
              </Label>
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
                <X className="ml-1 size-3.5" />
              </Button>
            )}
          </div>
          <FilterChips available={availableChips} selected={selectedChips} onToggle={toggleChip} />
        </div>

        {/* Mobile filter bar — shown on small screens */}
        <div className="flex flex-col gap-2 sm:hidden">
          {/* Row 1: Sort + Filters button */}
          <div className="flex items-center gap-2">
            <SortSelect value={sort} onChange={setSort} hasTracked={hasTracked} />
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
              <DrawerTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  <SlidersHorizontal className="mr-1.5 size-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="ml-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Filters</DrawerTitle>
                </DrawerHeader>
                <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="hide-unconfirmed-mobile"
                      checked={hideUnconfirmed}
                      onCheckedChange={setHideUnconfirmed}
                    />
                    <Label htmlFor="hide-unconfirmed-mobile" className="text-sm font-medium">
                      Hide unconfirmed
                    </Label>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium">
                      {tab === "video_game" ? "Genres" : "Mechanics"}
                    </p>
                    <FilterChips
                      available={availableChips}
                      selected={selectedChips}
                      onToggle={toggleChip}
                    />
                  </div>
                </div>
                <DrawerFooter>
                  <div className="flex gap-2">
                    {activeFilterCount > 0 && (
                      <Button variant="outline" className="flex-1" onClick={clearFilters}>
                        Clear all
                      </Button>
                    )}
                    <DrawerClose asChild>
                      <Button className="flex-1">
                        Show {filteredGames.length} {tabLabel}
                      </Button>
                    </DrawerClose>
                  </div>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </div>
          {/* Row 2: Search */}
          <div className="relative">
            <Input
              placeholder={`Search ${tabLabel}…`}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
            />
            {semanticLoading && (
              <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Recommended sort info banner */}
        {sort === "recommended" && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {recommendedLoading
                ? "Computing recommendations from your watchlist…"
                : "Sorted by similarity to your watchlist and played games. Add more games to improve results."}
            </span>
          </div>
        )}

        {/* Results count */}
        <p className="mt-3 text-sm text-muted-foreground">
          Showing {filteredGames.length} {tabLabel}
        </p>

        {/* Game card grid */}
        {filteredGames.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p className="text-lg font-medium">No games found</p>
            <p className="mt-1 text-sm">Try adjusting your filters or search term.</p>
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleGames.map((game) => (
                <React.Fragment key={game.id}>
                  <GameCard game={game} variant="mobile" className="sm:hidden" />
                  <GameCard game={game} className="hidden sm:flex" />
                </React.Fragment>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center py-6">
                <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                  Load more ({filteredGames.length - visibleCount} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
