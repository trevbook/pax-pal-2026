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
   - The 9 PAX-featured exhibitors/games
   - Card: image, name, type badge
   - Swipeable on mobile

6. **Quick Stats** (subtle, near bottom)
   - "423 games · 368 exhibitors · 3 days of PAX"

### Data Flow

- Game count, exhibitor count: server-rendered (static or ISR)
- Featured games: server-rendered from DynamoDB query (`isFeatured === true`)
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
   - Default: Video Games (larger set)
   - Tab switch resets filters but preserves search text

2. **Filter bar** (below tabs, collapsible on mobile)
   - **Search input**: text filter within the current tab (client-side substring match — NOT the hybrid semantic search, which lives at `/search`)
   - **Tag/genre filter**: multi-select chips. Video Games tab shows genres (Action, RPG, Roguelike, etc.). Tabletop tab shows mechanics (Deck-Builder, Co-op, Dice, etc.)
   - **Sort**: dropdown — "Name (A-Z)", "Booth Number"
   - Filter bar collapses to a single "Filters" button on small screens, expands into a bottom sheet

3. **Results count**: "Showing 145 video games" / "Showing 112 tabletop games"

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
│  [RPG] [Co-op] [Indie]     │  ← top 3 tags as chips
│                             │
│  ♡ Watchlisted  ✓ Played   │  ← tracking indicators (if applicable)
└─────────────────────────────┘
```

- **Type badge**: small colored indicator (blue for video game, green for tabletop) on the image or top-right corner
- **Discovery confidence**: for games with `discoverySource` of `web_search` or `name_is_game`, show a subtle "unverified" indicator (e.g., a small icon or lighter card border). Tooltip/tap-to-explain: "This game was identified from web sources and may not be accurate."
- **Tracking indicators**: if the game is in the user's watchlist or played list (from localStorage), show small icons on the card. This gives at-a-glance status while browsing.
- **Tap target**: entire card navigates to `/games/[slug]`

### Pagination

- Client-side virtual scrolling or "Load more" button (not traditional page numbers)
- ~400 games total, split across two tabs, so ~150-250 per tab. Initial render: 20 cards, load 20 more on scroll/tap
- All game data fetched on initial load (server component), filtered/sorted client-side

### Data Flow

- Server component fetches all games from DynamoDB (`getAllGames()`)
- Games passed to client component for interactive filtering/sorting/pagination
- Tracking state (watchlist/played) read from localStorage on mount, overlaid onto cards
- Tab switch filters the already-loaded dataset (no additional fetch)

---

## Screen 3: Game Detail (`/games/[slug]`)

**Purpose**: Full information about a single game. Primary action hub for tracking.

### Layout (top to bottom)

1. **Hero image** (full-width, aspect ratio preserved)
   - Fallback: exhibitor logo or placeholder with game type icon

2. **Title block**
   - Game name (h1)
   - Type badge (Video Game / Tabletop)
   - Exhibitor name (tappable → `/exhibitors/[slug]` if exhibitor pages exist)
   - Booth location (tappable → `/map/[boothId]`)
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
   - Navigates to `/map/[boothId]`
   - For tabletop games without a numeric booth: navigates to `/map` and shows the tabletop reference map with a note that booth highlighting isn't available for this area (see Screen 6 for details)
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
   - Shows the exhibitor with a count of other games at their booth
   - "3 other games →" links to exhibitor detail or a filtered game list

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

- Server component fetches game by slug (`getGameById(slug)`)
- Tracking state (watchlist/played/rating) read from localStorage on client mount
- Action buttons write to localStorage
- Report submission: server action → DynamoDB put
- "Find on Map" link: constructed from `game.boothLocation`

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

- **Entity matching**: substring match against game name, exhibitor name, tags (fast, client-feasible or lightweight server query)
- **Semantic matching**: query text is embedded via Gemini, then cosine similarity is computed against all game embeddings in memory on the server
- Results are merged and deduplicated — a game that matches both ways gets a boosted score
- The distinction is surfaced via the match type indicator but the user doesn't need to choose a mode

### Data Flow

- User types query → debounced (300ms) → server action
- Server action:
  1. Embeds query text via Gemini `gemini-embedding-001`
  2. Computes cosine similarity against in-memory game embeddings
  3. Also runs text substring match against name/description/tags
  4. Merges results with hybrid scoring
  5. Returns top 30 results
- Client displays results using same card component as catalogue
- Type tabs filter the result set client-side (no re-fetch)
- **Offline fallback**: if embedding API is unreachable, fall back to text-only search with a subtle banner: "Semantic search unavailable — showing text matches only"

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
   - "Booth Number" — sorts by booth location for floor-walking route planning. Numeric booths sort numerically (15xxx area first, then 16xxx, etc.). Tabletop `TT*` booths group together at the end. Games without booth data sort last.
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
  - **Recommended: Option A** for v1 — store the essential display fields (id, name, slug, imageUrl, boothLocation, type) alongside the tracking state. Offline reliability matters more than freshness at a 3-day event.
- Sort-by-booth is a pure client-side sort on the `boothLocation` field
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

**Validation step:** After OCR, cross-reference extracted booth IDs against our game data's `boothLocation` values. Flag any booth IDs in game data that don't appear in `booths.json` (need manual coordinates or OCR retry). Flag any OCR results that don't match any game data (noise).

**Manual overrides:** Some booths won't OCR cleanly (logos obscuring text, multi-booth exhibitors). Store manual coordinate overrides in `booths-overrides.json` that get merged on top of the OCR output.

**Implementation**: TypeScript script in `packages/data-pipeline/src/map/` (keeping the pipeline tools together). Reads from `miscellaneous/images/expo-hall-map.jpg`, writes to `miscellaneous/data/booths.json`.

### Data Flow

- `booths.json` is loaded as a static JSON file (bundled with the app or fetched on map page load)
- Reverse index (boothId → games) built at server render time from the games dataset
- Map image served from `/public` or S3
- SVG overlay rendered client-side with viewBox matching natural image dimensions
- Tap handling: detect which booth bounding box contains the tap coordinate, look up games in the reverse index

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

Some exhibitors have multiple booth locations (e.g., Nintendo at 18019 and 18043). When navigating from a game detail page:

- Highlight ALL booths associated with the exhibitor
- Zoom to fit all highlighted booths in view
- Info bar lists all booth numbers

### Tabletop Fallback

When a tabletop game's "Find on Map" button is tapped but the booth can't be highlighted:

- Navigate to `/map` (full map view)
- Auto-switch to the "Tabletop Hall" tab
- Show an info banner: "This game is in the Tabletop Hall. Booth-specific highlighting isn't available for this area yet."

### Data Flow

- `boothId` from URL params → lookup in `booths.json` for coordinates
- If booth not found: show map with an error message ("Booth not found on map")
- Highlight coordinates used to set initial pan/zoom center
- Same reverse index lookup for the info bar

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

- Server component fetches all exhibitors from DynamoDB
- Kind filter and search are client-side
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

- Server component fetches exhibitor by slug + linked games (filter games by `exhibitorId`)

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
- Backed by: query → Gemini embedding → cosine similarity vector search → top-K games fed as context to LLM → natural language response with structured game references
- Could use Gemini or Claude as the conversational LLM
- Chat history stored in localStorage (session-scoped, not persisted to cloud)

### Data Model Considerations for Now

- Game embeddings already support the retrieval step
- The unified game schema has all the metadata the LLM needs for recommendations
- No additional data model work needed — when chat is built, it reads the same game data as search
- The search page's semantic search is essentially the retrieval half of the chat pipeline

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
      boothLocation: string | null;
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
      boothLocation: string | null;
      type: "video_game" | "tabletop" | "both";
      exhibitor: string;
    };
  };
}
```

- Watchlist and played are separate maps (a game can be in both — "I watchlisted it and then I played it")
- Denormalized game fields stored at add-time for offline display
- Total localStorage usage estimate: ~400 games * ~200 bytes = ~80KB worst case. Well within limits.

### DynamoDB Tables (Updated)

Adding the Reports table to the Stage 3 infrastructure plan:

```typescript
// Reports table
export const reportsTable = new sst.aws.DynamoTable("Reports", {
  fields: { pk: "string", gameId: "string", createdAt: "string" },
  primaryIndex: { hashKey: "pk" },
  globalIndexes: {
    byGame: { hashKey: "gameId", rangeKey: "createdAt" },
  },
});
```

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
