# UI Spec — PAX Pal 2026

**Date**: March 22, 2026
**Context**: Design spec for Stage 4 (Frontend) of the development plan
**Design posture**: Mobile-first. This is a conference companion used on phones with spotty WiFi.

---

## Screen Inventory

| # | Route | Screen | Priority |
|---|-------|--------|----------|
| 1 | `/` | Home | Core |
| 2 | `/games` | Game Catalogue | Core |
| 3 | `/games/[slug]` | Game Detail | Core |
| 4 | `/search` | Search (Hybrid) | Core |
| 5 | `/my-games` | My Games (Tracking) | Core |
| 6 | `/map` | Expo Hall Map (Full) | Core |
| 7 | `/map/[boothId]` | Expo Hall Map (Booth Highlight) | Core |
| 8 | `/exhibitors` | Exhibitor Catalogue | Nice-to-have |
| 9 | `/exhibitors/[slug]` | Exhibitor Detail | Nice-to-have |
| 10 | `/u/[username]` | Public Profile | Phase 2 (Social) |
| 11 | `/chat` | AI Chat | Deferred (Stretch) |

---

## Global: Navigation & Layout

**Mobile-first layout with bottom navigation bar.**

### Bottom Nav Bar

Five tabs, always visible, thumb-friendly:

```
[ Home ]  [ Games ]  [ Search ]  [ Map ]  [ My Games ]
```

- Each tab has an icon + short label
- Active tab highlighted with brand color
- Badge on "My Games" showing watchlist count (e.g., `12`)
- Sticky at bottom, ~56px height, safe-area-aware for notched phones

### Top Header

- "PAX Pal" wordmark, left-aligned
- Minimal — no hamburger menu, no secondary nav
- On desktop (if anyone uses it): top nav replaces bottom nav, same five links

### General Mobile Constraints

- All layouts must work at 375px width without horizontal scroll
- Touch targets: minimum 44x44px
- Cards and lists should be single-column on mobile
- Avoid hover-dependent interactions entirely
- Limit network requests: localStorage for tracking, aggressive caching for game data
- Offline behavior: browsing and tracking work from cached data; search degrades gracefully (text-only fallback if embedding API is unreachable)

---

## Screen 1: Home (`/`)

**Purpose**: Entry point. Quick access to everything, personalized if the user has tracking data.

### Layout (top to bottom)

1. **Hero section**
   - "PAX Pal 2026" title
   - Subtitle: "Your PAX East companion — discover, track, and share"
   - Search bar (tapping navigates to `/search` with focus)

2. **Quick-action buttons** (horizontal row, scrollable if needed)
   - "Browse Games" → `/games`
   - "Search" → `/search`
   - "Expo Map" → `/map`
   - "My Games" → `/my-games`
   - Styled as rounded pill buttons or icon+label cards

3. **Your PAX Progress** (only if user has any tracking data)
   - Progress summary: "8 of 15 watchlisted games played"
   - Visual progress bar
   - Link: "View My Games →"

4. **Watchlist prompt** (only if user has NO tracking data)
   - Friendly nudge: "Build your PAX game plan! Browse games and add them to your watchlist."
   - CTA button: "Browse Games →"

5. **Featured Games** (carousel or horizontal scroll)
   - Games from PAX-featured exhibitors (`isFeatured === true`). Note: ~38 games inherit this flag from ~9 featured exhibitors — display grouped by exhibitor (e.g., "Games from Poland" section with its 11 games) rather than a flat 38-item carousel. Show 1 card per exhibitor in the carousel, tappable to expand or navigate to a filtered view.
   - Card: image, name, exhibitor name, type badge
   - Swipeable on mobile

6. **Quick Stats** (subtle, near bottom)
   - Dynamic counts, server-rendered: "{gameCount} games · {exhibitorCount} exhibitors · 3 days of PAX"
   - Current data: ~395 games, ~373 exhibitors (do not hardcode — query at build time)

### Data Flow

- Game count, exhibitor count: server-rendered (SSG with ISR, revalidate every 1 hour — data is near-static during the 3-day event)
- Featured games: server-rendered from DynamoDB query (`isFeatured === true`, `status === "active"`)
- All DynamoDB queries must filter for `status === "active"` (hidden games should never reach the frontend)
- Tracking data (watchlist, played counts): read from localStorage on client mount
- Conditional rendering: progress bar vs. watchlist prompt based on localStorage state

---

## Screen 2: Game Catalogue (`/games`)

**Purpose**: Browse and filter the full game list.

### Layout

1. **Type tabs** (sticky below header)
   ```
   [ Video Games ]  [ Tabletop ]
   ```
   - Two tabs, not three. No "All" tab — filters and metadata differ between types, and a combined view with incompatible filter options is confusing
   - Default: Video Games (larger set, ~264 games)
   - Tab switch resets filters but preserves search text
   - **`type: "both"` games** (~17 games are both video game and tabletop): show in **both** tabs. These are games like hybrid digital/physical titles that genuinely belong in both views. The game card component already shows a type badge, so users can see the dual nature.

