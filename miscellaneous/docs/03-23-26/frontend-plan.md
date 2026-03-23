# Frontend Implementation Plan — Stage 4

**Date**: March 23, 2026
**Goal**: Build the PAX Pal 2026 frontend per the UI spec
**Design spec**: [`ui-spec.md`](../03-22-26/ui-spec.md)
**Vision doc**: [`vision-2026.md`](../03-03-26/vision-2026.md) (Tier 1 = MVP, Tier 2-3 = future)
**Parent plan**: [`development-plan.md`](../03-18-26/development-plan.md) (Stage 4)

---

## How to Use This Document

This is a **living document**. When working on any stage below:

1. Update the status summary table as stages begin and complete.
2. Add **implementation notes** under each stage after completing it — record deviations from the plan, key decisions, files created/modified, and anything the next person needs to know.
3. If a stage's scope changes during implementation, update the plan section *and* note what changed and why.
4. When referencing the UI spec, don't duplicate its content — point to the relevant screen number.

The goal is that any future Claude (or human) picking up this plan can read the status table, find the next incomplete stage, and have enough context to start working immediately.

---

## Status Summary

| Stage | Status | Notes |
|-------|--------|-------|
| 1. App Scaffold & Layout | ✅ Complete | Routing, nav, theme, metadata |
| 2. Data Layer & Shared Components | ✅ Complete | DynamoDB access, GameCardData, reusable components |
| 3. Game Catalogue | ✅ Complete | `/games` — browse + filter |
| 4. Game Detail & Tracking | ✅ Complete | `/games/[slug]` + localStorage tracking system |
| 5. My Games | 📋 Planned | `/my-games` — personal tracking hub |
| 6. Search | 📋 Planned | `/search` — hybrid text + semantic |
| 7. Expo Hall Map | 📋 Planned | `/map`, `/map/[boothId]` + booth data pipeline |
| 8. Home & Polish | 📋 Planned | `/` dashboard + loading/error/offline states |

### Scope Boundaries

**In scope (MVP — vision Tier 1):**
- Screens 1–7 from the UI spec (Home, Catalogue, Detail, Search, My Games, Map, Map Highlight)
- localStorage-only tracking (watchlist, played, ratings)
- Report Issue modal (Screen 3) — writes to DynamoDB, no admin UI

**Out of scope (future — vision Tier 2/3):**
- Exhibitor Catalogue & Detail (Screens 8–9) — nice-to-have, build if time permits after Stage 8
- Public Profiles (Screen 10) — requires username claims + cloud sync (vision F6/F7)
- AI Chat (Screen 11) — stretch goal, deferred
- Comments / Ratings synced to cloud — requires social layer
- Community stats on game pages — requires social layer

---

## Stage 1: App Scaffold & Layout

**Goal**: Replace the default Next.js boilerplate with the app shell. After this stage, all routes exist (as stubs) and the global layout is in place.

**Depends on**: Nothing — first stage.

### Tasks

