# Development Plan — Phase 1 (Revised)

**Date**: March 18, 2026
**Goal**: Scraping pipeline through deployed browsable app
**Supersedes**: `miscellaneous/docs/03-04-26/phase-1-development-plan.md`

---

## Status Summary

| Stage | Status | Notes |
|-------|--------|-------|
| 1. Foundation (`packages/core`) | ✅ Complete | Types, taxonomy, utils |
| 2.0 Scaffold `data-pipeline` | ✅ Complete | CLI, scrape, harmonize modules |
| 2.1 Scrape | ✅ Complete | HTML parser + LeapEvent API (see `api-scrape-refactor.md`) |
| 2.2 Harmonize | ✅ Complete | Exhibitors + games separated (see `harmonize-fix.md`) |
| 2.3 Discover (Tier 1) | ✅ Complete | Structural deduction — booth sharing, skip detection, game-like names |
| 2.3 Discover (Tier 2) | ✅ Complete | LLM classification via AI SDK v6 + gpt-5.4-mini |
| 2.3 Discover (Tier 3) | ✅ Complete | Web search agent via AI SDK v6 + OpenAI Responses API |
| 2.4 Enrich | ✅ Complete | BGG + LLM web search + Steam API + URL validation |
| 2.5 Classify | 📋 Planned | Taxonomy label assignment |
| 2.6 Embed | 📋 Planned | Semantic search vectors |
| 3. Infrastructure | 📋 Planned | DynamoDB, SST deploy |
| 4. Frontend | 📋 Planned | Game browsing, search, tracking |

### Current data snapshot

| Metric | Count |
|--------|-------|
| Exhibitors (total) | 368 |
| Exhibitors with demos | 86 |
| Exhibitors without demos (discovery candidates) | 282 |
| — with website URL | 261 |
| — with description (>20 chars) | 256 |
| — tabletop exhibitors | 118 |
| Games (demo-sourced) | 161 |
| — video_game | 145 |
| — both (video + tabletop) | 16 |

The 282 exhibitor-only records are companies, not games. The discover stage exists to find the actual games these companies are bringing to PAX East.

---

## Pipeline Architecture (Revised)

```
scrape → harmonize → discover → enrich → classify → embed → load
```

### Key data model change

Harmonize now produces **two separate outputs**:

- `02-harmonized/exhibitors.json` — All 368 exhibitors. Always companies/orgs, never games.
- `02-harmonized/games.json` — Only confirmed games (161 demo-sourced today, more after discover).

This replaces the old model where exhibitors were shoehorned into the games list. Exhibitors and games are distinct entity types with a foreign key relationship (`game.exhibitorId → exhibitor.id`).

### Types involved

```typescript
// Exhibitor — company/org with a booth (from @pax-pal/core)
interface HarmonizedExhibitor {
  id: string;              // PAX exhibitor data-id
  name: string;
  slug: string;
  boothLocation: string | null;
  description: string | null;
  imageUrl: string | null;
  website: string | null;  // NEW — from API
  storeUrl: string | null; // NEW — from API
  showroomUrl: string | null;
  isFeatured: boolean;
  isTabletop: boolean;
  paxTags: string[];
  sourcePages: ("exhibitors" | "tabletop")[];
  demoCount: number;
  lastScrapedAt: string;
}

// Game — an actual playable game (from @pax-pal/core)
interface HarmonizedGame {
  id: string;              // "demo:{demoId}" or "discovered:{exhibitorId}:{slug}"
  name: string;            // Game title, NOT exhibitor name
  slug: string;
  type: GameType;
  exhibitor: string;
  exhibitorId: string;
  boothLocation: string | null;
  description: string | null;
  imageUrl: string | null;
  showroomUrl: string | null;
  isFeatured: boolean;
  paxTags: string[];
  sourcePages: ("exhibitors" | "tabletop" | "demos")[];
  demoId: string | null;   // non-null for demo-sourced, null for discovered
  lastScrapedAt: string;
}
```

---

## Stage 2.3: Discover

**Input**: `02-harmonized/exhibitors.json` (282 exhibitors with `demoCount === 0`)
**Output**: `02-harmonized/games.json` (updated — discovered games appended to the 161 demo-sourced games)

The discover stage examines exhibitors that have no linked demos and identifies the actual games they're bringing to PAX East. It runs in three tiers, each progressively more expensive. Earlier tiers reduce the workload for later ones.

### Overview

```
282 exhibitor-only records
         │
    ┌────▼────┐
    │ Tier 1  │  Structural deduction (no AI, no web)
    │ (free)  │  → Filter out non-game exhibitors via heuristics
    └────┬────┘
         │  Remaining unknowns
    ┌────▼────┐
    │ Tier 2  │  LLM classification + extraction (AI, no web)
    │ (cheap) │  → Classify exhibitor kind, extract game names from descriptions
    └────┬────┘
         │  Remaining "publisher_unknown" entries
    ┌────▼────┐
    │ Tier 3  │  Web search (AI + web, expensive)
    │ ($$)    │  → Search social media / news for PAX East announcements
    └─────────┘
```