2. **Filter bar** (below tabs, collapsible on mobile)
   - **Search input**: text filter within the current tab (client-side substring match — NOT the hybrid semantic search, which lives at `/search`)
   - **Tag/genre filter**: multi-select chips. Video Games tab shows `genres` field values (Action, RPG, Roguelike, etc.). Tabletop tab shows `mechanics` field values (Deck-Builder, Co-op, Dice, etc.). Only show chips for values that exist in the current dataset (query distinct values at build time).
   - **Sort**: dropdown — "Name (A-Z)", "Booth Number"
   - Filter bar collapses to a single "Filters" button on small screens, expands into a bottom sheet

3. **Results count**: "Showing {n} video games" / "Showing {n} tabletop games" — dynamic, reflects active filters. Current data: ~281 video games (264 + 17 "both"), ~131 tabletop (114 + 17 "both").

4. **Game card grid** (single column on mobile, 2-col on tablet, 3-col on desktop)

### Game Card

```
┌─────────────────────────────┐
│  [Game Image]               │
│                             │
│  Game Name                  │
│  Exhibitor · Booth 15043   │
│  Short summary (2 lines)    │
│                             │
│  [RPG] [Co-op] [Indie]     │  ← top 3 tag chips (see priority below)
│                             │
│  ♡ Watchlisted  ✓ Played   │  ← tracking indicators (if applicable)
└─────────────────────────────┘
```

- **Type badge**: small colored indicator (blue for video game, green for tabletop, dual-color for "both") on the image or top-right corner
- **Tag chip priority**: The `tags` array is a mixed union of genres, mechanics, audience tags, business tags, and style tags. For the 3 card chips, use this priority order: (1) `genres` or `tabletopGenres` (most descriptive), (2) `mechanics`, (3) business tags from `tags` (e.g., "Indie", "Early Access Demo"), (4) audience tags (e.g., "Co-op", "Multiplayer"). Skip style tags on cards (save for detail page). If a game has fewer than 3 qualifying tags, show fewer chips.
- **Discovery confidence**: for games with `discoverySource` of `web_search` or `name_is_game`, show a subtle "unverified" indicator (e.g., a small icon or lighter card border). Tooltip/tap-to-explain: "This game was identified from web sources and may not be accurate." **Prerequisite**: `discoverySource` must be added to the `Game` interface and carried through the classify/embed pipeline stages — it currently exists only on `HarmonizedGame` and is dropped during enrichment.
- **Tracking indicators**: if the game is in the user's watchlist or played list (from localStorage), show small icons on the card. This gives at-a-glance status while browsing.
- **Tap target**: entire card navigates to `/games/[slug]`

### Pagination

- Client-side virtual scrolling or "Load more" button (not traditional page numbers)
- ~395 games total. With `type: "both"` appearing in both tabs: ~281 in Video Games tab, ~131 in Tabletop tab. Initial render: 20 cards, load 20 more on scroll/tap
- All game card data fetched on initial load (server component), filtered/sorted client-side

### Data Flow

- Server component fetches all games from DynamoDB. Two viable approaches:
  - **Option A (recommended for ~395 games)**: Fetch all active games in a single scan, pass to client for tab filtering. Simple, one query, and the dataset is small enough (~395 items) that a full scan is fast. Tab switching is instant (no refetch).
  - **Option B**: Use the `byType` GSI (hashKey: `type`, rangeKey: `name`) to query per-tab. More efficient at scale, but adds complexity for `type: "both"` games (need to appear in both tabs) and requires a refetch on tab switch.
- **Critical: define a `GameCardData` projection.** The full `Game` record includes `embedding` (3072 floats, ~24KB per game), `description`, `pressLinks`, `socialLinks`, `mediaUrls`, and `paxTags` — none of which are needed for card rendering. The server component must project only the fields needed for cards before passing to the client: `id`, `name`, `slug`, `type`, `summary`, `imageUrl`, `exhibitor`, `exhibitorId`, `boothId`, `tags`, `genres`, `tabletopGenres`, `mechanics`, `platforms`, `isFeatured`, `releaseStatus`, `discoverySource`. This reduces the payload from ~24MB to ~200-300KB.
- All queries must filter for `status === "active"`
- Games passed to client component for interactive filtering/sorting/pagination
- Tracking state (watchlist/played) read from localStorage on mount, overlaid onto cards
- Tab switch filters the already-loaded dataset (no additional fetch)
- **Caching**: This page should be statically generated (SSG) or ISR with a long revalidation period (1 hour). Game data changes rarely during the 3-day event.

---

## Screen 3: Game Detail (`/games/[slug]`)

**Purpose**: Full information about a single game. Primary action hub for tracking.

### Layout (top to bottom)

1. **Hero image** (full-width, aspect ratio preserved)
   - Fallback: exhibitor logo or placeholder with game type icon

2. **Title block**
   - Game name (h1)
   - Type badge (Video Game / Tabletop)
   - Exhibitor name — tappable → `/exhibitors/[slug]` if exhibitor pages are built (Nice-to-have). **If exhibitor pages are not built in v1**: link to `/games?exhibitor={exhibitorId}` (filtered catalogue view showing all games by this exhibitor) as a fallback.
   - Booth display (tappable → `/map/[boothId]` or `/map?booths=...` for multi-booth). See Booth Display Formatting in Cross-Cutting Concerns for how to render different `boothId` formats.
   - Discovery confidence badge if applicable

