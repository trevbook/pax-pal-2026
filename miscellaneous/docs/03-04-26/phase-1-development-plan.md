# Phase 1 Development Plan — Data + Core

**Date**: March 4, 2026
**Goal**: Scraping pipeline through deployed browsable app

---

## Execution Order

The work breaks into 4 stages with clear dependency chains. Stages 1-2 (data) unblock Stage 3 (infra), which unblocks Stage 4 (frontend). Within each stage, steps are sequential unless noted.

```
Stage 1: Foundation    Stage 2: Pipeline        Stage 3: Infra       Stage 4: Frontend
─────────────────────   ───────────────────────   ──────────────────   ──────────────────
packages/core           Scrape (cheerio)          DynamoDB tables      Game browsing
  └─ Game schema        Harmonize (fuzzy match)   Load script          Game detail page
  └─ Taxonomy consts    Enrich (BGG + LLM)        SST deploy           Search (hybrid)
                        Classify (LLM)                                 Local tracking
                        Embed (Gemini)                                 My Games page
```

---

## Stage 1: Foundation (`packages/core`) — COMPLETE

**Time estimate: half a day**

The shared types package is the dependency root for everything else. Both the data pipeline and the frontend will import from here.

### 1.1 Scaffold `packages/core`

Follow the dev agent scaffolding guide in `.claude/agents/dev.md`:

```
packages/core/
├── README.md
├── package.json        # @pax-pal/core
├── tsconfig.json
└── src/
    ├── index.ts        # Barrel re-exports (types, constants, utils)
    ├── index.test.ts   # 15 smoke tests (taxonomy, slugs, type shapes)
    ├── game.ts         # Game type + pipeline stage types
    ├── taxonomy.ts     # Tag/genre/mechanic constants
    └── utils.ts        # Slug generation (toSlug)
```

### 1.2 Define the Game type

> **Implemented in**: `packages/core/src/game.ts`

Went with flat interfaces and nullable video game / tabletop fields as planned. Four staged types are exported:

- `RawExhibitor` — scrape output for exhibitors + tabletop pages. Includes `sourcePage: "exhibitors" | "tabletop"` discriminator.
- `RawDemo` — scrape output for demos. Carries `exhibitorId` for harmonization matching.
- `HarmonizedGame` — post-merge, pre-enrichment. Adds `demoId` to track which demo entry was linked. Carries `sourcePages` array to track provenance.
- `Game` — final enriched record. All fields from the vision doc schema, including `embedding: number[] | null`.

`GameType` is a derived type (`"video_game" | "tabletop" | "both"`), not an enum — keeps it simple and avoids enum import issues.

### 1.3 Define taxonomy constants

> **Implemented in**: `packages/core/src/taxonomy.ts`

All constants use `as const` arrays with derived types. The full set:

| Constant | Count | Type |
|---|---|---|
| `GAME_TYPES` | 3 | `GameType` |
| `PLATFORMS` | 6 | `Platform` |
| `VIDEO_GAME_GENRES` | 14 | `VideoGameGenre` |
| `TABLETOP_MECHANICS` | 7 | `TabletopMechanic` |
| `AUDIENCE_TAGS` | 5 | `AudienceTag` |
| `BUSINESS_TAGS` | 4 | `BusinessTag` |
| `OTHER_TAGS` | 3 | `OtherTag` |
| `ALL_TAGS` | 33 | `Tag` (union of all above) |

**Deviation**: The vision doc listed "Co-op" in both `TABLETOP_MECHANICS` and `AUDIENCE_TAGS`. Since `ALL_TAGS` is a flat spread of all categories and must be duplicate-free, the tabletop mechanic was renamed to `"Co-op Play"`. The audience tag remains `"Co-op"`. The classify stage should map raw "co-op" signals to the appropriate one based on context (mechanic vs audience).

### 1.4 Validation

> **Status**: Passing — `bun run lint && bun run typecheck && bun test` all green.