### Tier 1: Structural deduction

Pure data analysis — no API calls, no cost. Runs first to reduce the input set for Tier 2.

**1a. Booth-sharing analysis**

Some exhibitors share a booth with other exhibitors who already have demos. This suggests the booth-sharing exhibitor is an umbrella org (PR agency, pavilion, publisher booth), not a game.

Example: Ukiyo Studios (booth 18055) is a PR/marketing agency. The developers they represent — Critical Reflex, PINIX, Numskull Games, etc. — are separate exhibitors at the same booth, and several already have demos.

Algorithm:
1. Group exhibitors by `boothLocation`.
2. For each exhibitor with `demoCount === 0`:
   - If other exhibitors at the same booth have `demoCount > 0`, flag as `likely_umbrella`.
   - If the exhibitor's description mentions other exhibitors by name (fuzzy match against all exhibitor names), strengthen the umbrella signal.
3. Don't auto-classify — just annotate. Tier 2 uses these signals.

**1b. Empty-description, no-website exhibitors**

Exhibitors with no description and no website have virtually no data to work with. Flag these for Tier 3 (web search) directly, since Tier 2 has nothing to analyze.

**1c. Tabletop exhibitors with known game names**

Many tabletop exhibitors ARE their game (the company name is the game name, or the description is purely about one game). The tabletop category (118 exhibitors without demos) is rich territory for single-game identification. BGG name matching could identify many of these without any LLM involvement — if the exhibitor name or a substring of it matches a BGG entry, it's likely the game.

This doesn't need to be perfect — it's a pre-filter. Tier 2 confirms or corrects.

### Tier 2: LLM classification + game extraction

For each remaining exhibitor, send its metadata to an LLM (Gemini) and ask for structured classification.

**Input per exhibitor** (provided to the LLM):

```json
{
  "name": "9th Bit Games",
  "description": "Terra Nova: Legend of the Runes is a modern love letter...",
  "website": "terranovaworld.com",
  "storeUrl": null,
  "isTabletop": false,
  "paxTags": ["RPG", "Retro"],
  "boothSharedWith": [],
  "tier1Signals": { "likelyUmbrella": false }
}
```

**Requested output** (structured JSON mode):

```typescript
interface DiscoveryResult {
  /** What kind of exhibitor is this? */
  exhibitorKind: "game_studio" | "publisher" | "agency" | "tabletop_publisher"
                | "peripheral" | "media" | "community" | "other";

  /** What games can we identify from the available data? */
  games: DiscoveredGame[];

  /** How confident are we in this classification? */
  confidence: number;  // 0.0–1.0

  /** Should we run a web search for more info? */
  needsWebSearch: boolean;

  /** Brief reasoning for the classification. */
  reasoning: string;
}

interface DiscoveredGame {
  /** The actual game name (not the exhibitor name). */
  name: string;

  /** How was this game identified? */
  source: "description_explicit"   // game name stated in description
        | "description_inferred"   // inferred from context (e.g., website domain)
        | "name_is_game"           // exhibitor name IS the game
        | "bgg_match";            // matched via BoardGameGeek

  /** Confidence for this specific game. */
  confidence: number;  // 0.0–1.0

  /** Game type if determinable. */
  type: "video_game" | "tabletop" | "both" | null;
}
```

**Classification categories explained:**

| Kind | Description | Example | Expected game discovery |
|------|-------------|---------|------------------------|
| `game_studio` | Makes/publishes their own games | 9th Bit Games | Usually 1 game, named in description |
| `publisher` | Publishes others' games, unclear what's at PAX | IllFonic | `needsWebSearch: true` |
| `agency` | PR/marketing/biz dev for other devs | Ukiyo Studios | 0 games (devs are separate exhibitors) |
| `tabletop_publisher` | Tabletop game publisher/designer | 1985 Games LLC | Games often named in description |
| `peripheral` | Hardware, accessories, eyewear, etc. | Zenni | 0 games |
| `media` | Press, streamers, content creators | — | 0 games |
| `community` | Fan groups, nonprofits, community orgs | — | 0 games |
| `other` | Doesn't fit above categories | — | Varies |

**LLM prompt design considerations:**

- Use few-shot examples covering each category (include the 9th Bit Games / IllFonic / Ukiyo / Zenni examples from our brainstorming).
- Instruct the LLM to prefer `needsWebSearch: true` over low-confidence guesses.
- For `game_studio` with a single clear game: extract the game name and set `source: "description_explicit"`.
- For exhibitors whose company name IS the game: set `source: "name_is_game"` (common for indie studios).
- For tabletop exhibitors: cross-reference against BGG if possible.
- For agencies/peripherals/media: emit `games: []` — these are not game sources.

**Batching and cost:**

- ~250 exhibitors after Tier 1 filtering
- Use Gemini Flash for classification (cheap, fast, good at structured output)
- Batch 5–10 exhibitors per request to reduce overhead
- Cache results to `miscellaneous/data/cache/discover/tier2/` for re-runs
- Estimated cost: <$0.50 for the full set