1. **Update root layout** (`apps/www/app/layout.tsx`)
   - Set metadata: title "PAX Pal 2026", description, viewport for mobile
   - Configure fonts (keep Geist or switch — designer's call)
   - Add a Tailwind dark mode class strategy if desired
   - Wrap children in the app shell (header + bottom nav + main content area)

2. **Bottom navigation bar** (new component)
   - Five tabs: Home, Games, Search, Map, My Games
   - Icons + labels, active state highlighted
   - Sticky bottom, 56px height, safe-area padding for notched phones
   - Badge on My Games tab (count from localStorage — wired in Stage 4)
   - See UI spec: Global Navigation & Layout

3. **Top header** (new component)
   - "PAX Pal" wordmark, left-aligned
   - Minimal — no hamburger, no secondary nav

4. **Route stubs** — create placeholder pages:
   - `/games` → `apps/www/app/games/page.tsx`
   - `/games/[slug]` → `apps/www/app/games/[slug]/page.tsx`
   - `/search` → `apps/www/app/search/page.tsx`
   - `/my-games` → `apps/www/app/my-games/page.tsx`
   - `/map` → `apps/www/app/map/page.tsx`
   - `/map/[boothId]` → `apps/www/app/map/[boothId]/page.tsx`

5. **Responsive breakpoints** — confirm Tailwind config supports the spec's mobile-first constraints (375px min width, single-column mobile, 2-col tablet, 3-col desktop for card grids)

6. **Theme / global styles** — update `globals.css` with brand colors, shadcn theme tokens

### Files to create
```
apps/www/app/
├── games/
│   ├── page.tsx              (stub)
│   └── [slug]/page.tsx       (stub)
├── search/page.tsx           (stub)
├── my-games/page.tsx         (stub)
├── map/
│   ├── page.tsx              (stub)
│   └── [boothId]/page.tsx    (stub)
apps/www/components/
├── bottom-nav.tsx
├── top-header.tsx
```

### Files to modify
```
apps/www/app/layout.tsx       (replace boilerplate)
apps/www/app/page.tsx         (replace boilerplate with home stub)
apps/www/app/globals.css      (theme tokens, brand colors)
```

### Implementation notes

**Completed 2026-03-23.**

- **Layout**: Replaced boilerplate `layout.tsx` with app shell: `TopHeader` + `<main>` + `BottomNav`. Main content area uses `min-h-[calc(100dvh-theme(spacing.12)-theme(spacing.14))]` and `pb-14` to account for the fixed bottom nav.
- **Metadata**: Set title "PAX Pal 2026", description, and viewport (`device-width`, `viewportFit: cover` for notched phones). Exported `viewport` as a separate constant per Next.js 16 convention.
- **Fonts**: Kept Geist Sans + Geist Mono from the scaffold — no reason to change.
- **TopHeader** (`components/top-header.tsx`): Sticky, 48px height, "PAX Pal" wordmark left-aligned. Uses `backdrop-blur-sm` for a translucent effect on scroll.
- **BottomNav** (`components/bottom-nav.tsx`): Client component. Five tabs (Home, Games, Search, Map, My Games) using lucide-react icons. Active tab determined by `usePathname()` — exact match for `/`, prefix match for others. Fixed bottom with `pb-[env(safe-area-inset-bottom)]` for notched phones. 56px (h-14) height.
- **Route stubs**: All 6 route stubs created with simple heading + placeholder text. Dynamic routes (`[slug]`, `[boothId]`) use Next.js 16's `params: Promise<{...}>` pattern with `await`.
- **Theme**: No brand color changes yet — kept shadcn defaults (neutral). Brand colors can be tuned in Stage 8 (Polish) or earlier if a designer provides them.
- **Responsive breakpoints**: Tailwind v4 defaults cover the spec's needs (sm: 640px, md: 768px, lg: 1024px). The 375px min-width constraint is handled naturally by mobile-first CSS.
- **Deviations**: None significant. The plan mentioned a `BottomSheet` component — that's deferred to Stage 2 per the plan.

---

## Stage 2: Data Layer & Shared Components

**Goal**: Build the server-side data fetching utilities and all shared UI components referenced across multiple screens. After this stage, we can render game cards with real data.

**Depends on**: Stage 1 (layout exists). Also requires the Games and Exhibitors DynamoDB tables to be deployed and loaded (Stage 3 of the parent plan — already complete).

### Tasks

#### Data layer

1. **DynamoDB client utilities** (new module, e.g. `apps/www/lib/db.ts`)
   - Initialize DynamoDB document client via SST resource linking
   - `getAllActiveGames()` — scan Games table, filter `status === "active"`, project to `GameCardData` (exclude `embedding` and other heavy fields)
   - `getGameBySlug(slug)` — query by slug (may need a GSI or scan+filter — evaluate)
   - `getGamesByExhibitor(exhibitorId)` — query Games table filtering by `exhibitorId`
   - `getGamesByBooth(boothId)` — query via `byBooth` GSI
   - `getExhibitorById(id)` — get single exhibitor
   - All queries must filter `status === "active"`

2. **`GameCardData` type** (new type in `@pax-pal/core` or locally in `apps/www`)
   - Subset of `Game` for card rendering — see UI spec "GameCardData Projection"
   - Fields: `id`, `name`, `slug`, `type`, `summary`, `imageUrl`, `exhibitor`, `exhibitorId`, `boothId`, `isFeatured`, `tags`, `genres`, `tabletopGenres`, `mechanics`, `platforms`, `releaseStatus`, `discoverySource`
   - Server components project the full `Game` → `GameCardData` before passing to client components

3. **Server data fetching pattern** — decide and document: server components call DB directly (preferred for SSG/ISR), or server actions, or API routes. Recommendation: direct DB calls in server components for read paths, server actions for writes (reports).

#### Shared components

4. **`GameCard`** — standard and compact variants
   - Image, name, exhibitor, booth, summary (2-line clamp), tag chips (top 3), type badge, tracking indicators
   - See UI spec: Game Card under Screen 2
   - Entire card is a link to `/games/[slug]`

5. **`TypeBadge`** — small colored badge (blue = video game, green = tabletop, dual = both)

6. **`TagChip`** — small rounded label for genres/mechanics/tags. Used on cards and detail pages.

7. **`formatBoothDisplay` utility** — see UI spec: Booth Display Formatting
   - Input: `boothId` string | null
   - Output: `{ label: string; href: string | null }` (null = hidden)

8. **`BottomSheet`** — reusable sheet component (map booth tap, report modal). Check if shadcn's `Drawer` or `Sheet` component covers this.

9. **Image fallback** — wrapper around `next/image` with fallback chain: game image → exhibitor logo → type-based placeholder (controller icon / dice icon)

### Files to create
```
apps/www/lib/db.ts                     (DynamoDB client + query functions)
apps/www/lib/game-card-data.ts         (GameCardData type + projection helper)
apps/www/lib/format-booth.ts           (formatBoothDisplay)
apps/www/components/game-card.tsx
apps/www/components/type-badge.tsx
apps/www/components/tag-chip.tsx
apps/www/components/game-image.tsx     (image with fallback)
```

### Implementation notes

**Completed 2026-03-23.**

- **Dependencies added**: `@pax-pal/core` (workspace), `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `sst`, `server-only` added to `apps/www/package.json`.
- **Data layer** (`lib/db.ts`): Server-only module using SST `Resource` linking to resolve table names at runtime. DynamoDB DocumentClient singleton. Five query functions: `getAllActiveGames()` (scan + filter active → GameCardData[]), `getGameBySlug(slug)` (scan + filter — no slug GSI, acceptable at ~395 items), `getGamesByExhibitor(exhibitorId)` (scan + filter), `getGamesByBooth(boothId)` (QueryCommand on `byBooth` GSI), `getExhibitorById(id)` (GetCommand by PK `EXHIBITOR#{id}`). All game queries filter `status === "active"`.
- **Data fetching pattern**: Direct DynamoDB calls in server components for read paths (as recommended by the plan). Server actions for writes will be added in Stage 4 (reports).
- **`GameCardData`** (`lib/game-card-data.ts`): Interface + `toGameCardData()` projection function. The `discoverySource` field is accessed dynamically via `"discoverySource" in game` since it exists on `HarmonizedGame` but hasn't been added to the `Game` interface yet — DynamoDB items may carry it through from the pipeline. This should be formalized when `discoverySource` is added to `Game`.
- **`formatBoothDisplay`** (`lib/format-booth.ts`): Covers all `boothId` formats from the UI spec: numeric → "Booth 15043", TT-prefix → "Table TT29A", comma-separated → "Booths 18019, 18031, NL2", "Tabletop Hall" → literal, UNSPECIFIED/null → returns `null` (hidden). Each format returns the appropriate `/map` href.
- **`TypeBadge`** (`components/type-badge.tsx`): Server component. Blue for video game, green for tabletop, gradient for "both". Uses semantic colors with dark mode variants.
- **`TagChip`** (`components/tag-chip.tsx`): Server component. Muted border + background, rounded pill style.
- **`GameImage`** (`components/game-image.tsx`): Client component. Uses `next/image` with `fill` + `object-cover`. Fallback chain: imageUrl → placeholder with type-based icon (Gamepad2 for video games, Dice5 for tabletop). Exhibitor logo fallback deferred — requires exhibitor data on the card, which would widen the GameCardData type; can add in Stage 4 when detail pages have exhibitor context.
- **`GameCard`** (`components/game-card.tsx`): Server component with two variants via `compact` prop. Standard variant: 16:9 image, type badge overlay, "Unverified" indicator for low-confidence discovery sources, title + exhibitor + booth, 2-line summary clamp, up to 3 tag chips (priority: genres → mechanics → business tags → audience tags, style tags skipped per spec). Compact variant: 64px thumbnail + single-line title/subtitle, used for lists (My Games, booth sheets). Entire card is a link to `/games/[slug]`. Low-confidence games get dashed borders.
- **BottomSheet**: Confirmed shadcn's `Drawer` component (backed by `vaul`) is already installed at `components/ui/drawer.tsx`. No custom wrapper needed — stages that need bottom sheets (Stage 3 filter bar, Stage 7 map booth tap) will use the Drawer directly.
- **Tracking indicators on GameCard**: Deferred to Stage 4 when the localStorage tracking system is built. The GameCard accepts `GameCardData` (server data only) — tracking indicators will be added via a client wrapper or composition pattern.
- **Deviations**: Exhibitor logo in the image fallback chain deferred (see GameImage note above). No new shadcn components needed beyond what's already installed.

---

## Stage 3: Game Catalogue

**Goal**: Build the `/games` page — the first real, data-driven screen. Exercises the full data layer and shared components from Stage 2.

**Depends on**: Stage 2 (data layer + GameCard + shared components).

**UI spec reference**: Screen 2 (Game Catalogue)

### Tasks

1. **Server component** (`apps/www/app/games/page.tsx`)
   - Fetch all active games via `getAllActiveGames()`, projected to `GameCardData`
   - Pass to client component for interactive filtering
   - SSG or ISR with 1-hour revalidation

2. **Client component** (`apps/www/components/game-catalogue.tsx` or similar)
   - **Type tabs**: `[ Video Games ] [ Tabletop ]` — sticky below header. No "All" tab. `type: "both"` games appear in both tabs.
   - **Filter bar**: text filter (client-side substring on name/exhibitor), tag/genre multi-select chips (distinct values from dataset), sort dropdown (Name A-Z, Booth Number)
   - Filter bar collapses to "Filters" button on mobile → bottom sheet
   - **Results count**: "Showing {n} video games" / tabletop games
   - **Game card grid**: single-col mobile, 2-col tablet, 3-col desktop

3. **Pagination / virtual scrolling**
   - Initial render: 20 cards, "Load more" button or intersection observer
   - All data already fetched (client-side pagination)

4. **Discovery confidence indicator** on cards — subtle "unverified" marker for `discoverySource` of `web_search` or `name_is_game`

### Key decisions to make during implementation
- Tag chip values: query distinct values at build time, or derive from the fetched dataset client-side?
- Booth sort comparator: follow the parsing rules in UI spec Screen 5 (sort-by-booth section)

### Implementation notes

**Completed 2026-03-23.**

- **Architecture**: Server component (`app/games/page.tsx`) fetches all active games via `getAllActiveGames()` and passes the `GameCardData[]` to a client component (`components/game-catalogue.tsx`) for interactive filtering. Option A from the spec — single scan, client-side tab switching (instant, no refetch).
- **ISR**: `revalidate = 3600` (1-hour ISR per spec).
- **Type tabs**: Custom sticky tab bar below the header (not shadcn Tabs — needed tighter control over sticky positioning + `top-12` to sit below the `TopHeader`). Video Games tab is default. `type: "both"` games appear in both tabs. Tab switch resets chip filters and pagination but preserves search text (per spec).
- **Filter bar**: Desktop (≥640px) shows inline search input + sort dropdown + genre/mechanic chips. Mobile (<640px) shows search input + "Filters" button that opens a `vaul` Drawer (bottom sheet) with sort + chips. Active filter count badge on the Filters button.
- **Genre/mechanic chips**: Derived client-side from the current tab's dataset (distinct values from `genres` for video games, `mechanics` for tabletop). Multi-select — games must match at least one selected chip (OR logic). Chips sorted alphabetically.
- **Sort**: "Name (A–Z)" (default) and "Booth Number" via shadcn Select. Booth sort uses `lib/sort-booth.ts` — a comparator implementing the spec's parsing rules (numeric → NL → TT/Tabletop Hall → null/UNSPECIFIED).
- **Pagination**: Client-side "Load more" button, 20 games per page. Shows "(N remaining)" count. Resets to 20 on filter/tab changes.
- **Results count**: "Showing N video games" / "Showing N tabletop games" — reflects active filters.
- **Empty state**: "No games found" message with "Try adjusting your filters" hint and clear-filters button.
- **Card grid**: 1-col mobile, 2-col tablet (`sm:`), 3-col desktop (`lg:`). Uses existing `GameCard` component (standard variant).
- **Tracking indicators on cards**: Deferred to Stage 4 (localStorage tracking system not yet built). Cards render server data only.
- **Files created**: `components/game-catalogue.tsx` (client component, ~360 lines), `lib/sort-booth.ts` (booth sort comparator, ~60 lines).
- **Files modified**: `app/games/page.tsx` (replaced stub with server component + ISR).
- **Key decisions**: Tag chip values derived client-side (simpler than build-time extraction, all data already loaded). Used custom tab buttons instead of shadcn Tabs for better sticky positioning control.
- **Deviations**: None from the plan. The spec's mention of intersection observer for pagination was simplified to a "Load more" button — simpler and adequate for ~280–130 items per tab.

---

## Stage 4: Game Detail & Tracking System

**Goal**: Build the `/games/[slug]` detail page and the localStorage tracking system that powers watchlist/played/ratings across the app.

**Depends on**: Stage 2 (shared components), Stage 3 (nice to have catalogue working first for navigation flow, but not strictly required).

**UI spec reference**: Screen 3 (Game Detail), Cross-Cutting Concerns (localStorage Schema)

### Tasks

#### Tracking system

1. **localStorage schema + hooks** (new module, e.g. `apps/www/lib/tracking.ts` + `apps/www/hooks/use-tracking.ts`)
   - Implement the `LocalTrackingData` interface from the UI spec
   - `useTracking(gameId)` hook: returns `{ isWatchlisted, isPlayed, rating, toggleWatchlist, togglePlayed, setRating }`
   - Store denormalized game card data alongside tracking state (Option A from spec — offline reliability)
   - `useTrackingStats()` hook: returns aggregate counts for My Games badge + progress bar

2. **Wire badge count** into bottom nav's My Games tab (from Stage 1)

#### Game detail page

3. **Server component** (`apps/www/app/games/[slug]/page.tsx`)
   - Fetch game by slug + sibling games by exhibitorId
   - SSG: generate all ~395 slugs at build time via `generateStaticParams`
   - 404 if slug not found or game is not active

4. **Client component(s)** for interactive elements:
   - **Action buttons** (sticky floating bar): Watchlist toggle, Played toggle, Rate (1-5 stars, inline expansion)
   - **"Find on Map" button**: conditional rendering + URL construction per `boothId` format (see UI spec Screen 3, item 4)
   - Haptic feedback on toggle (`navigator.vibrate` if supported)

5. **Page sections** (mostly server-rendered):
   - Hero image with fallback
   - Title block: name, type badge, exhibitor link, booth display, discovery badge
   - Description (full enriched text)
   - Metadata section — type-dependent (video game: platforms, genres, release status, Steam link; tabletop: player count, play time, complexity, mechanics, BGG link)
   - Full tag list as chips
   - Exhibitor card (inline): logo, name, booth, "N other games" link
   - External links
   - "Report Data Issue" link

6. **Report Issue modal**
   - Quick-select buttons (radio), optional free-text
   - Server action → DynamoDB put to Reports table
   - Rate-limit: 1 report per game per session (track in localStorage `reportedGameIds`)
   - Success toast
   - **Prerequisite**: Reports table in DynamoDB. May need to add to `infra/database.ts` — check if it exists.

### Key decisions to make during implementation
- Reports table: add to `infra/database.ts` and `infra/frontend.ts` (link), or defer reports to Stage 8?
- Exhibitor link target: `/games?exhibitor={exhibitorId}` for v1 (filtered catalogue), or build exhibitor pages now?

### Implementation notes

**Completed 2026-03-23.**

- **Reports table**: Added `Reports` DynamoDB table to `infra/database.ts` (simple PK: `REPORT#{gameId}#{timestamp}`) and linked it in `infra/frontend.ts`. No GSIs needed — reports are write-only in v1, reviewed via DynamoDB console.
- **Tracking system** (`lib/tracking.ts` + `hooks/use-tracking.ts`): Implements `LocalTrackingData` from the UI spec with `watchlist` and `played` maps plus `reportedGameIds` array. Uses `useSyncExternalStore` for cross-component reactivity (multiple components subscribe to the same localStorage-backed store). Cross-tab sync via `storage` event listener. `useTracking(game)` takes full game input (not just gameId) to denormalize game data on first add per spec Option A. `useTrackingStats()` provides aggregate counts (watchlist, played, totalTracked unique).
- **Badge count**: Wired `useTrackingStats().totalTracked` into `BottomNav`'s My Games tab. Shows a small pill badge with count (caps at "99+").
- **Toaster**: Added shadcn/sonner `<Toaster />` to root layout for success/error toasts (report submission).
- **Game detail server component** (`app/games/[slug]/page.tsx`): `generateStaticParams` generates all ~395 slugs at build time. `generateMetadata` provides per-game title/description. Fetches full game by slug + sibling games by `exhibitorId` + exhibitor data in parallel via `Promise.all`. Returns 404 via `notFound()` if slug not found or inactive.
- **Page sections** (all server-rendered): Hero image (full-width 16:9 with GameImage fallback), title block (name + TypeBadge + exhibitor link + booth display + discovery confidence badge), Find on Map button (conditional on `boothId`, uses `formatBoothDisplay` for href), full description, type-dependent metadata (video game: platforms with icons, genres, release status, Steam link; tabletop: player count, play time, complexity dots, mechanics, BGG link), full tag list, exhibitor card (logo/initial + name + booth + "N other games →" link), up to 3 sibling games as compact GameCards, external links (showroom, Twitter, Discord, YouTube, itch.io).
- **Action bar** (`components/action-bar.tsx`): Sticky floating bar above the bottom nav (z-40). Watchlist toggle (heart icon fills when active), Played toggle (checkmark), star rating (1-5, only visible after marking played, tap same star to clear). Haptic feedback via `navigator.vibrate(10)`.
- **Report modal** (`components/report-modal.tsx`): Uses shadcn Dialog. Five quick-select options (radio behavior), optional free-text (500 char max, required for "Other"). Server action submission via `app/games/[slug]/actions.ts`. Rate-limited: 1 report per game per session via `reportedGameIds` in localStorage — shows "You've already reported this game" if previously submitted. Success toast via sonner.
- **Client wrapper** (`components/game-detail-client.tsx`): Thin wrapper that provides `useTracking` state to ActionBar and ReportModal. Accepts minimal game data props from the server component.
- **Key decisions**: Reports table added now (not deferred). Exhibitor links go to `/games?exhibitor={exhibitorId}` (filtered catalogue view) — exhibitor pages are out of scope for MVP. `discoverySource` accessed dynamically via `"discoverySource" in game` (same pattern as Stage 2) since it's not yet on the `Game` interface.
- **Files created**: `lib/tracking.ts`, `hooks/use-tracking.ts`, `components/action-bar.tsx`, `components/game-detail-client.tsx`, `components/report-modal.tsx`, `app/games/[slug]/actions.ts`.
- **Files modified**: `app/games/[slug]/page.tsx` (replaced stub), `components/bottom-nav.tsx` (badge), `app/layout.tsx` (Toaster), `infra/database.ts` (Reports table), `infra/frontend.ts` (link Reports).
- **Deviations**: None significant. Press links section deferred — the `pressLinks` array on `Game` could be rendered but most games won't have them populated yet; can add in Stage 8 polish. Offline report queueing (spec mentions `pendingReports` in localStorage) deferred to Stage 8 — current implementation shows an error toast on failure.

---

## Stage 5: My Games

**Goal**: Build the `/my-games` page — the personal tracking hub.

**Depends on**: Stage 4 (tracking system + localStorage populated by interacting with game detail pages).

**UI spec reference**: Screen 5 (My Games)

### Tasks

1. **Progress section** — played/watchlisted ratio bar, summary stats. Only renders if user has any tracking data.

2. **Tabs**: `[ Watchlist (n) ] [ Played (n) ]` with count badges

3. **Sort controls**: Name A-Z (default), Booth Number (with booth sort parsing rules from spec), Recently Added (by `addedAt` timestamp in localStorage)

4. **Game list** — compact GameCard variant. Swipe-to-remove or X button. Star rating shown on Played tab cards.

5. **Empty state** — friendly message + CTA to browse games

6. **Export / Share** — "Share Your PAX Recap" button
   - Generate text summary (top rated, missed, etc.)
   - Web Share API (`navigator.share()`) with copy-to-clipboard fallback

### Implementation notes

*(To be filled in during implementation.)*

---

## Stage 6: Search

**Goal**: Build the `/search` page with hybrid text + semantic search.

**Depends on**: Stage 2 (GameCard, data layer). Also requires S3 Vectors index to be deployed and loaded (Stage 3 of parent plan — already complete).

**UI spec reference**: Screen 4 (Search)

### Tasks

1. **Search input** — auto-focused when arriving from home. Animated placeholder cycling through example queries.

2. **Progressive search (two parallel server actions)**:
   - **Text search** (fast path, ~50ms): substring match on game name, exhibitor, tags from DynamoDB or cached game data
   - **Semantic search** (slow path, ~500-1500ms): embed query via Gemini → `QueryVectors` against S3 Vectors → top-K results
   - Client merges results as they arrive — text results render first, semantic results enhance + re-rank

3. **Result type tabs**: `[ All ] [ Video Games ] [ Tabletop ]` — filter uses S3 Vectors metadata filtering for semantic path

4. **Match type indicator** on each result: "Name match", "Description match", "Semantic match"

5. **Hybrid scoring**: merge + deduplicate, 70/30 semantic/text weighting

6. **Empty state** (pre-search): tappable suggestion chips. **No results state**: message + link to catalogue.

7. **Offline fallback**: banner "Semantic search unavailable — showing text matches only" if embedding API / S3 Vectors unreachable

### Key decisions to make during implementation
- Gemini embedding: server action calls Gemini API directly, or via a shared utility?
- S3 Vectors client: SDK setup, query construction, metadata filtering
- Debounce timing: spec says 300ms — tune based on feel

### Implementation notes

*(To be filled in during implementation.)*

---

## Stage 7: Expo Hall Map

**Goal**: Build the map screens and the prerequisite booth data pipeline.

**Depends on**: Stage 2 (shared components). The booth data pipeline is a self-contained prerequisite within this stage.

**UI spec reference**: Screen 6 (Full Map), Screen 7 (Booth Highlight)

### Tasks

#### 7a. Booth Data Pipeline (prerequisite)

1. **OCR script** (`packages/data-pipeline/src/map/`)
   - Run Google Cloud Vision text detection on `expo-hall-map.jpg`
   - Extract booth-number-like patterns: `/\d+/`, `/TT\d+[A-Z]?/`, `/NL\d+/`
   - Merge adjacent text chunks (15px gap threshold, same as 2025)
   - Output: `booths.json` — `{ "16021": [x1, y1, x2, y2], ... }`

2. **Validation** — cross-reference OCR booth IDs against game data's `boothId` values. Flag mismatches.

3. **Manual overrides** — `booths-overrides.json` for booths that don't OCR cleanly. Merged on top of OCR output.

4. **CLI integration** — add `map` command to data pipeline CLI

#### 7b. Map UI

5. **`MapViewer` component** — full-screen pannable/zoomable map image via `react-zoom-pan-pinch` or similar. Pinch-to-zoom essential.

6. **Map toggle**: `[ Expo Hall ] [ Tabletop Hall ]` — tabletop hall is a static reference image only (no interactive highlighting in v1)

7. **SVG booth overlay** — transparent tap targets over booth bounding boxes from `booths.json`. Rendered with viewBox matching natural image dimensions.

8. **Booth tap → bottom sheet** — tap a booth region → server action queries `byBooth` GSI → bottom sheet shows games at that booth

9. **`/map/[boothId]` (booth highlight)** — auto-center on target booth, magenta circle + red dot + pulsing animation, info bar with game names

10. **Multi-booth support** — `/map?booths=18019,18031,NL2` query param route for multi-booth exhibitors. Highlight all booths, zoom to fit.

11. **Tabletop fallback** — when a tabletop game links to map: auto-switch to Tabletop Hall tab + info banner

### Key decisions to make during implementation
- Map image hosting: `/public` directory or S3? (Spec suggests either)
- Pan/zoom library: `react-zoom-pan-pinch` or alternatives
- `booths.json` bundling: static import at build time (small file)
- Booth tap caching: sessionStorage for repeated taps

### Implementation notes

*(To be filled in during implementation.)*

---

## Stage 8: Home & Polish

**Goal**: Build the home screen (which depends on many prior stages) and apply final polish across the app.

**Depends on**: All prior stages (home consumes featured games, tracking progress, stats).

**UI spec reference**: Screen 1 (Home), Cross-Cutting Concerns (Loading & Error States, Offline Behavior, Caching Strategy)

### Tasks

#### Home screen

1. **Hero section** — title, subtitle, search bar (tap → `/search` with focus)

2. **Quick-action buttons** — horizontal row linking to main sections

3. **Conditional sections**:
   - If tracking data exists: "Your PAX Progress" with progress bar + stats
   - If no tracking data: "Build your PAX game plan!" nudge + CTA

4. **Featured Games** — carousel/horizontal scroll of `isFeatured` games, grouped by exhibitor (see spec note about ~38 games from ~9 exhibitors)

5. **Quick Stats** — dynamic counts, server-rendered: "{gameCount} games, {exhibitorCount} exhibitors, 3 days of PAX"

#### Polish

6. **Loading states** — skeleton cards (shadcn `Skeleton`) for page loads, ISR revalidation, map booth taps, search in-progress

7. **Error states** — "Something went wrong. Try again." with retry for dynamic queries. SSG/ISR pages serve from cache.

8. **Image error handling** — wire up `onError` fallback chain on `next/image` everywhere

9. **Offline behavior** — verify the behavior matrix from the UI spec:
   - Browse/detail: work from SSG cache
   - My Games: fully client-side, always works
   - Search: text-only fallback + banner
   - Reports: queue in localStorage, flush when online

10. **Offline report queueing** — implement `pendingReports` in localStorage, flush on app load + `navigator.onLine` event (see UI spec: Offline Report Queueing)

11. **HTTP cache headers** — static assets (map images, `booths.json`): `Cache-Control: public, max-age=86400`

12. **Caching strategy validation** — verify ISR revalidation intervals match spec (1 hour for catalogue/home, static for game detail pages)

### Nice-to-haves (if time permits)
- Exhibitor Catalogue + Detail (Screens 8-9) — lower priority than core screens
- Map search/filter overlay (spec marks as v1.1 stretch)
- PWA manifest for "Add to Home Screen" on mobile

### Implementation notes

*(To be filled in during implementation.)*

---

## Appendix: Key References

| Resource | Location | Purpose |
|----------|----------|---------|
| UI Spec | [`miscellaneous/docs/03-22-26/ui-spec.md`](../03-22-26/ui-spec.md) | Screen designs, data flows, component specs |
| Vision Doc | [`miscellaneous/docs/03-03-26/vision-2026.md`](../03-03-26/vision-2026.md) | Feature tiers (MVP vs. future), product goals |
| Development Plan | [`miscellaneous/docs/03-18-26/development-plan.md`](../03-18-26/development-plan.md) | Parent plan, Stages 1-3 context |
| Core types | [`packages/core/src/game.ts`](../../../packages/core/src/game.ts) | `Game`, `GameDynamoItem`, `ExhibitorDynamoItem` |
| Taxonomy | [`packages/core/src/taxonomy.ts`](../../../packages/core/src/taxonomy.ts) | `GameType`, `Tag`, `VideoGameGenre`, `TabletopMechanic`, etc. |
| Infra — DB | [`infra/database.ts`](../../../infra/database.ts) | Games + Exhibitors DynamoDB tables + GSIs |
| Infra — Frontend | [`infra/frontend.ts`](../../../infra/frontend.ts) | SST Nextjs resource, table links |
| Infra — Vectors | [`infra/vectors.ts`](../../../infra/vectors.ts) | S3 Vectors env var documentation |

## Appendix: Existing App State (as of 2026-03-23)

The `apps/www` directory contains the default Next.js scaffold from `create-next-app`:
- `app/layout.tsx` — boilerplate root layout (Geist fonts, default metadata)
- `app/page.tsx` — default welcome page (Next.js logo, "edit page.tsx" message)
- `components/ui/` — full shadcn component library already installed
- `hooks/use-mobile.ts` — shadcn mobile detection hook
- `lib/utils.ts` — shadcn `cn()` utility

No application code has been written yet. Stage 1 replaces the boilerplate.