3. **Action buttons** (sticky floating bar at bottom of screen, always visible)
   ```
   [ ♡ Watchlist ]  [ ✓ Played ]  [ ★ Rate ]
   ```
   - Watchlist: toggle. Heart icon fills when active
   - Played: toggle. Checkmark appears when active. Tapping "Played" on a watchlisted game keeps it on the watchlist AND marks as played
   - Rate: only available after marking as Played. Tapping opens a 1-5 star inline selector (expands in place, no modal)
   - All actions write to localStorage immediately
   - Haptic feedback on toggle (if browser supports it)

4. **"Find on Map" button**
   - Prominent, full-width secondary button
   - Navigation logic based on `boothId` value:
     - Single numeric booth (e.g., `"15043"`): → `/map/15043`
     - Multi-booth (contains `,`): → `/map?booths=18019,18031,NL2` (highlights all)
     - Tabletop-only booth (`TT*` or `"Tabletop Hall"`): → `/map` with auto-switch to Tabletop Hall tab + info banner (see Screen 6 Tabletop Fallback)
     - `"UNSPECIFIED"` or `null`: hide the "Find on Map" button entirely
   - For multi-booth exhibitors: highlights all booths

5. **Description**
   - Full enriched description
   - If description is LLM-generated / enriched, no special indicator needed (all descriptions go through enrichment)

6. **Metadata section** (type-dependent)

   **Video game metadata:**
   - Platforms: icon row (PC, PlayStation, Xbox, Switch, Mobile, VR)
   - Genres: tag chips
   - Release status: badge ("Early Access", "Demo", "Released", etc.)
   - Steam link: button (if `steamUrl` exists)

   **Tabletop metadata:**
   - Player count: "2-4 players" (icon + text)
   - Play time: "30-60 min" (icon + text)
   - Complexity: visual indicator (light/medium/heavy — could be 1-3 dots or a simple gauge)
   - Mechanics: tag chips (Deck-Builder, Worker Placement, etc.)
   - BGG link: button (if `bggId` exists)

7. **Tags** (full tag list as chips)

8. **Exhibitor card** (inline)
   ```
   ┌────────────────────────────┐
   │  [Logo]  Exhibitor Name    │
   │          Booth 15043       │
   │          3 other games →   │
   └────────────────────────────┘
   ```
   - Shows the exhibitor with a count of other games by this exhibitor (fetched via `exhibitorId` query — see Data Flow)
   - "3 other games →" links to exhibitor detail page if built, otherwise to `/games?exhibitor={exhibitorId}` (filtered catalogue view)

9. **External links**
   - PAX showroom page
   - Publisher website
   - Steam / BGG (if not shown above)