### Tier 3: Web search for unknowns

Only for exhibitors where Tier 2 returned `needsWebSearch: true` — typically `publisher` or `other` kind with low confidence.

**Search strategy:**

For each exhibitor needing web search:
1. Search: `"{exhibitor name}" "PAX East" 2026`
2. Search: `"{exhibitor name}" "PAX East" site:x.com` (Twitter/X announcements)
3. If website is known, search: `site:{website} "PAX East"`

**Parse results with LLM:**

Feed search result snippets to the LLM and ask:
- What specific games is this company bringing to PAX East 2026?
- Cite the source (tweet URL, blog post, etc.)

**Output**: Same `DiscoveredGame[]` structure as Tier 2, with `source: "web_search"`.

**Cost considerations:**

- Expected ~30–60 exhibitors needing web search (publishers with no description or ambiguous descriptions)
- 2–3 web searches per exhibitor = ~100–180 searches
- Plus LLM calls to parse results
- Estimated cost: $1–3 total
- Cache aggressively — results won't change between runs

### Discovery output format

After all three tiers, produce:

**`miscellaneous/data/02-harmonized/discovery.json`** — Raw discovery results per exhibitor:

```typescript
interface ExhibitorDiscovery {
  exhibitorId: string;
  exhibitorName: string;
  exhibitorKind: string;
  games: DiscoveredGame[];
  confidence: number;
  needsWebSearch: boolean;
  webSearchCompleted: boolean;
  reasoning: string;
  discoveredAt: string;
}
```

**Updated `02-harmonized/games.json`** — Discovered games appended alongside demo-sourced games:

For each discovered game, create a `HarmonizedGame`:
- `id`: `"discovered:{exhibitorId}:{gameSlug}"` (distinct namespace from `demo:` prefix)
- `demoId`: `null`
- `type`: from discovery result, or `"video_game"` default
- `description`: from exhibitor description (may describe the game)
- Inherits exhibitor's `boothLocation`, `showroomUrl`, `imageUrl`, `paxTags`

**Updated `02-harmonized/exhibitors.json`** — Add discovery metadata:

Add to `HarmonizedExhibitor`:
```typescript
exhibitorKind: string | null;       // null until discover runs
discoveredGameCount: number;        // games found by discover (distinct from demoCount)
```

### Discovery confidence tracking

Every game record carries a `discoverySource` indicating provenance and confidence:

```typescript
type DiscoverySource =
  | "demo_page"           // highest — listed on PAX demos page
  | "description_explicit" // game name explicitly stated in exhibitor description
  | "description_inferred" // inferred from description context or website domain
  | "bgg_match"           // matched exhibitor name to BoardGameGeek entry
  | "web_search"          // found via web search of social media / news
  | "name_is_game";       // exhibitor name IS the game name
```

This field goes on `HarmonizedGame` (and eventually `Game`). The frontend can use it to:
- Show all games equally in browse/search
- Add subtle indicators for lower-confidence entries ("we think this game is here")
- Let users report corrections

### CLI integration

```bash
# Run discover only
bun run src/cli.ts discover

# Run discover with web search enabled (Tier 3)
bun run src/cli.ts discover --web-search

# Run full pipeline including discover
bun run src/cli.ts all --source live --web-search
```

By default, `discover` runs Tier 1 + Tier 2 only (fast, cheap). The `--web-search` flag enables Tier 3 for remaining unknowns. This lets you iterate quickly on the classification logic without burning web search credits.

### Implementation plan

**Files to create:**

```
packages/data-pipeline/src/discover/
├── discover.ts           # Orchestrator: runs tiers in sequence
├── discover.test.ts      # Unit tests with synthetic exhibitor data
├── tier1.ts              # Structural deduction (booth sharing, empty data, BGG names)
├── tier1.test.ts
├── tier2.ts              # LLM classification + extraction
├── tier2.test.ts         # Tests with mocked LLM responses
├── tier3.ts              # Web search + LLM parsing
├── tier3.test.ts         # Tests with mocked search results
└── types.ts              # DiscoveryResult, DiscoveredGame, ExhibitorDiscovery
```

**Files to modify:**

- `packages/core/src/game.ts` — Add `discoverySource` to `HarmonizedGame` and `Game`; add `exhibitorKind` and `discoveredGameCount` to `HarmonizedExhibitor`
- `packages/data-pipeline/src/cli.ts` — Add `discover` stage, `--web-search` flag
- `packages/data-pipeline/src/index.ts` — Export discover module

**Dependencies to add:**

- `@google/generative-ai` — Gemini API (for Tier 2 classification and Tier 3 result parsing)

**Estimated effort**: 2–3 days for Tier 1 + Tier 2. Tier 3 adds another half day.

### Implementation notes (Tier 1 + Tier 2 — completed 2026-03-18)

**Deviation from plan:** Used AI SDK v6 (`ai` + `@ai-sdk/openai`) with OpenAI `gpt-5.4-mini` instead of `@google/generative-ai` with Gemini. The `generateObject` API provides built-in Zod schema validation for structured output.