15 smoke tests in `packages/core/src/index.test.ts` cover:
- Taxonomy constant values and no-duplicates invariant on `ALL_TAGS`
- `toSlug()` edge cases (special chars, leading/trailing hyphens, empty string)
- Type compatibility (constructing valid instances of all four pipeline types)

**tsconfig note**: The child `tsconfig.json` must explicitly set `"exclude": ["node_modules", "dist"]` to override the root tsconfig's `"exclude": ["packages"]` — otherwise tsc sees no input files. This applies to all future workspace packages too.

---

## Stage 2: Data Pipeline (`packages/data-pipeline`) — SCRAPE & HARMONIZE COMPLETE

**Time estimate: 2-3 days (biggest chunk of Phase 1)**

> **Status**: Steps 2.0–2.2 complete (scaffold, scrape, harmonize). Steps 2.3–2.7 (enrich, classify, embed, load, testing beyond scrape/harmonize) remain.

### 2.0 Scaffold `packages/data-pipeline`

```
packages/data-pipeline/
├── README.md
├── package.json         # @pax-pal/data-pipeline
├── tsconfig.json
└── src/
    ├── index.ts
    ├── scrape/
    │   ├── exhibitors.ts
    │   ├── demos.ts
    │   ├── tabletop.ts
    │   └── fetch-html.ts
    ├── harmonize/
    │   └── harmonize.ts
    ├── enrich/
    │   ├── bgg.ts
    │   └── llm.ts
    ├── classify/
    │   └── classify.ts
    ├── embed/
    │   └── embed.ts
    ├── load/
    │   └── load.ts
    └── cli.ts            # Entry point: bun run src/cli.ts [stage]
```

Dependencies installed (Phase 1):

- `cheerio` — HTML parsing
- `@pax-pal/core` — shared types

Dependencies deferred (for later stages):

- `@google/generative-ai` — Gemini API (embeddings + classification + enrichment)
- `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` — DynamoDB writes

**Deviation from plan**: The `scrape/tabletop.ts` file was not created as a separate module. Since the tabletop page shares the exact same HTML structure as the main exhibitors page (both use `div.exhibitor-entry[data-id]` with identical inner markup), a single `parseExhibitorPage(html, source)` function handles both. The `source` parameter (`"exhibitors" | "tabletop"`) disambiguates provenance. This avoids code duplication.

### 2.1 Scrape Stage

**Input**: HTML files (local from `miscellaneous/html/` or fetched live)
**Output**: `miscellaneous/data/01-scraped/exhibitors.json`, `demos.json`, `tabletop.json`

Parse the three PAX pages using cheerio. Based on the sample HTML analysis:

**Exhibitors** (`sample-expo-hall-exhibitors.html`):

- Entries have `data-id`, `data-exhib-full-name`, `data-name` (slug), `data-is-featured`
- Booth location in `.premBoothLocation` or similar elements
- Tags encoded as CSS classes (e.g., `cat-tabletop`, `tag-rpg`)
- Logo image in `background-image` style on `.gtSpecial-image` or `<img>` tags
- Showroom link: `/en-us/expo-hall/showroom.html?gtID={id}&exhibitor-name={name}`
- Description text in `.premDesc` or exhibitor content area (often truncated)

**Demos** (`sample-demos.html`):

- Entries have `data-id`, `data-button-text` (game name), `data-exhib-full-name` (exhibitor), `data-exhibitor-id`
- Already have `data-exhibitor-id` linking to exhibitor — this is huge for harmonization
- Image via `background-image` on `.gtSpecial-image`
- Description text in the entry content area
- Class `data-special-type="exclusive"` marks them as demos

**Tabletop** (`sample-tabletop-exhibitors.html`):

- Same structure as exhibitors but with showroom links to `/tabletop-expo-hall/showroom.html`
- Will have tabletop-specific tags

Implementation notes:

- Write a generic `parseExhibitorPage(html, source)` function since exhibitors and tabletop share structure
- Write a separate `parseDemoPage(html)` for demos
- Support both local file paths and URLs as input (for re-running against live site)
- Store raw parsed output as JSON with `lastScrapedAt` timestamps