10. **Report Data Issue button**
    - Subtle, near the bottom (not prominent — most users won't need it)
    - Text link style: "Something wrong? Report an issue"
    - Opens a modal (see below)

### Report Data Issue Modal

Triggered from the game detail page. Collects user-reported data quality problems.

**Modal layout:**

```
┌──────────────────────────────────┐
│  Report an Issue                 │
│                                  │
│  What's wrong with this game?    │
│                                  │
│  [ This game isn't at PAX    ]   │  ← quick-select buttons
│  [ Wrong booth location      ]   │
│  [ Wrong game name/info      ]   │
│  [ This is a duplicate       ]   │
│  [ Other                     ]   │
│                                  │
│  Details (optional):             │
│  ┌────────────────────────────┐  │
│  │                            │  │
│  │  (free text, 500 char max) │  │
│  │                            │  │
│  └────────────────────────────┘  │
│                                  │
│  [ Cancel ]       [ Submit ]     │
└──────────────────────────────────┘
```

- Quick-select buttons are single-select (radio behavior)
- "Other" activates the text field as required (otherwise optional)
- Submit writes to DynamoDB `pax-pal-reports` table
- Success toast: "Thanks! We'll look into it."
- No login required. If user has claimed a username, attach it automatically. Otherwise anonymous.

**DynamoDB `Reports` table:**

```
PK: REPORT#{gameId}#{timestamp}
Attributes:
  gameId: string
  gameName: string         // denormalized for easy scanning
  reportType: "not_at_pax" | "wrong_booth" | "wrong_info" | "duplicate" | "other"
  description: string | null
  username: string | null  // if user has claimed a username
  createdAt: string        // ISO timestamp
```

No UI to view reports in v1. Reports are reviewed via DynamoDB console or a simple CLI query script. Future: admin UI + agentic data quality pipeline reads from this table.

### Data Flow

- Server component fetches game by slug (`getGameById(slug)`) — must filter `status === "active"`
- Server component also fetches sibling games by `exhibitorId` (DynamoDB query on Games table filtering by `exhibitorId`) for the exhibitor card's "N other games →" link and count
- Tracking state (watchlist/played/rating) read from localStorage on client mount
- Action buttons write to localStorage
- Report submission: server action → DynamoDB put. Rate-limit: 1 report per game per session (track submitted gameIds in localStorage to prevent duplicate submissions)
- "Find on Map" link: constructed from `game.boothId` (see Booth Display Formatting in Cross-Cutting Concerns)

---

## Screen 4: Search (`/search`)

**Purpose**: Hybrid search — text matching + semantic similarity. The "smart" search.

### Layout

1. **Search input** (auto-focused on navigation from home)
   - Full-width input with search icon
   - **Animated placeholder text** that cycles through example queries:
     - "cooperative card game for 2 players"
     - "horror roguelike"
     - "party game for large groups"
     - "deck-building strategy"
   - Placeholder text fades/types through suggestions on a timer (every 3-4 seconds)
   - On focus, placeholder disappears and user types freely

2. **Result type tabs** (appear after search)
   ```
   [ All ]  [ Video Games ]  [ Tabletop ]
   ```
   - Filter results by type. "All" is default here (unlike the catalogue, search results benefit from a unified view since semantic matches may cross types)

3. **Results list**
   - Same game card component as the catalogue (reuse)
   - Each result shows a **match type indicator**:
     - "Name match" — matched on game name
     - "Description match" — matched on description text
     - "Semantic match" — matched via embedding similarity
   - Results ordered by hybrid score (configurable weighting, default 70/30 semantic/text per vision doc)

4. **Empty state** (before any search)
   - Show the animated placeholder suggestions as tappable chips:
     ```
     Try searching for:
     [cooperative card game]  [horror roguelike]  [party game]
     ```
   - Tapping a chip fills the search input and triggers search

5. **No results state**
   - "No games matched your search. Try different keywords or browse the full catalogue."
   - Link to `/games`

### Unified Search Behavior

The search bar functions as both an "entity" search and a "semantic" search in a single query:

- **Entity matching**: substring match against game name, exhibitor name, tags (fast, client-feasible or lightweight server query against DynamoDB or cached game data)
- **Semantic matching**: query text is embedded via Gemini, then S3 Vectors `QueryVectors` returns the nearest neighbors by cosine similarity
- Results are merged and deduplicated — a game that matches both ways gets a boosted score
- The distinction is surfaced via the match type indicator but the user doesn't need to choose a mode

### Data Flow

**Progressive search strategy** (important for spotty WiFi): text results appear first, then semantic results enhance the list when ready. This avoids blocking the entire search on the Gemini API call.

- User types query → debounced (300ms) → **two parallel server actions**:
  1. **Text search** (fast path, ~50ms): substring match against game name, exhibitor name, tags from DynamoDB or cached game data. Results render immediately.
  2. **Semantic search** (slow path, ~500-1500ms): embed query via Gemini `text-embedding-004` (3072d) → `QueryVectors` against S3 Vectors index → returns top-K nearest neighbors with scores.
- Client merges results as they arrive: text results show first with a subtle loading indicator for semantic results; when semantic results return, the list re-ranks with hybrid scoring (default 70/30 semantic/text per vision doc)
- S3 Vectors `QueryVectors` supports **metadata filtering** — the type tabs (`[ All ] [ Video Games ] [ Tabletop ]`) can filter server-side in the vector query via metadata filter on `type`. The "All" tab omits the filter. This is more efficient than fetching all results and filtering client-side.
- Returns top 30 results per path, deduplicated in the merge
- **Offline fallback**: if embedding API or S3 Vectors is unreachable, fall back to text-only search with a subtle banner: "Semantic search unavailable — showing text matches only"
- **Caching**: Search results are not cached (queries are unique). But the game card data needed to render results should use the same `GameCardData` projection as the catalogue.

---

## Screen 5: My Games (`/my-games`)

**Purpose**: Personal tracking hub. View and manage watchlist, played games, and ratings.

### Layout

1. **Progress section** (top)
   ```
   ┌──────────────────────────────┐
   │  Your PAX Progress           │
   │                              │
   │  ████████████░░░░  8 / 15   │
   │  53% of watchlist played     │
   │                              │
   │  15 watchlisted · 8 played   │
   │  4 rated · avg ★ 3.8        │
   └──────────────────────────────┘
   ```
   - Progress bar: played / watchlisted ratio
   - Summary stats below
   - Only shows if user has any tracking data

2. **Tabs**
   ```
   [ Watchlist (15) ]  [ Played (8) ]
   ```
   - Count badges on each tab
   - Default: Watchlist

3. **Sort controls** (within each tab)
   - "Name (A-Z)" (default)
   - "Booth Number" — sorts by `boothId` for floor-walking route planning. Parsing rules for the sort comparator:
     - Pure numeric (e.g., `"15043"`): sort numerically ascending
     - `NL`-prefixed (e.g., `"NL2"`, `"NL7"`): sort after numeric booths, numerically by suffix
     - `TT`-prefixed (e.g., `"TT29A"`): sort after NL booths, alphanumerically
     - Multi-booth (contains `,`, e.g., `"18019, 18031, NL2"`): sort by the **first** booth in the comma-separated list
     - `"Tabletop Hall"`: sort with TT booths
     - `"UNSPECIFIED"` or `null`: sort last
   - "Recently Added" — based on when the user added the game to the list (stored in localStorage with timestamp)

4. **Game list** (same card component, compact variant)
   - Slightly condensed cards (smaller image, single-line summary)
   - Swipe-to-remove from list (or a small X button)
   - On the Played tab: star rating shown on each card, tappable to change

5. **Empty state** (no tracking data at all)
   - Friendly illustration or icon
   - "Your game list is empty! Browse games and add them to your watchlist to plan your PAX adventure."
   - CTA: "Browse Games →"

6. **Export / Share** (bottom of page, below the list)
   - "Share Your PAX Recap" button
   - Generates a shareable text summary:
     ```
     My PAX East 2026 Recap (via PAX Pal)
     Played 8 games, rated 4
     Top rated: Game X (★★★★★), Game Y (★★★★)
     Watchlisted but missed: Game Z, Game W
     ```
   - Share via Web Share API (native share sheet on mobile) or copy-to-clipboard fallback
   - Phase 2: could generate a shareable image/card instead of text

### Data Flow

- All data from localStorage — no server fetch needed for the list itself
- Game metadata (name, image, booth, etc.) needs to be resolved from game IDs stored in localStorage. Two approaches:
  - **Option A**: localStorage stores full game objects (denormalized). Simpler, works fully offline, but stale if game data updates.
  - **Option B**: localStorage stores only game IDs + timestamps. On page load, resolve IDs against cached game data (from the catalogue's initial fetch). More accurate, but needs the game data cache to be warm.
  - **Recommended: Option A** for v1 — store the essential display fields (id, name, slug, imageUrl, boothId, type, exhibitor) alongside the tracking state. Offline reliability matters more than freshness at a 3-day event.
- Sort-by-booth is a pure client-side sort on the `boothId` field (see sort parsing rules above)
- Export uses the Web Share API (`navigator.share()`) with text fallback

---

## Screen 6: Expo Hall Map — Full (`/map`)

**Purpose**: View the full expo hall map. Tap a booth to see what's there.

### Layout

1. **Map image** (full-screen, pannable/zoomable)
   - Source: `expo-hall-map.jpg` (main expo hall) displayed as the primary map
   - Pan/zoom via `react-zoom-pan-pinch` or similar lightweight library
   - Pinch-to-zoom is essential on mobile
   - Initial zoom: fit map width to screen width

2. **Map toggle** (top of screen, pill toggle)
   ```
   [ Expo Hall ]  [ Tabletop Hall ]
   ```
   - **Expo Hall**: the main map with interactive booth highlighting
   - **Tabletop Hall**: the `tabletop-map.jpg` displayed as a static reference image with a subtle info banner: "Tabletop hall map — tap a game's 'Find on Map' link for specific booth locations." No interactive highlighting in v1.

3. **Booth tap interaction** (Expo Hall only)
   - SVG overlay on the map image (same approach as 2025)
   - Transparent tap targets over each booth region (bounding boxes from `booths.json`)
   - Tapping a booth region opens a **bottom sheet**:
     ```
     ┌──────────────────────────────┐
     │  Booth 16021                 │
     │                              │
     │  Magic: The Gathering        │
     │  Wizards of the Coast        │
     │  [View Game →]               │
     │                              │
     │  Also at this booth:         │
     │  Another Game Name           │
     │  [View Game →]               │
     └──────────────────────────────┘
     ```
   - Bottom sheet shows all games at that booth (boothId → games reverse index)
   - Each game is tappable → navigates to game detail
   - If no games are mapped to that booth: "No games found at this booth"

4. **Search/filter on map** (stretch, possibly v1.1)
   - A search bar at the top of the map page to find a booth by name or number
   - Typing "Nintendo" highlights the Nintendo booths
   - Not critical for v1, but worth designing the data model to support

### Booth Data Pipeline

This is the prerequisite for the map feature. Produces `booths.json` mapping booth IDs to bounding boxes on the map image.

**Process (adapted from 2025 notebook 08):**

1. Run Google Cloud Vision text detection on `expo-hall-map.jpg`
2. Extract text annotations with bounding polygons
3. Filter to booth-number-like patterns:
   - Numeric: `/\d+/` (same as 2025)
   - Alphanumeric: `/TT\d+[A-Z]?/` (for tabletop booths on the main map, if any)
   - Special zones: may need manual entries for "PAX Rising", "Indie Megabooth", etc.
4. Merge adjacent text chunks on the same scan-line (same 15px gap threshold as 2025)
5. Output: `booths.json` — `{ "16021": [x1, y1, x2, y2], ... }`

**Validation step:** After OCR, cross-reference extracted booth IDs against our game data's `boothId` values. Flag any booth IDs in game data that don't appear in `booths.json` (need manual coordinates or OCR retry). Flag any OCR results that don't match any game data (noise). Note: multi-booth games store comma-separated values in `boothId` (e.g., `"18019, 18031, NL2"`) — split on `, ` before cross-referencing.

**Manual overrides:** Some booths won't OCR cleanly (logos obscuring text, multi-booth exhibitors). Store manual coordinate overrides in `booths-overrides.json` that get merged on top of the OCR output.

**Implementation**: TypeScript script in `packages/data-pipeline/src/map/` (keeping the pipeline tools together). Reads from `miscellaneous/images/expo-hall-map.jpg`, writes to `miscellaneous/data/booths.json`.

### Data Flow

- `booths.json` bundled as a static JSON file at build time (imported directly, not fetched at runtime — it's a small file)
- Booth → games lookup: use the `byBooth` GSI on the Games DynamoDB table (hashKey: `boothId`) to query games at a specific booth. This replaces the need to build a reverse index from the full dataset. For the full map view, the lookup happens on-demand when a booth is tapped (bottom sheet content is fetched per-tap, not pre-loaded for all booths).
- Map image served from `/public` or S3
- SVG overlay rendered client-side with viewBox matching natural image dimensions
- Tap handling: detect which booth bounding box contains the tap coordinate → server action or API route queries `byBooth` GSI → bottom sheet renders results
- **Caching**: booth tap results should be cached client-side (in-memory or sessionStorage) to avoid re-fetching on repeated taps of the same booth. Map image should have aggressive HTTP cache headers.

---

## Screen 7: Expo Hall Map — Booth Highlight (`/map/[boothId]`)

**Purpose**: Show a specific booth's location on the map with a highlight. Linked from game detail pages.

### Layout

Same map view as Screen 6, but:

1. **Auto-centered** on the target booth
   - Map loads zoomed to show the booth area with surrounding context
   - Not fully zoomed in — enough context to orient yourself (show neighboring booths)

2. **Highlight overlay**
   - Magenta circle (r=60, same as 2025) centered on the booth's bounding box midpoint
   - Red dot at exact center
   - Pulsing animation (subtle opacity oscillation) to draw the eye

3. **Info bar** (top or bottom)
   - "Booth 16021 — Wizards of the Coast"
   - Game name(s) at this booth
   - "View all games at this booth →" (if multiple)

4. **"View Full Map" button** — switches to the full map view (Screen 6) at the same zoom level

### Multi-Booth Exhibitors

Some exhibitors have multiple booth locations stored as comma-separated `boothId` values (e.g., Nintendo: `"18019, 18031, NL2"`, Wizards of the Coast: `"16031, 22013"`). There are ~11 multi-booth exhibitors in the dataset.

**URL scheme**: `/map/[boothId]` cannot represent comma-separated values in a single path segment. Use query params instead: `/map?booths=18019,18031,NL2`. The `[boothId]` route handles single booths; the query-param route handles multi-booth. Game detail's "Find on Map" button should construct the appropriate URL based on whether `boothId` contains a comma.

When navigating from a game detail page:

- Highlight ALL booths from the game's `boothId` field (split on `, `)
- Zoom to fit all highlighted booths in view
- Info bar lists all booth numbers

### Tabletop Fallback

When a tabletop game's "Find on Map" button is tapped but the booth can't be highlighted:

- Navigate to `/map` (full map view)
- Auto-switch to the "Tabletop Hall" tab
- Show an info banner: "This game is in the Tabletop Hall. Booth-specific highlighting isn't available for this area yet."

### Data Flow

- `boothId` from URL params (single booth) or `booths` from query params (multi-booth) → lookup in `booths.json` for coordinates
- If booth not found in `booths.json`: show map with an info message ("Booth location not available on map — it may be in an unmapped area")
- Highlight coordinates used to set initial pan/zoom center
- Info bar: `byBooth` GSI query to get games at this booth (same mechanism as map tap in Screen 6)

---

## Screen 8: Exhibitor Catalogue (`/exhibitors`) — Nice-to-Have

**Purpose**: Browse exhibitors (companies, studios, publishers) at PAX.

Lower priority than game screens. Could be hidden from nav and only accessible via game detail pages.

### Layout

1. **Kind filter tabs or chips**
   ```
   [All] [Game Studios] [Publishers] [Tabletop] [Peripheral] [Other]
   ```

2. **Exhibitor card grid**
   ```
   ┌─────────────────────────────┐
   │  [Logo]                     │
   │  Exhibitor Name             │
   │  Booth 15043                │
   │  Game Studio · 3 games      │
   └─────────────────────────────┘
   ```

3. **Search within exhibitors** (text filter, client-side)

### Data Flow

- Server component fetches all exhibitors from DynamoDB (filter `status === "active"`)
- Kind filter and search are client-side. The `byKind` GSI can be used to query by `exhibitorKind` if per-tab server queries are preferred.
- Game counts denormalized on the exhibitor record (`demoCount + discoveredGameCount`)

---

## Screen 9: Exhibitor Detail (`/exhibitors/[slug]`) — Nice-to-Have

### Layout

1. **Header**: logo, name, kind badge, booth, website link, store link
2. **Description**
3. **"Find on Map" button** (same as game detail)
4. **Games grid**: all games linked to this exhibitor (same card component)
5. **External links**: PAX showroom, website, store

### Data Flow

- Server component fetches exhibitor by slug (filter `status === "active"`) + linked games (query Games table filtering by `exhibitorId`, `status === "active"`)

---

## Screen 10: Public Profile (`/u/[username]`) — Phase 2

**Deferred until the social layer is built (username claims, cloud sync).**

### Planned Shape

- Public page showing a user's PAX activity
- Sections: Watchlist, Played, Ratings
- Game cards (compact) in each section
- Stats summary: games played, average rating, etc.
- Only visible for users who have claimed a username and opted in to public profiles

### Prerequisites

- F6 (Username Claims) — DynamoDB Users table, token auth
- F7 (Cloud Sync) — local tracking data synced to cloud
- No implementation in Stage 4. The data model should support it, but no UI work.

---

## Screen 11: AI Chat (`/chat`) — Deferred (Stretch)

**Deferred. Spec included for data model awareness — not part of Stage 4 implementation.**

### Planned Shape

- Conversational interface: user asks natural language questions, gets game recommendations
- Example: "I have 2 hours and want to play something cooperative with my partner"
- Responses include inline game cards (same card component) with direct links to game detail pages
- Backed by: query → Gemini embedding → S3 Vectors `QueryVectors` → top-K games fed as context to LLM → natural language response with structured game references
- Could use Gemini or Claude as the conversational LLM
- Chat history stored in localStorage (session-scoped, not persisted to cloud)

### Data Model Considerations for Now

- Game embeddings already support the retrieval step
- The unified game schema has all the metadata the LLM needs for recommendations
- No additional data model work needed — when chat is built, it reads the same game data as search
- The search page's semantic search (S3 Vectors `QueryVectors`) is essentially the retrieval half of the chat pipeline

### Rough UX Notes

- Full-screen chat interface, scrolling message list
- User messages on right, AI responses on left (standard chat layout)
- Game cards rendered inline within AI responses (not just text links)
- "Thinking..." indicator while LLM processes
- Suggested starter prompts (same idea as search page's example queries)
- Accessible from the home page via a "Chat" quick-action button (not in the bottom nav — not a primary flow)

---

## Cross-Cutting Concerns

### Component Reuse

Several components should be built once and reused across screens:

| Component | Used On |
|-----------|---------|
| `GameCard` (standard) | Catalogue, Search, Exhibitor Detail, AI Chat |
| `GameCard` (compact) | My Games, Exhibitor Card inline, Public Profile |
| `TypeBadge` | Game Card, Game Detail |
| `TagChip` | Game Card, Game Detail, Filter Bar |
| `TrackingButtons` | Game Detail (sticky bar), Game Card (inline indicators) |
| `MapViewer` | Full Map, Booth Highlight |
| `BoothHighlight` (SVG overlay) | MapViewer |
| `BottomSheet` | Map (booth tap), Report Issue |
| `AnimatedPlaceholder` | Search input |

### localStorage Schema

```typescript
interface LocalTrackingData {
  watchlist: {
    [gameId: string]: {
      addedAt: string;           // ISO timestamp
      // Denormalized game data for offline display:
      name: string;
      slug: string;
      imageUrl: string | null;
      boothId: string | null;    // matches Game.boothId field
      type: "video_game" | "tabletop" | "both";
      exhibitor: string;
    };
  };
  played: {
    [gameId: string]: {
      playedAt: string;          // ISO timestamp
      rating: number | null;     // 1-5, null if not rated
      // Same denormalized fields as watchlist
      name: string;
      slug: string;
      imageUrl: string | null;
      boothId: string | null;    // matches Game.boothId field
      type: "video_game" | "tabletop" | "both";
      exhibitor: string;
    };
  };
  // Report deduplication: track which games the user has already reported
  reportedGameIds: string[];
}
```

- Watchlist and played are separate maps (a game can be in both — "I watchlisted it and then I played it")
- Denormalized game fields stored at add-time for offline display
- **Field name note**: the game data model uses `boothId` (not `boothLocation`) for the booth identifier field. The exhibitor data model uses `boothLocation`. This spec consistently uses `boothId` since the frontend primarily works with `Game` records.
- Total localStorage usage estimate: ~395 games * ~200 bytes = ~79KB worst case. Well within limits.

### DynamoDB Tables (Updated)

Stage 3 provisions the Games and Exhibitors tables (see `infra/database.ts`). Adding the Reports table for the game detail report modal:

```typescript
// Reports table — uses sst.aws.Dynamo (not DynamoTable)
export const reportsTable = new sst.aws.Dynamo("Reports", {
  fields: { pk: "string", gameId: "string", createdAt: "string" },
  primaryIndex: { hashKey: "pk" },
  globalIndexes: {
    byGame: { hashKey: "gameId", rangeKey: "createdAt" },
  },
});
```

**Note**: The Games table has GSIs `byType` (type + name) and `byBooth` (boothId) — see Stage 3 plan for details. The Exhibitors table has GSI `byKind` (kind + name). All game/exhibitor records include a `status` field (`"active" | "hidden"`) that must be checked in every query.

### Booth Display Formatting

The `boothId` field on `Game` records contains several different formats. The UI needs a shared formatter function (`formatBoothDisplay`) to render these consistently:

| `boothId` value | Display text | Tappable? |
|-----------------|-------------|-----------|
| `"15043"` (numeric) | "Booth 15043" | Yes → `/map/15043` |
| `"TT29A"` (tabletop) | "Table TT29A" | Yes → `/map` (tabletop tab) |
| `"18019, 18031, NL2"` (multi) | "Booths 18019, 18031, NL2" | Yes → `/map?booths=18019,18031,NL2` |
| `"Tabletop Hall"` | "Tabletop Hall" | Yes → `/map` (tabletop tab) |
| `"UNSPECIFIED"` | *(hidden — don't show booth info)* | No |
| `null` | *(hidden — don't show booth info)* | No |

This formatter is used by: `GameCard`, Game Detail title block, Exhibitor Card, Map info bar.

### GameCardData Projection

The full `Game` record is ~60KB per game (dominated by the 3072-float `embedding` array). Define a `GameCardData` type as the subset sent from server components to client components:

```typescript
interface GameCardData {
  id: string;
  name: string;
  slug: string;
  type: GameType;
  summary: string | null;
  imageUrl: string | null;
  exhibitor: string;
  exhibitorId: string;
  boothId: string | null;
  isFeatured: boolean;
  // Classification (for tag chips + filter)
  tags: Tag[];
  genres: VideoGameGenre[] | null;
  tabletopGenres: TabletopGenre[] | null;
  mechanics: TabletopMechanic[] | null;
  platforms: Platform[] | null;
  releaseStatus: string | null;
  // Discovery (requires pipeline fix — see note on discoverySource)
  discoverySource: DiscoverySource | null;
}
```

**Excluded from card data**: `embedding`, `description`, `pressLinks`, `socialLinks`, `mediaUrls`, `paxTags`, `styleTags`, `bggId`, `steamAppId`, `steamUrl`, `playerCount`, `playTime`, `complexity`, `price`, `developerName`, `enrichedAt`, `lastScrapedAt`, `sourcePages`.

Estimated payload: ~395 games × ~500 bytes = **~200KB** (vs. ~24MB for full records). Acceptable for initial page load even on slow connections.

### Caching Strategy

Game data is near-static during the 3-day event. Caching is critical for performance on spotty WiFi.

| Page | Rendering strategy | Cache behavior |
|------|-------------------|----------------|
| `/` (Home) | SSG or ISR (1h revalidate) | Counts + featured games baked at build |
| `/games` | SSG or ISR (1h revalidate) | Full game card dataset baked at build |
| `/games/[slug]` | SSG (all ~395 slugs generated at build) | Static, no revalidation needed |
| `/search` | Server action (dynamic) | Results not cached; game card data shared with catalogue cache |
| `/my-games` | Client-only (localStorage) | No server cache needed |
| `/map` | SSG | `booths.json` + map image bundled at build |
| `/map/[boothId]` | SSG or dynamic | Booth coordinates from bundled `booths.json`; game list from `byBooth` GSI (cache per-booth in sessionStorage) |
| `/exhibitors` | SSG or ISR (1h revalidate) | If built |

**HTTP headers**: Static assets (map images, `booths.json`) should have `Cache-Control: public, max-age=86400` (1 day). ISR pages use Next.js default stale-while-revalidate behavior.

### Loading & Error States

| State | Behavior |
|-------|----------|
| **Page loading** (SSG miss or ISR revalidation) | Show skeleton cards matching the game card layout. Use shadcn `Skeleton` component. |
| **Search in progress** | Show text results immediately (fast path). Animated spinner next to "Searching..." label while semantic results load. |
| **Map booth tap loading** | Skeleton inside bottom sheet while `byBooth` GSI query resolves. |
| **DynamoDB unreachable** | SSG/ISR pages work from cache. Dynamic queries (search, map tap) show: "Something went wrong. Try again." with retry button. |
| **Image load failure** | Fallback to exhibitor logo (if available), then a placeholder with game type icon (controller for video games, dice for tabletop). Use `next/image` with `onError` fallback. |
| **Empty image** (`imageUrl: null`) | Same placeholder as image load failure. |

### Offline Report Queueing

The offline behavior table states that reports are "queued in localStorage, submitted when online." Implementation:

```typescript
interface PendingReport {
  gameId: string;
  gameName: string;
  reportType: ReportType;
  description: string | null;
  username: string | null;
  createdAt: string;       // ISO timestamp (set at creation time, not submission time)
}

// In localStorage:
// "pendingReports": PendingReport[]
```

- When submitting a report offline (or if the server action fails): push to `pendingReports` array in localStorage, show success toast (user doesn't need to know it's queued)
- On app load (in a `useEffect` at the layout level): check `pendingReports`, attempt to submit each via server action, remove on success
- On `navigator.onLine` event: same flush logic

### Offline Behavior Summary

| Feature | Online | Offline |
|---------|--------|---------|
| Browse games | Full (server-rendered) | Works if page was previously loaded (cached) |
| Game detail | Full | Works if previously viewed |
| Search | Hybrid (text + semantic) | Text-only from cached game data, or unavailable |
| My Games | Full | Full (all data in localStorage) |
| Map | Full | Works if map image + booths.json cached |
| Tracking actions | Write to localStorage + queue for sync | Write to localStorage only |
| Report issue | Submits to DynamoDB | Queued in localStorage, submitted when online |

---

## Appendix: Relationship to Vision Document

This spec covers the UI implementation for features from `vision-2026.md`:

| Vision Feature | Spec Coverage |
|----------------|---------------|
| F2. Game Browsing | Screen 2 (Game Catalogue) |
| F3. Game Detail Page | Screen 3 (Game Detail) |
| F4. Search | Screen 4 (Search) |
| F5. Local Tracking | Screen 5 (My Games) + tracking buttons on Screen 3 |
| F10. Expo Hall Map | Screens 6-7 (Map) |
| F6-F9. Social Layer | Screen 10 (Public Profile) — deferred placeholder |
| F11. AI Chatbot | Screen 11 (AI Chat) — deferred placeholder |
| F12. Agentic Data Quality | Report Issue modal on Screen 3 (collection side) |