**Files created:**

```
packages/data-pipeline/src/discover/
├── types.ts              # Tier1Signal, DiscoveryResult, DiscoveredGame (Zod schemas)
├── tier1.ts              # buildBoothIndex, detectUmbrellas, detectSkips, detectGameLikeNames, runTier1
├── tier1.test.ts         # 16 tests
├── tier2.ts              # classifyBatch (generateObject), loadCache/saveToCache, runTier2
├── tier2.test.ts         # 9 tests (formatExhibitorForPrompt unit tests)
├── discover.ts           # Orchestrator: runTier1 → runTier2 → build games + annotate exhibitors
└── discover.test.ts      # 8 tests (with injected fake runTier2)
```

**Files modified:**

- `packages/core/src/game.ts` — Added `EXHIBITOR_KINDS`, `DISCOVERY_SOURCES` const arrays + types; added `exhibitorKind`, `discoveredGameCount` to `HarmonizedExhibitor`; added `discoverySource` to `HarmonizedGame`
- `packages/core/src/index.ts` — Exports new types and constants
- `packages/data-pipeline/src/harmonize/harmonize.ts` — Sets new fields to defaults (`null`/`0`)
- `packages/data-pipeline/src/cli.ts` — Added `discover` stage + `--skip-cache` flag; `all` now runs scrape → harmonize → discover
- `packages/data-pipeline/src/index.ts` — Exports discover module
- `packages/data-pipeline/package.json` — Added `ai`, `@ai-sdk/openai`, `zod` dependencies; added `discover` script

**Dependencies added:** `ai@^6.0.0`, `@ai-sdk/openai@^3.0.0`, `zod@^4.3.0`

**Caching:** Per-exhibitor JSON files at `miscellaneous/data/cache/discover/tier2/{exhibitorId}.json`. Re-runs skip cached exhibitors automatically. `--skip-cache` flag forces re-classification.

**Tier 2 batching:** 5 exhibitors per LLM call, sequential processing. System prompt includes 4 few-shot examples (game_studio, peripheral, publisher, agency).

**Test count:** 33 new tests (16 tier1 + 9 tier2 + 8 discover). All 114 project tests pass.

### Implementation notes (Tier 3 — completed 2026-03-18)

**Approach:** Per-exhibitor web search agent using OpenAI Responses API built-in web search via AI SDK v6. Each exhibitor gets a multi-step `generateText` loop with `openai.tools.webSearch()` that searches for PAX East 2026 game announcements, then produces structured output via `Output.object()`.

**Files created:**

```
packages/data-pipeline/src/discover/
├── tier3.ts              # searchExhibitor (per-exhibitor agent), loadTier3Cache/saveToTier3Cache, runTier3
└── tier3.test.ts         # 6 tests (result shape, formatting)
```

**Files modified:**

- `packages/data-pipeline/src/discover/types.ts` — Added `"web_search"` to `discoveredGameSourceValues`; added `tier3Eligible`, `tier3Processed`, `tier3Cached` to `DiscoverStats`
- `packages/data-pipeline/src/discover/discover.ts` — Added Tier 3 integration: `webSearch`, `tier3CacheDir`, `_runTier3` options; tier3 eligible = tier1 skipped + tier2 needsWebSearch; tier3 results replace tier2 for same exhibitor; updated `mapSource` and stats
- `packages/data-pipeline/src/cli.ts` — Added `--web-search` flag; passes `tier3CacheDir` and `webSearch` to discover
- `packages/data-pipeline/src/discover/discover.test.ts` — Added 3 tier3 integration tests (replace, skip, eligible)

**No new dependencies.** Reuses existing `ai` + `@ai-sdk/openai`. Uses `model: "openai/gpt-5.4-mini"` (string format for Responses API compatibility).

**Key design decisions:**

- `stopWhen: stepCountIs(6)` — 5 search steps + 1 structured output step, targeting ~$0.10 max per exhibitor
- `searchContextSize: "low"` — minimizes token cost per search
- Concurrency: 2 workers (conservative for rate limits)
- Caching: per-exhibitor at `miscellaneous/data/cache/discover/tier3/{exhibitorId}.json`; failures also cached to ensure idempotency
- `--web-search` flag required to enable Tier 3 (Tier 1 + 2 run by default)

**Test count:** 9 new tests (6 tier3 + 3 discover integration). All 123 project tests pass.

### Expected outcomes

Conservative estimates for what discover will find:

| Category | Est. count | Games found |
|----------|-----------|-------------|
| `game_studio` (single game in description) | ~80–100 | ~80–100 new games |
| `game_studio` (name IS the game) | ~30–50 | ~30–50 new games |
| `tabletop_publisher` (games in description) | ~40–60 | ~60–100 new games |
| `publisher` (needs web search) | ~30–40 | ~20–40 new games |
| `agency` / `peripheral` / `media` / `other` | ~50–70 | 0 (not game sources) |

**Projected total games after discover: ~350–450** (up from 161 demo-sourced)

---

## Stage 2.4: Enrich

