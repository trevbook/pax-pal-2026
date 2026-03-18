import type { HarmonizedExhibitor } from "@pax-pal/core";
import type { Tier1Result, Tier1Signal } from "./types";

/**
 * Corporate-sounding suffixes that suggest the exhibitor name is a company,
 * not a game title.
 */
const CORPORATE_SUFFIXES =
  /\b(Inc\.?|LLC|Ltd\.?|Studios?|Games?|Gaming|Interactive|Entertainment|Publishing|Media|Digital|Software|Corp\.?|Group|Company|Co\.?|Technologies|GmbH|S\.?A\.?|AB|Pty|SRL|BV)\b/i;

// ---------------------------------------------------------------------------
// Booth index
// ---------------------------------------------------------------------------

/**
 * Group exhibitors by boothLocation. Ignores null/empty booths.
 */
export function buildBoothIndex(
  exhibitors: HarmonizedExhibitor[],
): Map<string, HarmonizedExhibitor[]> {
  const index = new Map<string, HarmonizedExhibitor[]>();
  for (const ex of exhibitors) {
    if (!ex.boothLocation) continue;
    const group = index.get(ex.boothLocation);
    if (group) {
      group.push(ex);
    } else {
      index.set(ex.boothLocation, [ex]);
    }
  }
  return index;
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

/**
 * Detect exhibitors that share a booth with at least one exhibitor that has demos.
 * These are likely umbrella orgs (PR agencies, pavilions, publisher booths).
 */
export function detectUmbrellas(
  noDemoExhibitors: HarmonizedExhibitor[],
  boothIndex: Map<string, HarmonizedExhibitor[]>,
): Set<string> {
  const umbrellas = new Set<string>();
  for (const ex of noDemoExhibitors) {
    if (!ex.boothLocation) continue;
    const boothmates = boothIndex.get(ex.boothLocation);
    if (!boothmates) continue;
    const hasDemoPartner = boothmates.some((b) => b.id !== ex.id && b.demoCount > 0);
    if (hasDemoPartner) {
      umbrellas.add(ex.id);
    }
  }
  return umbrellas;
}

/**
 * Detect exhibitors with no description AND no website — these have no textual
 * data for the LLM, so they should skip Tier 2 and go to Tier 3 (web search).
 */
export function detectSkips(exhibitors: HarmonizedExhibitor[]): Set<string> {
  const skips = new Set<string>();
  for (const ex of exhibitors) {
    if (!ex.description && !ex.website) {
      skips.add(ex.id);
    }
  }
  return skips;
}

/**
 * Detect exhibitor names that look like game titles rather than company names.
 * A soft signal — passed to the LLM as context, not a hard classification.
 */
export function detectGameLikeNames(exhibitors: HarmonizedExhibitor[]): Set<string> {
  const gameLike = new Set<string>();
  for (const ex of exhibitors) {
    if (ex.name.length > 50) continue;
    if (ex.name.includes(",")) continue;
    if (CORPORATE_SUFFIXES.test(ex.name)) continue;
    gameLike.add(ex.id);
  }
  return gameLike;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run Tier 1 structural deduction on all exhibitors.
 * Returns signals for each no-demo exhibitor and splits them into
 * forTier2 (have data for LLM) and skipped (no data, need web search).
 */
export function runTier1(allExhibitors: HarmonizedExhibitor[]): Tier1Result {
  const noDemoExhibitors = allExhibitors.filter((ex) => ex.demoCount === 0);
  const boothIndex = buildBoothIndex(allExhibitors);
  const umbrellas = detectUmbrellas(noDemoExhibitors, boothIndex);
  const skips = detectSkips(noDemoExhibitors);
  const gameLikeNames = detectGameLikeNames(noDemoExhibitors);

  const signals = new Map<string, Tier1Signal>();
  const forTier2: string[] = [];
  const skipped: string[] = [];

  for (const ex of noDemoExhibitors) {
    const boothmates = ex.boothLocation ? (boothIndex.get(ex.boothLocation) ?? []) : [];
    const boothPartners = boothmates.filter((b) => b.id !== ex.id).map((b) => b.id);
    const skipForTier2 = skips.has(ex.id);

    signals.set(ex.id, {
      exhibitorId: ex.id,
      likelyUmbrella: umbrellas.has(ex.id),
      skipForTier2,
      skipReason: skipForTier2 ? "no description and no website" : null,
      nameIsGame: gameLikeNames.has(ex.id),
      boothPartners,
    });

    if (skipForTier2) {
      skipped.push(ex.id);
    } else {
      forTier2.push(ex.id);
    }
  }

  return { signals, forTier2, skipped };
}