> **Implemented in**: `packages/data-pipeline/src/scrape/`
>
> **Results** (from local sample HTML, March 3 snapshot):
> - Exhibitors: **345** entries parsed
> - Demos: **109** entries parsed
> - Tabletop: **42** entries parsed
>
> **HTML structure findings**:
> - **Exhibitors**: Outer `div.exhibitor-entry[data-id]` with `data-exhib-full-name`, `data-is-featured`. Tags encoded as CSS classes (`tag-Action`, `cat-Tabletop`). Booth in `.exhibitor-location`. Image in `.gtImageArea img`. Showroom link on `a.gtExhibitorLink`. Description in `.exhibitor-description` (truncated with `…` link).
> - **Demos**: Outer `div.gt-entry[data-id]` with inner `a.artist-modal-link` carrying `data-button-text` (game name), `data-exhib-full-name` (exhibitor), and `data-exhibitor-id` (key for harmonization). Image via `background-image` CSS on `.gtSpecial-image`. No inline description in list view.
> - **Tabletop**: Identical structure to exhibitors. Showroom links point to `/tabletop-expo-hall/showroom.html` instead of `/expo-hall/showroom.html`. All entries carry `cat-Tabletop` class.
>
> **Key discovery**: The `data-exhibitor-id` on demos directly maps to exhibitor `data-id`, making exact-match harmonization possible (no fuzzy matching needed).

### 2.2 Harmonize Stage

**Input**: The three JSON files from scrape
**Output**: `miscellaneous/data/02-harmonized/games.json`

Merge the three sources into a unified list of `HarmonizedGame` objects:

1. **Start with exhibitors** as the base set (they have the most metadata)
2. **Match demos to exhibitors** using `data-exhibitor-id` (discovered in HTML — the demos page already has this field, so fuzzy matching may not even be necessary for most entries)
3. **Merge tabletop entries** — these are a subset of exhibitors. Match by `data-id`. When matched, set `type: "tabletop"` or `type: "both"` (if exhibitor also has a demo)
4. **Assign initial types**:
  - Has demo + not tabletop → `"video_game"`
  - In tabletop list or has tabletop tags → `"tabletop"`
  - Has both demo and tabletop signals → `"both"`
  - No demo, no tabletop → leave as `"video_game"` (default, may be corrected during enrichment)
5. **Deduplicate** by `data-id`
6. **Flag unmatched** demos (no exhibitor match) for manual review → `miscellaneous/data/02-harmonized/unmatched.json`

Key consideration: the harmonization step assigns a stable `id` (the PAX `data-id`) that becomes the primary key throughout the system. Every downstream step references this ID.

> **Implemented in**: `packages/data-pipeline/src/harmonize/harmonize.ts`
>
> **Results**:
> - **346 games** harmonized (345 exhibitors + 1 tabletop-only entry not in main exhibitor list)
> - **0 unmatched demos** — every demo matched to its exhibitor via `data-exhibitor-id`. Fuzzy matching was planned but turned out unnecessary.
> - **Type breakdown**: 217 video games, 125 tabletop, 4 both
> - **59 games** have associated demo entries
> - **7 featured** exhibitors
>
> **Algorithm**:
> 1. Seed from exhibitors (one `HarmonizedGame` per entry, keyed by `data-id`)
> 2. Merge tabletop entries by ID — adds `"tabletop"` to `sourcePages`, merges tags, updates type
> 3. Match demos via `exhibitorId` — sets `demoId`, adds `"demos"` to `sourcePages`, fills missing image/description
> 4. Type resolution: tabletop signal + demo signal → `"both"`, tabletop signal only → `"tabletop"`, else `"video_game"`
>
> **Deviation**: Step 5 ("Deduplicate by data-id") was unnecessary — the Map-based approach inherently deduplicates. Step 3 from the plan ("Merge tabletop entries by data-id → set type both") was refined: tabletop entries that *also* have demos get `"both"`, but most tabletop-only entries correctly get `"tabletop"`.
>
> **Tabletop type detection**: Games are classified as tabletop based on two signals: (1) presence on the tabletop page, or (2) having the `Tabletop` CSS class tag. This catches the 42 tabletop-page entries plus an additional ~83 exhibitors from the main page that carry tabletop tags (e.g., `tag-Tabletop`, `cat-Tabletop`).