**Input**: `02-harmonized/games.json` (post-discover, ~370 games)
**Output**: `miscellaneous/data/03-enriched/games.json` + `miscellaneous/data/03-enriched/enrichment-meta.json`

Four enrichment steps running in sequence. Each step builds on the previous — e.g., Step 2 skips tabletop games that already got a BGG hit, and Step 3 only runs for games where Step 2 found a Steam URL.

### Overview

```
370 games (post-discover)
         │
    ┌────▼─────┐
    │  Step 1   │  BGG API lookup (tabletop/both only, ~60–80 games)
    │  (free)   │  → playerCount, playTime, complexity, mechanics, bggId, image
    └────┬──────┘
         │
    ┌────▼─────┐
    │  Step 2   │  LLM web search agent (per-game, gpt-5.4-mini)
    │  ($$)     │  → summary, description, platforms, genres, steamUrl, pressLinks, etc.
    │           │  Tabletop: SKIP if BGG hit in Step 1
    └────┬──────┘
         │
    ┌────▼─────┐
    │  Step 3   │  Steam API (video games with steamUrl from Step 2)
    │  (free)   │  → price, screenshots, tags, description, review score
    └────┬──────┘
         │
    ┌────▼─────┐
    │  Step 4   │  URL validation (HEAD requests, all collected URLs)
    │  (free)   │  → drop any 404'd URLs
    └─────────┘
```

### Step 1: BGG enrichment (tabletop games)

For each game where `type === "tabletop" || type === "both"`:

1. Search BGG: `GET https://boardgamegeek.com/xmlapi2/search?query={name}&type=boardgame`
2. Parse XML response, score candidates with Levenshtein distance against game name.
3. **Matching logic:**
   - If best match score > 0.90 → auto-accept.
   - If best match score 0.60–0.90 → send top 5 candidates + game description/exhibitor to `gpt-5.4-nano` for lightweight disambiguation ("which of these BGG results is the same game?"). Dirt cheap — <200 tokens per call.
   - If best match score < 0.60 → no BGG match, flag for Step 2 web search.
4. For matched games, fetch details: `GET https://boardgamegeek.com/xmlapi2/thing?id={bggId}&stats=1`
5. Extract and store as `BggEnrichment`:

```typescript
interface BggEnrichment {
  bggId: number;
  bggName: string;           // canonical BGG name
  matchScore: number;        // Levenshtein score, or 1.0 if LLM-confirmed
  playerCount: string;       // "2-4"
  playTime: string;          // "30-60 min"
  complexity: number;        // BGG weight 1.0-5.0
  mechanics: string[];       // raw BGG mechanics (mapped to TabletopMechanic in classify stage)
  description: string;
  imageUrl: string;
  rating: number;            // BGG average rating
  yearPublished: number | null;
}
```

**Rate limiting**: ~1 req/sec to BGG. ~80 searches + ~60 detail fetches = ~140 requests, ~2.5 min.

**Type correction**: If BGG confirms a game as tabletop but it's currently typed as `video_game` (or vice versa), enrich corrects the `type` field.

**Cache**: Per-game at `miscellaneous/data/cache/enrich/bgg/{gameId}.json`.

### Step 2: LLM web search enrichment (per-game)

Same agent pattern as Tier 3 discover: `generateText` + `openai.tools.webSearch()` + `Output.object()` with `gpt-5.4-mini`.

**Input**: All games EXCEPT tabletop games that got a BGG hit in Step 1 (have a `bggId`).

**Prompt context includes**:
- Game name, type, exhibitor name, description (from harmonized data)
- `discoveryMeta.evidenceUrls` if present — included as starting context ("Here are some URLs we already know about"), not as a constraint
- Exhibitor website/storeUrl if available

**Agent config**: `gpt-5.4-mini`, `stopWhen: stepCountIs(8)`, `searchContextSize: "low"`, concurrency 8.

**Requested output** (structured JSON via Zod schema):

```typescript
const webEnrichmentSchema = z.object({
  summary: z.string(),                          // 1-2 sentence hook
  description: z.string().nullable(),            // fuller description if available
  imageUrl: z.string().nullable(),               // Steam header, official art, etc.

  // Video game fields
  platforms: z.array(z.enum(PLATFORMS)).nullable(),
  genres: z.array(z.enum(VIDEO_GAME_GENRES)).nullable(),
  releaseStatus: z.enum(RELEASE_STATUSES).nullable(),
  releaseDate: z.string().nullable(),            // "2025-Q2", "March 2026", etc.
  steamUrl: z.string().nullable(),

  // Tabletop fields (for BGG misses only)
  playerCount: z.string().nullable(),
  playTime: z.string().nullable(),
  mechanics: z.array(z.enum(TABLETOP_MECHANICS)).nullable(),

  // Press & media coverage
  pressLinks: z.array(z.object({
    url: z.string(),
    title: z.string(),
    source: z.string(),                          // "PC Gamer", "Dicebreaker", etc.
    type: z.enum(["review", "preview", "interview", "announcement", "trailer", "other"]),
  })),

  // Social presence
  socialLinks: z.object({
    twitter: z.string().nullable(),
    discord: z.string().nullable(),
    youtube: z.string().nullable(),
    itchIo: z.string().nullable(),
  }),

  // Media
  trailerUrl: z.string().nullable(),             // YouTube/Steam trailer
  screenshotUrls: z.array(z.string()),           // up to 3-4

  // Developer info (sometimes differs from exhibitor)
  developerName: z.string().nullable(),
});
```

