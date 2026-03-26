"use client";

import { Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { MatchType, SearchResult } from "@/app/search/actions";
import { semanticSearch, textSearch } from "@/app/search/actions";
import { cn } from "@/lib/utils";
import { GameCard } from "./game-card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TypeFilter = "all" | "video_game" | "tabletop";

const DEBOUNCE_MS = 300;

const PLACEHOLDER_QUERIES = [
  "cooperative card game for 2 players",
  "horror roguelike",
  "party game for large groups",
  "deck-building strategy",
];

const SUGGESTION_CHIPS = [
  "cooperative card game for 2 players",
  "horror roguelike",
  "party game for large groups",
  "deck-building strategy",
  "cozy farming sim",
  "dungeon crawler",
];

// ---------------------------------------------------------------------------
// Animated placeholder hook
// ---------------------------------------------------------------------------

function useAnimatedPlaceholder(queries: string[], intervalMs = 3500): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % queries.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [queries, intervalMs]);

  return queries[index];
}

// ---------------------------------------------------------------------------
// Hybrid merge: deduplicate + re-rank with 70/30 semantic/text weighting
// ---------------------------------------------------------------------------

function mergeResults(
  textResults: SearchResult[],
  semanticResults: SearchResult[],
): SearchResult[] {
  const merged = new Map<string, SearchResult>();

  // Add text results (30% weight)
  for (const r of textResults) {
    merged.set(r.game.id, { ...r, score: r.score * 0.3 });
  }

  // Add/merge semantic results (70% weight)
  for (const r of semanticResults) {
    const existing = merged.get(r.game.id);
    if (existing) {
      // Game found in both — boost score, keep best match type
      merged.set(r.game.id, {
        game: r.game,
        matchType: r.score * 0.7 >= existing.score ? r.matchType : existing.matchType,
        score: existing.score + r.score * 0.7,
      });
    } else {
      merged.set(r.game.id, { ...r, score: r.score * 0.7 });
    }
  }

  const results = Array.from(merged.values());
  results.sort((a, b) => b.score - a.score);
  return results;
}

// ---------------------------------------------------------------------------
// Match type badge
// ---------------------------------------------------------------------------

function MatchBadge({ type }: { type: MatchType }) {
  const labels: Record<MatchType, string> = {
    name: "Name match",
    description: "Description match",
    semantic: "Semantic match",
  };
  const colors: Record<MatchType, string> = {
    name: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    description: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    semantic: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  };

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", colors[type])}>
      {labels[type]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SearchPage
// ---------------------------------------------------------------------------

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [textResults, setTextResults] = useState<SearchResult[]>([]);
  const [semanticResults, setSemanticResults] = useState<SearchResult[]>([]);
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [isSemanticLoading, setIsSemanticLoading] = useState(false);
  const [semanticError, setSemanticError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(0); // Simple counter to abort stale requests

  const placeholder = useAnimatedPlaceholder(PLACEHOLDER_QUERIES);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ---------------------------------------------------------------------------
  // Search execution
  // ---------------------------------------------------------------------------

  const executeSearch = useCallback((q: string, type: TypeFilter) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setTextResults([]);
      setSemanticResults([]);
      setSemanticError(null);
      setHasSearched(false);
      return;
    }

    const requestId = ++abortRef.current;
    setHasSearched(true);

    // Text search (fast)
    setIsTextLoading(true);
    textSearch(trimmed, type).then((res) => {
      if (abortRef.current !== requestId) return; // stale
      setTextResults(res.results);
      setIsTextLoading(false);
    });

    // Semantic search (slow)
    setIsSemanticLoading(true);
    setSemanticError(null);
    semanticSearch(trimmed, type).then((res) => {
      if (abortRef.current !== requestId) return; // stale
      setSemanticResults(res.results);
      setSemanticError(res.error ?? null);
      setIsSemanticLoading(false);
    });
  }, []);

  // Debounced search on query change
  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        executeSearch(value, typeFilter);
      }, DEBOUNCE_MS);
    },
    [typeFilter, executeSearch],
  );

  // Immediate search on tab change (if query exists)
  const handleTypeChange = useCallback(
    (type: TypeFilter) => {
      setTypeFilter(type);
      if (query.trim()) {
        executeSearch(query, type);
      }
    },
    [query, executeSearch],
  );

  // Chip tap → fill input + search immediately
  const handleChipTap = useCallback(
    (chip: string) => {
      setQuery(chip);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      executeSearch(chip, typeFilter);
    },
    [typeFilter, executeSearch],
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    setTextResults([]);
    setSemanticResults([]);
    setSemanticError(null);
    setHasSearched(false);
    inputRef.current?.focus();
  }, []);

  // ---------------------------------------------------------------------------
  // Merged results
  // ---------------------------------------------------------------------------

  const mergedResults = hasSearched ? mergeResults(textResults, semanticResults) : [];
  const isLoading = isTextLoading || isSemanticLoading;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-0">
      {/* Search input — sticky below header */}
      <div className="sticky top-12 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={placeholder}
              className="pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Type tabs — only visible after first search */}
        {hasSearched && (
          <div className="mx-auto flex max-w-3xl px-4">
            {(["all", "video_game", "tabletop"] as const).map((type) => {
              const labels: Record<TypeFilter, string> = {
                all: "All",
                video_game: "Video Games",
                tabletop: "Tabletop",
              };
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  className={cn(
                    "flex-1 py-2.5 text-center text-sm font-medium transition-colors",
                    typeFilter === type
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {labels[type]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pt-4">
        {/* Semantic error banner */}
        {semanticError && (
          <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
            {semanticError} — showing text matches only
          </div>
        )}

        {/* Pre-search: suggestion chips */}
        {!hasSearched && (
          <div className="py-8 text-center">
            <Search className="mx-auto mb-4 size-12 text-muted-foreground/40" />
            <h2 className="text-lg font-semibold">Search games</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Try natural language queries like these:
            </p>
            <div className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleChipTap(chip)}
                  className="rounded-full border border-border px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {hasSearched && isLoading && mergedResults.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Searching…</span>
          </div>
        )}

        {/* Results */}
        {hasSearched && mergedResults.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {mergedResults.length} result{mergedResults.length !== 1 ? "s" : ""}
              </p>
              {isSemanticLoading && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Finding similar games…
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mergedResults.map((result) => (
                <React.Fragment key={result.game.id}>
                  <div className="relative sm:hidden">
                    <GameCard game={result.game} variant="mobile" />
                    <div className="absolute top-2 left-2 z-10">
                      <MatchBadge type={result.matchType} />
                    </div>
                  </div>
                  <div className="relative hidden sm:block">
                    <GameCard game={result.game} />
                    <div className="absolute top-2 left-2 z-10">
                      <MatchBadge type={result.matchType} />
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {hasSearched && !isLoading && mergedResults.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <p className="text-lg font-medium">No games matched your search</p>
            <p className="mt-1 text-sm">Try different keywords or browse the full catalogue.</p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/games">Browse all games</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