### 2.3 Enrich Stage

**Input**: `games.json` from harmonize
**Output**: `miscellaneous/data/03-enriched/games.json`

Two enrichment paths:

**BGG enrichment (tabletop games)**:

- For each game where `type === "tabletop" || type === "both"`:
  1. Search BGG: `GET https://boardgamegeek.com/xmlapi2/search?query={name}&type=boardgame`
  2. Parse XML response, pick best match (fuzzy name match + prioritize exact matches)
  3. Fetch details: `GET https://boardgamegeek.com/xmlapi2/thing?id={bggId}&stats=1`
  4. Extract: `playerCount`, `playTime`, `complexity` (weight), `mechanics`, description, image
- Rate limit: throttle to ~1 req/sec (BGG is lenient but no need to hammer)
- Cache BGG responses locally to `miscellaneous/data/cache/bgg/` for re-runs

**LLM enrichment (all games)**:

- For each game, use Gemini (with web search grounding if available) to fill:
  - Full description (if PAX truncated it)
  - A snappy 1-2 sentence `summary`
  - Image URL (Steam header, publisher site, etc.)
  - Video game fields: platforms, genres, release status, Steam URL
  - Any tabletop fields that BGG didn't cover
- Use structured output (JSON mode) to ensure consistent format
- Process in batches to manage API costs and rate limits
- Skip games that already have complete data (for re-runs)

**Important**: Enrichment results are written back to `games.json` incrementally. If the process crashes partway through, re-running picks up where it left off (check `enrichedAt` timestamp).

### 2.4 Classify Stage

**Input**: Enriched `games.json`
**Output**: `miscellaneous/data/04-classified/games.json`

Use Gemini structured output to assign taxonomy labels:

- Feed each game's name + description + existing tags to the LLM
- Request structured output matching the taxonomy constants from `@pax-pal/core`
- Validate output against allowed values
- Overwrite `tags` field with normalized taxonomy labels
- Preserve original PAX tags in `paxTags`

Could potentially be combined with the enrich step (single LLM call does both), but keeping them separate makes debugging easier and allows re-running classification without re-enriching.

### 2.5 Embed Stage

**Input**: Classified `games.json`
**Output**: `miscellaneous/data/05-embedded/games.json` (games with `embedding` field populated)

- For each game, concatenate: `name + " " + summary + " " + tags.join(", ") + " " + description`
- Call Gemini `gemini-embedding-001` to generate 768d vector
- Store embedding as `number[]` on the game object
- Batch embedding calls (Gemini supports batch embedding — check API for batch size limits)
- Skip games that already have embeddings (unless description changed since last embed)

### 2.6 CLI Runner

The entry point for the pipeline. Supports running all stages or individual stages:

```bash
# Run full pipeline
bun run src/cli.ts all

# Run individual stages
bun run src/cli.ts scrape
bun run src/cli.ts harmonize
bun run src/cli.ts enrich
bun run src/cli.ts classify
bun run src/cli.ts embed

# Use local HTML files (default) or fetch live
bun run src/cli.ts scrape --source local
bun run src/cli.ts scrape --source live
```

Add `package.json` scripts for convenience:

```json
{
  "scripts": {
    "pipeline": "bun run src/cli.ts all",
    "scrape": "bun run src/cli.ts scrape",
    "harmonize": "bun run src/cli.ts harmonize",
    "enrich": "bun run src/cli.ts enrich",
    "classify": "bun run src/cli.ts classify",
    "embed": "bun run src/cli.ts embed"
  }
}
```

### 2.7 Testing

Write tests for the pure-logic parts:

- `scrape/*.test.ts` — parse a known HTML snippet, assert correct field extraction
- `harmonize/harmonize.test.ts` — given known exhibitors + demos, assert correct merging and type assignment
- Enrich/classify/embed are harder to unit test (external API calls) — consider snapshot tests with mocked responses