**Press/article collection**: The web search agent naturally hits news sites and social media. The prompt explicitly asks it to collect press links — articles, previews, reviews, trailers, announcements about the game. These map to a "Read more" section on the frontend game detail page. If multiple games from the same exhibitor share a press article (e.g., "Publisher X brings 3 games to PAX East"), each game gets its own copy of the link.

**Note on web search data**: The OpenAI web search tool is opaque — you don't get raw search result URLs back in the API response; only what the model includes in its structured output. The URL validation pass (Step 4) confirms they're real.

**Cache**: Per-game at `miscellaneous/data/cache/enrich/web/{gameId}.json`.

### Step 3: Steam API enrichment

**Input**: Games where Step 2 found a `steamUrl`. Extract `steamAppId` via regex from the URL.

**API**: `GET https://store.steampowered.com/api/appdetails?appids={appId}` — free, no auth needed, generous rate limits.

**Extract and store as `SteamEnrichment`**:

```typescript
interface SteamEnrichment {
  steamAppId: number;
  name: string;
  shortDescription: string;
  headerImage: string;          // 460x215 header image
  screenshots: string[];        // up to 4
  movies: { thumbnail: string; webm: string }[];  // trailers
  price: string | null;         // "$19.99" or "Free to Play"
  genres: string[];             // Steam's genre tags
  categories: string[];         // "Single-player", "Co-op", etc.
  releaseDate: string;          // "Mar 15, 2026"
  reviewScore: number | null;   // Metacritic or Steam review score
  platforms: { windows: boolean; mac: boolean; linux: boolean };
}
```

Steam data provides verified screenshots, trailers, and pricing that the LLM may have hallucinated. Steam data can backfill or override LLM data where applicable.

**Rate limiting**: ~1 req/sec. Estimated ~100–150 video games with Steam URLs = ~2.5 min.

**Cache**: Per-app at `miscellaneous/data/cache/enrich/steam/{steamAppId}.json`.

### Step 4: URL validation

After all enrichment steps, collect every URL found across all sources (`imageUrl`, `steamUrl`, `trailerUrl`, `pressLinks[].url`, `screenshotUrls`, `socialLinks.*`). Run parallel HEAD requests to verify each is live.

```typescript
async function validateUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

High concurrency (20–30 workers), 5s timeout. ~370 games × ~5 URLs each = ~1850 requests, ~30 seconds. Drop any URLs that 404.

### EnrichmentMeta sidecar

All raw enrichment data is stored separately from the final `Game` shape. This preserves source data for debugging, re-processing, and later merge-strategy tuning.

```typescript
interface EnrichmentMeta {
  gameId: string;

  // Raw source data (preserved for debugging/re-processing)
  bgg: BggEnrichment | null;
  web: z.infer<typeof webEnrichmentSchema> | null;
  steam: SteamEnrichment | null;

  // Validation results
  validatedUrls: string[];      // URLs that passed HEAD check
  invalidUrls: string[];        // URLs that 404'd

  enrichedAt: string;
}
```

The final `Game` record shape (built during classify/load) merges fields from the sidecar with whatever priority logic makes sense — this can be adjusted after reviewing initial results.

### Files

```
packages/data-pipeline/src/enrich/
├── enrich.ts              # Orchestrator: BGG → web search → Steam → validate
├── enrich.test.ts
├── bgg.ts                 # BGG XML API client, search, Levenshtein matching, nano LLM disambiguation
├── bgg.test.ts
├── web.ts                 # LLM web search agent (per-game, gpt-5.4-mini)
├── web.test.ts
├── steam.ts               # Steam store API client
├── steam.test.ts
├── validate.ts            # URL HEAD-check pass
├── validate.test.ts
└── types.ts               # EnrichmentMeta, BggEnrichment, SteamEnrichment, Zod schemas
```

### Core type additions

Add to `packages/core/src/game.ts`:
- `bggId: number | null` on `Game`
- `steamAppId: number | null` on `Game`
- `pressLinks` array on `Game`
- `socialLinks` object on `Game`
- `developerName: string | null` on `Game`
- `price: string | null` on `Game`

### Dependencies

No new dependencies needed. Reuses existing `ai` + `@ai-sdk/openai`. BGG and Steam APIs are plain HTTP (fetch). Levenshtein can be a small utility function.

### CLI integration

```bash
# Run enrich only
bun run src/cli.ts enrich

# Enrich with limit (test on N random games first)
bun run src/cli.ts enrich --limit 5

# Skip cache for full re-enrichment
bun run src/cli.ts enrich --skip-cache

