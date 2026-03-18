# Harmonize Stage Fix — Demos as Games

**Date**: March 18, 2026

---

## Problem

The harmonize step (Stage 2.2) treated **exhibitors** as the primary entity, producing one `HarmonizedGame` per exhibitor. But exhibitors are companies/booths, not games. A single exhibitor can bring multiple games to the convention:

- "Critical Reflex" had **14 demos** (Buckshot Roulette, Altered Alma, Lunacid, etc.)
- "AREA 35" had **3 demos** (Felicity's Door, TINY BLITZ, TINY METAL 2)
- "Games from Poland" is a country pavilion representing **16 games**

The demo page (`expo-hall-demos.html`) has actual game-level data — each entry carries a `name` field (via `data-button-text`) with the real game title, separate from the exhibitor name. But the old harmonize algorithm discarded these names entirely, only storing a `demoId` reference on the parent exhibitor record.

**Result**: `games.json` contained 346 exhibitor records masquerading as games. Every record's `name` was a company name, not a game title.

### Secondary issues

- Exhibitors with multiple demos had only the **last** demo's ID stored (each demo overwrote the previous `demoId`)
- Demo names were permanently lost after harmonization
- Some demo `imageUrl` values were the literal string `"undefined"` (scraper edge case), not sanitized

---

## Fix

### New algorithm

The rewrite flips the data model: demos are the primary game-level records, with exhibitor metadata inherited.

1. **Build exhibitor lookup** — `Map<exhibitorId, MergedExhibitor>` from exhibitors + tabletop pages (merging tags for overlapping IDs, same as before).
2. **Group demos by exhibitorId** — `Map<exhibitorId, RawDemo[]>`.
3. **Emit games**:
   - Exhibitor **has demos** → each demo becomes its own `HarmonizedGame`. The exhibitor itself is NOT emitted (avoids duplicates like having both "Critical Reflex" the company and its 14 individual games).
   - Exhibitor **has no demos** → one exhibitor-level `HarmonizedGame` (unchanged from before — this is the best data we have for these entries).
4. **Collect unmatched demos** (exhibitorId not in lookup) — still 0 for our dataset.

### ID strategy

Demo-sourced games use `demo:{demoId}` as their `id` to avoid collision with exhibitor IDs (both come from PAX `data-id` attributes on different pages). Exhibitor-only records keep their original exhibitor ID.

### Type changes

Added `exhibitorId: string` to both `HarmonizedGame` and `Game` interfaces. Always populated — for exhibitor-only records it equals `id`, for demo-sourced records it's the parent exhibitor's PAX data-id.

---

## Results

| Metric | Before | After |
|--------|--------|-------|
| Total games | 346 | **396** |
| Demo-sourced games | 0 | **109** |
| Exhibitor-only games | 346 | **287** |
| Unmatched demos | 0 | 0 |
| Type: video_game | 217 | **266** |
| Type: tabletop | 125 | 125 |
| Type: both | 4 | **5** |

The increase from 346 to 396 comes from expanding multi-demo exhibitors: 59 exhibitor records were replaced by 109 individual demo records (net +50).

### Files changed

- `packages/core/src/game.ts` — Added `exhibitorId` to `HarmonizedGame` and `Game`
- `packages/data-pipeline/src/harmonize/harmonize.ts` — Rewrote algorithm
- `packages/data-pipeline/src/harmonize/harmonize.test.ts` — Rewrote tests (11 cases)
- `packages/data-pipeline/src/integration.test.ts` — Updated assertions
- `packages/core/src/index.test.ts` — Updated type shape tests
- `miscellaneous/data/02-harmonized/games.json` — Regenerated