> **Status**: 25 tests passing across 3 test files.
>
> - `scrape/exhibitors.test.ts` — 10 tests: field extraction (id, name, slug, booth, description, image, showroom URL, featured status, PAX tags, timestamps) from synthetic HTML
> - `scrape/demos.test.ts` — 7 tests: demo parsing (id, game name, exhibitor name/id, background-image extraction, timestamps)
> - `harmonize/harmonize.test.ts` — 8 tests: exhibitor-to-game conversion, demo matching via exhibitorId, unmatched demo reporting, tabletop merging, `"both"` type resolution, tabletop-only entries, image fallback from demos

---

## Stage 3: Infrastructure

**Time estimate: half a day**

### 3.1 DynamoDB Tables (SST)

Add to `infra/database.ts`:

```typescript
export const gamesTable = new sst.aws.DynamoTable("Games", {
  fields: { pk: "string", type: "string", name: "string", boothId: "string" },
  primaryIndex: { hashKey: "pk" },
  globalIndexes: {
    byType: { hashKey: "type", rangeKey: "name" },
    byBooth: { hashKey: "boothId" },
  },
});
```

For Phase 1, we only need the **Games table**. Users/Comments/Stats tables come in Week 2.

Wire into `sst.config.ts` and pass the table name to the Next.js app as an environment variable.

### 3.2 Load Script

Add `packages/data-pipeline/src/load/load.ts`:

- Read the fully processed `games.json` (with embeddings)
- Batch-write to DynamoDB using `BatchWriteItem` (25 items per batch)
- PK format: `GAME#{id}`
- Include all game fields + embedding array
- Handle conditional puts for re-runs: skip if item exists and `lastScrapedAt` hasn't changed
- Log: items written, items skipped, items with changes flagged

The load script needs the DynamoDB table name — read from environment variable or CLI arg.

### 3.3 Initial Deploy

- Run `sst deploy --stage dev` to create the DynamoDB table
- Run the load script against the dev table
- Verify data in AWS Console / DynamoDB

### 3.4 Wire Frontend to DynamoDB

Update `infra/frontend.ts` to link the games table:

```typescript
export const frontend = new sst.aws.Nextjs("www", {
  path: "apps/www",
  link: [gamesTable],
  environment: secrets,
});
```

This gives the Next.js server actions access to the table via SST's resource linking.

---

## Stage 4: Frontend

**Time estimate: 2-3 days**

### 4.1 Data Access Layer

Create `apps/www/lib/games.ts` — server-side functions for reading game data:

```typescript
import { Resource } from "sst";

// Load all games (for browse + search)
export async function getAllGames(): Promise<Game[]> { ... }

// Get single game by ID
export async function getGameById(id: string): Promise<Game | null> { ... }

// Search games (text + semantic hybrid)
export async function searchGames(query: string): Promise<Game[]> { ... }
```

For `searchGames`:

- Load all games + embeddings into a module-level cache on first call
- Text search: simple case-insensitive substring match across name, description, tags, exhibitor
- Semantic search: embed the query using Gemini, compute cosine similarity against all game embeddings
- Combine scores: `0.7 * semantic + 0.3 * text` (normalized)
- Return top N results

The Gemini API key needs to be available server-side — add as an SST secret or environment variable.

### 4.2 Game Browsing Page (`/games`)

**Route**: `apps/www/app/games/page.tsx`

Server component that fetches all games and renders a filterable grid:

- **Game cards**: name, image, type badge, summary, booth, top 3 tags
- **Filters** (client component): type toggle (All / Video Games / Tabletop), tag multi-select, search input
- **Sorting**: name (A-Z), booth number
- **Pagination**: start with client-side pagination (load all ~300 games, paginate in the browser). If performance is fine, no need for server pagination at this scale.

Use shadcn components: `Card`, `Badge`, `Input`, `Select`, `Tabs`

### 4.3 Game Detail Page (`/games/[slug]`)

**Route**: `apps/www/app/games/[slug]/page.tsx`

Server component with dynamic route:

- Hero section: image, name, type badge, exhibitor, booth
- Full description
- Metadata section: platforms/genres (video games) or player count/time/mechanics (tabletop)
- Tags as badges
- Link to PAX showroom page
- **Placeholder sections** for Week 2: watchlist/played buttons, community stats, comments (render empty states with "coming soon" or just omit)

Use `generateStaticParams` to pre-render all game pages at build time (good performance, works offline).

### 4.4 Search Page (`/search`)

**Route**: `apps/www/app/search/page.tsx`

- Search input (client component) that calls a server action
- Server action embeds the query and returns hybrid-ranked results
- Results rendered as game cards (reuse the card component from browse page)
- Show result count and which mode matched ("semantic match", "text match")
- Empty state for no results

Alternatively, integrate search directly into the browse page as a mode switch — might be cleaner UX.

### 4.5 Local Tracking (Watchlist / Played)

**Client-side only** — no server interaction needed for Phase 1.

Create a React context + localStorage hook:

```
apps/www/lib/tracking.tsx     # TrackingProvider context
apps/www/hooks/use-tracking.ts  # Hook for components
```

State shape in localStorage:

```json
{
  "watchlist": ["646038", "648079", ...],
  "played": ["646038", ...],
  "ratings": { "646038": 4 }
}
```

Actions:

- `addToWatchlist(gameId)` / `removeFromWatchlist(gameId)`
- `markPlayed(gameId)` / `unmarkPlayed(gameId)`
- `rateGame(gameId, score)` — only available if played

Surface in UI:

- Buttons on game detail page: "Add to Watchlist" / "Mark as Played"
- Visual indicator on game cards (small icon) if watchlisted or played

### 4.6 My Games Page (`/my-games`)

**Route**: `apps/www/app/my-games/page.tsx`

Client component that reads from localStorage:

- Two tabs: Watchlist / Played
- Render game cards (need to resolve game IDs to full game objects — either embed game data in localStorage or fetch from server)
- Stats: X watchlisted, Y played, Z rated
- Empty state: "You haven't added any games yet — browse the expo hall to get started"

### 4.7 Navigation & Layout

Update `apps/www/app/layout.tsx`:

- Add a top nav bar: PAX Pal logo/name, links to Browse, Search, My Games
- Mobile-responsive (hamburger menu on small screens)
- PAX East branding / colors

---

## Risk Items

1. **BGG rate limits** — If BGG throttles aggressively, enrichment could take a while for ~100+ tabletop games. Mitigation: cache responses, batch conservatively, fall back to LLM-only if BGG is down.
2. **Gemini API quotas** — Enriching + classifying + embedding ~300 games is a lot of API calls. Check free tier limits for `gemini-embedding-001` and whatever model is used for enrichment. Mitigation: process incrementally, cache intermediate results.
3. **PAX HTML structure changes** — The sample HTML was saved on a specific date. If PAX updates their page structure, scrapers may break. Mitigation: scraper tests against known HTML, re-download samples if structure changes.
4. **DynamoDB item size** — Each game with a 768d embedding (~~6KB as JSON numbers) plus all metadata could approach the 400KB DynamoDB item limit. Should be fine (~~10-15KB per item total), but worth monitoring. Could store embeddings as a binary attribute (more compact) if needed.
5. **Cold start latency** — Loading all ~300 games + embeddings on server cold start. At ~15KB per item, that's ~4.5MB total. DynamoDB scan should return this in under 1 second. Cache in a module-level variable to avoid re-scanning on subsequent requests.

---

## Definition of Done (Phase 1)

- `packages/core` — Game types, taxonomy constants, exported and tested
- `packages/data-pipeline` — Full pipeline runs end-to-end, producing enriched + embedded game data
- DynamoDB Games table populated with ~300 games including embeddings
- Game browsing page with filtering by type and tags
- Game detail pages for all games
- Hybrid search (text + semantic) returning relevant results
- Local tracking (watchlist / played) persisted in localStorage
- My Games page showing tracked games
- Deployed to AWS via SST, accessible at a public URL
- `just ci` passes (lint + typecheck + tests)