# Full pipeline
bun run src/cli.ts all --source live --web-search
```

The `--limit N` flag selects N random games to enrich, useful for testing prompts and validating output quality before running the full set.

### Cost estimate

| Step | Volume | Cost |
|------|--------|------|
| BGG API | ~140 requests | Free |
| BGG disambiguation (gpt-5.4-nano) | ~20–30 calls, <200 tokens each | ~$0.01 |
| LLM web search (gpt-5.4-mini) | ~300 games × ~8 steps | ~$3–5 |
| Steam API | ~100–150 requests | Free |
| URL validation | ~1850 HEAD requests | Free |
| **Total** | | **~$3–5** |

### Estimated effort

2–3 days (Step 1: half day, Step 2: 1 day, Step 3: half day, Step 4 + wiring: half day)

### Implementation notes (completed 2026-03-19)

**Approach:** Four-step sequential enrichment: BGG XML API → LLM web search agent → Steam store API → URL validation. Same AI SDK v6 + OpenAI patterns as discover Tier 3.

**Files created:**

```
packages/data-pipeline/src/enrich/
├── types.ts              # BggEnrichment, WebEnrichment, SteamEnrichment, EnrichmentMeta, Zod schemas
├── bgg.ts                # BGG XML API search + detail fetch, Levenshtein matching, gpt-5.4-nano disambiguation
├── bgg.test.ts           # 8 tests (Levenshtein similarity)
├── web.ts                # Per-game web search agent (gpt-5.4-mini + openai.tools.webSearch)
├── web.test.ts           # 7 tests (prompt construction, discoveryMeta evidence URL inclusion)
├── steam.ts              # Steam store API client, app ID extraction, deduplication
├── steam.test.ts         # 8 tests (Steam URL parsing)
├── validate.ts           # URL HEAD-check validation with concurrent worker pool
├── validate.test.ts      # 4 tests (URL checking)
├── enrich.ts             # Orchestrator: BGG → web → Steam → validate, DI overrides, URL scrubbing
└── enrich.test.ts        # 20 tests (full pipeline flow, URL scrubbing, bare social link filtering)
```

**Files modified:**

- `packages/core/src/game.ts` — Added `PressLink`, `SocialLinks`, `PressLinkType` types; added `bggId`, `steamAppId`, `pressLinks`, `socialLinks`, `developerName`, `price` to `Game`
- `packages/core/src/index.ts` — Exports new types and constants
- `packages/data-pipeline/src/cli.ts` — Added `enrich` stage with `--limit` and `--skip-cache` flags; wired into `all` pipeline after discover
- `packages/data-pipeline/src/index.ts` — Exports enrich module
- `packages/data-pipeline/package.json` — Added `enrich` script

**No new dependencies.** Reuses existing `ai` + `@ai-sdk/openai`, `cheerio` (for BGG XML), `zod`, `cli-progress`. BGG and Steam APIs use plain `fetch`.

**Key design decisions:**

- BGG matching uses Levenshtein similarity with three tiers: auto-accept (>0.90), LLM disambiguation via `gpt-5.4-nano` (0.60–0.90), no match (<0.60)
- Web search agent includes `discoveryMeta.evidenceUrls` in the prompt as starting context, not as constraints
- Tabletop games with BGG hits skip web search enrichment
- Steam app IDs extracted from web search `steamUrl` via regex; multiple games may share the same Steam app (deduplicated)
- URL validation runs HEAD requests with 25 concurrent workers, 5s timeout
- Invalid URLs are scrubbed from all enrichment data (imageUrl, pressLinks, socialLinks, screenshots, etc.) — not just tracked
- Bare-domain social links (e.g., `https://x.com`, `https://discord.gg`) are detected and nulled out via both prompt instructions and post-hoc filtering
- `EnrichmentMeta` sidecar preserves raw enrichment data per source for debugging and future merge-strategy tuning
- Type correction: if BGG matches a game typed `video_game`, it's updated to `both`

**Caching:** Per-game JSON files at `cache/enrich/bgg/`, `cache/enrich/web/`, `cache/enrich/steam/`. Re-runs skip cached games. `--skip-cache` flag forces re-enrichment.

**Test count:** 47 new tests across 5 files. All 177 project tests pass.

---

## Stage 2.5: Classify

**Input**: `03-enriched/games.json`
**Output**: `miscellaneous/data/04-classified/games.json`

Use Gemini structured output to assign taxonomy labels from `@pax-pal/core`:

- Feed each game's name + description + existing tags
- Request structured output matching taxonomy constants
- Validate against allowed values
- Overwrite `tags` field with normalized taxonomy labels, preserve `paxTags`

Could potentially be combined with the enrich step (single LLM call does both), but keeping them separate makes debugging easier and allows re-running classification without re-enriching.

**Estimated effort**: Half a day (shares LLM infrastructure with enrich)

---

## Stage 2.6: Embed

**Input**: `04-classified/games.json`
**Output**: `miscellaneous/data/05-embedded/games.json`

For each game:
1. Concatenate: `name + " " + summary + " " + tags.join(", ") + " " + description`
2. Call Gemini `gemini-embedding-001` to generate 768d vector
3. Store as `embedding: number[]` on the game object
4. Batch embedding calls
5. Skip games with existing embeddings (unless description changed)

**Estimated effort**: Half a day

---

## Stage 3: Infrastructure

**Estimated effort**: Half a day

### 3.1 DynamoDB Tables (SST)

Two tables:

```typescript
// Games table
export const gamesTable = new sst.aws.DynamoTable("Games", {
  fields: { pk: "string", type: "string", name: "string", boothId: "string" },
  primaryIndex: { hashKey: "pk" },
  globalIndexes: {
    byType: { hashKey: "type", rangeKey: "name" },
    byBooth: { hashKey: "boothId" },
  },
});

// Exhibitors table
export const exhibitorsTable = new sst.aws.DynamoTable("Exhibitors", {
  fields: { pk: "string", kind: "string", name: "string" },
  primaryIndex: { hashKey: "pk" },
  globalIndexes: {
    byKind: { hashKey: "kind", rangeKey: "name" },
  },
});
```

### 3.2 Load Script

- Read `05-embedded/games.json` and `02-harmonized/exhibitors.json`
- Batch-write to DynamoDB (25 items per batch)
- PK format: `GAME#{id}` and `EXHIBITOR#{id}`
- Skip unchanged items on re-run

### 3.3 Deploy + Verify

- `sst deploy --stage dev`
- Run load script
- Verify in AWS Console

### 3.4 Wire Frontend

Link both tables to the Next.js app via SST resource linking.

---

## Stage 4: Frontend

**Estimated effort**: 2–3 days

### 4.1 Data Access Layer

`apps/www/lib/games.ts` — Server-side data functions:

- `getAllGames()` — Browse + search
- `getGameById(id)` — Detail page
- `searchGames(query)` — Hybrid text + semantic search
- `getAllExhibitors()` — Exhibitor list
- `getExhibitorById(id)` — Exhibitor detail (with linked games)

### 4.2 Game Browsing Page (`/games`)

Server component with filterable grid:
- Game cards: name, image, type badge, summary, booth, top 3 tags
- Filters: type toggle, tag multi-select, search input
- Sorting: name (A-Z), booth number
- Client-side pagination (~350–450 games)
- Optional: discovery source indicator for lower-confidence entries

### 4.3 Game Detail Page (`/games/[slug]`)

- Hero: image, name, type badge, exhibitor link, booth
- Full description
- Metadata: platforms/genres (video games) or player count/time/mechanics (tabletop)
- Tags as badges
- Link to PAX showroom page
- Placeholder for watchlist/played buttons (Phase 2)

### 4.4 Exhibitor Browsing Page (`/exhibitors`)

New page surfacing exhibitor data:
- Card grid with company name, image, booth, exhibitor kind badge
- Filter by kind (game studio, publisher, tabletop, etc.)
- Show number of linked games per exhibitor

### 4.5 Exhibitor Detail Page (`/exhibitors/[slug]`)

- Company info, description, website link, store link
- Booth location
- Linked games grid (games from this exhibitor)

### 4.6 Search Page (`/search`)

- Hybrid search: text substring + semantic similarity
- Server action embeds query via Gemini, computes cosine similarity
- Results show game cards with match type indicator

### 4.7 Local Tracking (`/my-games`)

Client-side only — localStorage:
- Watchlist / Played / Ratings
- Buttons on game detail page
- Visual indicator on game cards
- My Games page with two tabs

### 4.8 Navigation & Layout

- Top nav: PAX Pal logo, Browse Games, Exhibitors, Search, My Games
- Mobile-responsive
- PAX East branding

---

## Risk Items

1. **LLM classification accuracy** — Tier 2 may misclassify some exhibitors. Mitigation: manual review of `discovery.json`, confidence thresholds, user-reported corrections.
2. **Web search rate limits** — Tier 3 may hit rate limits on search APIs. Mitigation: cache aggressively, batch conservatively, run overnight if needed.
3. **Gemini API quotas** — Discover + enrich + classify + embed is a lot of calls. Mitigation: use Flash for classification (cheap), batch requests, process incrementally.
4. **BGG rate limits** — Throttle to ~1 req/sec, cache all responses.
5. **DynamoDB item size** — Game records with 768d embeddings are ~10–15KB each, well under the 400KB limit.
6. **Discovery staleness** — Game announcements may change between now and PAX East. Mitigation: re-run discover periodically; Tier 3 results have timestamps.

---

## Definition of Done (Phase 1)

- `packages/core` — Game + exhibitor types, taxonomy constants, exported and tested
- `packages/data-pipeline` — Full pipeline (scrape → discover → enrich → classify → embed → load) runs end-to-end
- DynamoDB Games + Exhibitors tables populated
- Game browsing page with filtering by type and tags
- Exhibitor browsing page with kind filters and linked games
- Game and exhibitor detail pages
- Hybrid search returning relevant results
- Local tracking (watchlist/played) persisted in localStorage
- My Games page
- Deployed to AWS via SST
- `just ci` passes (lint + typecheck + tests)
