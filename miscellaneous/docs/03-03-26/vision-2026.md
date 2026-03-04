# PAX Pal 2026 — Vision Document

**Date**: March 3, 2026
**Target**: PAX East 2026 (3 weeks out)
**Stack**: Next.js + shadcn/ui + SST v3 + DynamoDB + Gemini embeddings (in-memory)

---

## Product Vision

PAX Pal 2026 is a conference companion that helps PAX East attendees **discover, track, and share** their expo hall experience — across both video game demos and tabletop games.

The core loop:

1. **Browse & Search** — Find games by category, tag, or natural language description.
2. **Watchlist** — Build a personal "must see" list before and during the event.
3. **Play & Rate** — Mark games as played, leave ratings and short reviews.
4. **Share** — Optionally claim a username to make your activity public, contributing to community stats and game-level commentary.

### What's new in 2026

| Dimension | 2025 | 2026 |
|-----------|------|------|
| Game types | Video game demos only | Video games + tabletop (unified catalog) |
| Tracking model | Favorites / Played | Watchlist → Played → Rate / Comment |
| Data persistence | localStorage only | Local-first, opt-in cloud sync via username |
| Social | None | Public profiles, community stats, comments |
| Search | Hybrid (SQLite FTS + sqlite-vec) | Hybrid (text match + in-memory vector search) |
| Data quality | Scraped + Steam-enriched | Multi-stage pipeline with LLM classification |
| Deployment | Docker Compose | Serverless (SST on AWS) |
| Map | Static image + booth overlay | Same approach, unified map (v1.1) |

---

## Feature Specs

### Tier 1: Core (Week 1 target — must ship)

#### F1. Data Pipeline

Scrape, enrich, classify, and load game data into DynamoDB. Implemented as a TypeScript package (`packages/data-pipeline`) for tight integration with the rest of the monorepo and SST.

**Data sources** (as of March 3, 2026):
- Expo Hall Exhibitors: 345 entries (9 featured, 41 tabletop-categorized, 118 tabletop-tagged)
- Expo Hall Demos: 109 entries
- Tabletop Expo Hall: 42 entries (subset of main exhibitor list)

**Pipeline stages**:

1. **Scrape** — Fetch HTML from the three PAX pages. Parse with `cheerio` (preferred) or Playwright (if JS rendering required).
   - Exhibitors: `data-id`, `data-name`, booth, description (truncated), showroom link, logo URL, tags (from CSS classes), featured status, category (`cat-*`)
   - Demos: game name, exhibitor, booth, description
   - Tabletop: same structure as exhibitors, but links to `/tabletop-expo-hall/showroom.html`

2. **Harmonize** — Merge demos with exhibitors. Key challenge: demo-to-exhibitor mapping isn't explicit in the HTML. Approach:
   - Match by exhibitor name (fuzzy)
   - Match by booth number
   - Flag unmatched demos for manual/LLM review

3. **Enrich** — Use web-search-capable LLMs to fill gaps, supplemented by the BoardGameGeek XML API (`/xmlapi2/search`, `/xmlapi2/thing`) for structured tabletop metadata:
   - Full descriptions (PAX site truncates to ~100 chars)
   - Game images (Steam, BGG, publisher sites)
   - Tabletop metadata: player count, play time, complexity, mechanics — BGG first, LLM fallback for titles BGG doesn't know
   - Video game metadata: platforms, genres, release status

4. **Classify** — Apply a fixed taxonomy using LLM structured output:
   - **Type**: `video_game` | `tabletop` | `both`
   - **Tags**: Normalized from the 41 PAX tags + LLM-inferred labels
   - **Tabletop mechanics**: deck-building, worker placement, dice, RPG, etc.
   - **Video game genres**: roguelike, platformer, RPG, etc.

5. **Embed** — Generate vectors for semantic search using Gemini `gemini-embedding-001` (768d). Embeddings stored as a field on the DynamoDB game item.

6. **Load** — Write to DynamoDB (structured data + embeddings).

**Critical requirement**: The pipeline must be **re-runnable**. Lists update days before and during PAX. Re-runs should:
- Skip entries already in the database (match by `data-id`)
- Add new entries gracefully
- Flag changes to existing entries (name, booth, description) for review
- Never delete data from a re-run (only additive)

#### F2. Game Browsing

- Browse all games in a paginated, filterable list
- Filter by: type (video game / tabletop), tags, booth area
- Sort by: name, booth number, popularity (once social data exists)
- Each card shows: name, image, type badge, short summary, booth, tags

#### F3. Game Detail Page

- Full description, images/media, metadata (platform/mechanics depending on type)
- Booth location (link to map when available)
- Exhibitor info with link to showroom page
- Action buttons: Watchlist / Played / Rate (progressive disclosure)
- Community stats (when social layer is live): watchlist count, played count, average rating
- Comments section (when social layer is live)

#### F4. Search

- **Text search**: Full-text across name, description, tags, exhibitor
- **Semantic search**: Natural language queries via in-memory cosine similarity over Gemini embeddings (e.g., "cooperative card game for 2 players"). All ~300 game embeddings loaded from DynamoDB on cold start.
- Hybrid ranking with configurable weighting (default 70/30 semantic/text, matching 2025's proven ratio)
- Separate or combined results for video games and tabletop

#### F5. Local Tracking (Watchlist / Played)

- All tracking data stored in localStorage by default (works offline / on spotty PAX WiFi)
- **Watchlist**: "I want to check this out" — builds a personal to-do list
- **Played**: "I tried this" — completion state
- My Games page: view and filter your watchlist and played lists
- Statistics: games watchlisted, games played, progress tracking

### Tier 2: Social Layer (Week 2 target — high priority)

#### F6. Username Claims

- Claim a username (text input, first-come-first-served)
- Backend: DynamoDB conditional put (fails if username taken)
- Returns a secret token stored in localStorage
- Token is the only auth — no passwords, no email, no OAuth
- If localStorage is cleared, the username is lost (acceptable tradeoff for simplicity)
- Recovery phrase deferred — not needed for v1

#### F7. Cloud Sync

- Once a username is claimed, local tracking data syncs to DynamoDB when connectivity is available
- Sync is **additive and eventual** — local state is always the source of truth
- Public profile page: `/u/{username}` showing watchlist and played games
- Graceful degradation: app works fully offline, syncs when back online

#### F8. Community Stats

- Aggregated from all users who have claimed usernames
- Per-game stats: watchlist count, played count, average rating
- Displayed on game detail pages ("42 people want to check this out")
- Optional leaderboard / trending section on the home page (if usage warrants it)

#### F9. Ratings & Comments

- **Ratings**: 1-5 stars, only available after marking a game as Played
- **Comments**: Short text reviews (character limit TBD), attached to username
- Displayed on game detail page
- Moderation: inline LLM screening via Gemini `gemini-3.1-flash-lite-preview` — comments are checked before write to DynamoDB and rejected if inappropriate

### Tier 3: Polish & Stretch (Week 3 / ongoing)

#### F10. Expo Hall Map

- Unified map covering both video game and tabletop areas
- Booth overlay highlighting (magenta circle, as in 2025)
- Linked from game detail pages
- **Blocked on**: PAX publishing the official map image
- Booth coordinate extraction: parse map image for booth bounding boxes (as in 2025 notebook 08)
- Note: booth format is inconsistent — numeric (`15043`), alphanumeric (`TT29A`), special (`PAX Rising`, `Tabletop Hall`), multi (`18019, 18031, NL2`). Coordinate mapping must handle all formats.

#### F11. AI Chatbot

- RAG-powered conversational interface: "I have 2 hours and want to play something cooperative with my partner"
- Backed by in-memory vector search (semantic retrieval) + DynamoDB (metadata filtering) + LLM
- Stretch goal — but the data model should be chatbot-friendly from the start

#### F12. Agentic Data Quality (Experimental)

An idea for live data correction from the show floor:

- Use Claude Code's mobile/remote VM capabilities to issue natural language commands like: "Exhibitor 25 is actually showing off Game XYZ — update the data"
- Claude Code interprets the instruction, modifies the data source (DynamoDB or a seed JSON in the repo), and pushes the fix
- Could work via a GitHub-connected workflow: Claude Code on mobile → edit data → push commit → CI/CD deploys
- Alternatively: a lightweight admin API endpoint that accepts structured corrections, callable from a simple mobile form or Claude Code
- This is speculative, but if the data pipeline is clean and the schema is well-defined, the interface for corrections could be surprisingly simple

---

## Data Architecture

### Unified Game Schema

Every entry in the system — whether video game demo, tabletop game, or exhibitor-without-demo — shares a base schema:

```
Game {
  id: string              // PAX data-id (e.g., "646038")
  name: string            // data-exhib-full-name
  type: "video_game" | "tabletop" | "both"
  slug: string            // URL-safe name

  // Display
  summary: string         // Snappy 1-2 sentence description
  description: string     // Full description (LLM-enriched if PAX truncated)
  imageUrl: string        // Primary image (logo, Steam header, BGG cover)
  mediaUrls: string[]     // Additional images/videos

  // Location
  exhibitor: string       // Exhibitor name (may differ from game name)
  boothId: string         // Raw booth string ("15043", "TT29A", "PAX Rising")
  showroomUrl: string     // PAX showroom page link

  // Classification
  tags: string[]          // Normalized taxonomy labels
  paxTags: string[]       // Original PAX CSS class tags (preserved for reference)
  isFeatured: boolean     // PAX featured exhibitor

  // Video game fields (nullable)
  platforms: string[]
  genres: string[]
  releaseStatus: string
  steamUrl: string

  // Tabletop fields (nullable)
  playerCount: string     // e.g., "2-4"
  playTime: string        // e.g., "30-60 min"
  complexity: string      // e.g., "light", "medium", "heavy"
  mechanics: string[]     // e.g., ["deck-building", "worker-placement"]

  // Search
  embedding: number[]     // Gemini gemini-embedding-001 vector (768d), stored in DynamoDB

  // Metadata
  sourcePages: string[]   // Which PAX pages this appeared on
  lastScrapedAt: string   // ISO timestamp
  enrichedAt: string      // ISO timestamp (null if not yet enriched)
}
```

### DynamoDB Table Design

**Games Table** (`pax-pal-games`):
- PK: `GAME#{id}`
- GSI1: `type` + `name` (browse by type, sorted alphabetically)
- GSI2: `boothId` (lookup by booth for map features)

**Users Table** (`pax-pal-users`):
- PK: `USER#{username}`
- Attributes: token (hashed), createdAt, watchlist (ID set), played (ID set), ratings (map of id → score)

**Comments Table** (`pax-pal-comments`):
- PK: `GAME#{gameId}`
- SK: `COMMENT#{timestamp}#{username}`
- Attributes: text, rating, username

**Stats Table** (`pax-pal-stats`) — or computed via aggregation:
- PK: `GAME#{gameId}`
- Attributes: watchlistCount, playedCount, ratingSum, ratingCount

### In-Memory Vector Search

- Embeddings stored directly on DynamoDB game items (768d float array, ~3KB per game)
- On server cold start, all games + embeddings are loaded into memory via DynamoDB scan (~300 items, single-digit ms)
- Semantic search performs cosine similarity in-memory — no external vector database needed
- Embedded text: `name + summary + tags + description`
- Re-embedded when enrichment updates the description

---

## Data Pipeline Architecture

```
                    ┌─────────────────┐
                    │  PAX East Site  │
                    │  (3 HTML pages) │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   1. SCRAPE     │  cheerio (+ Playwright if needed)
                    │   Raw JSON      │  ~345 exhibitors + 109 demos + 42 tabletop
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  2. HARMONIZE   │  Fuzzy match demos ↔ exhibitors
                    │  Unified JSON   │  Deduplicate, assign types
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   3. ENRICH     │  BGG API + web-search LLM fills gaps
                    │  + Classify     │  Full descriptions, metadata, taxonomy
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   4. EMBED      │  Gemini gemini-embedding-001 (768d)
                    │   Vectors       │  name + summary + tags + description
                    └────────┬────────┘
                             │
                    ┌───────▼──────────┐
                    │    5. LOAD       │
                    ├──────────────────┤
                    │  DynamoDB        │  Structured data + embeddings
                    └──────────────────┘
```

Each stage writes intermediate output to `miscellaneous/data/` for inspection and debugging. The pipeline is idempotent: re-running skips known entries and only adds/updates as needed. The entire pipeline is TypeScript (`packages/data-pipeline`), sharing types with the rest of the monorepo.

---

## Technical Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        SST v3                              │
│                                                            │
│  ┌──────────────┐  ┌──────────────────────────────────┐   │
│  │  Next.js     │  │  DynamoDB                        │   │
│  │  (apps/www)  │  │  (4 tables, embeddings inline)   │   │
│  └──────┬───────┘  └──────────────▲───────────────────┘   │
│         │                         │                       │
│         │    Server Actions / API Routes                  │
│         └─────────────────────────┘                       │
│                                                            │
└────────────────────────────────────────────────────────────┘

Client-side:
┌─────────────────────────────┐
│  localStorage               │
│  - watchlist IDs            │
│  - played IDs               │
│  - ratings                  │
│  - auth token (if claimed)  │
│                             │
│  Syncs to DynamoDB when     │
│  online + username claimed  │
└─────────────────────────────┘
```

### Workspace Packages

- `packages/core` — Shared types (Game schema, User, Comment), constants, taxonomy definitions
- `packages/data-pipeline` — TypeScript data pipeline (scrape, harmonize, enrich, classify, embed, load) using cheerio + BGG API + Gemini
- `apps/www` — Next.js frontend + server actions
- `infra/` — SST resource definitions

---

## Taxonomy

### Unified Tag Set (draft)

Derived from the 41 PAX tags, normalized and extended:

**Game type**: Video Game, Tabletop, Both
**Platform**: PC, PlayStation, Xbox, Switch, Mobile, VR
**Genre** (video game): Action, Adventure, Fighting, Horror, Platformer, Puzzle, Roguelike, RPG, JRPG, Sandbox, Shooter, Strategy, Simulation, Retro
**Mechanic** (tabletop): Deck-Builder, Dice, CCG, Co-op, Worker Placement, Area Control, Roll-and-Write
**Audience**: Family-Friendly, Single-Player, Multiplayer, Co-op, PAX Together
**Business**: Free-to-Play, Early Access Demo, Indie, Retail
**Other**: Merch, Apparel, Components

The LLM classification step will map each game to this taxonomy using structured output, ensuring consistent labeling across the dataset.

---

## Timeline

### Week 1 (Mar 3–9): Data + Core

- [ ] Scraping pipeline (stages 1-2)
- [ ] LLM enrichment + classification (stages 3-4)
- [ ] Embedding generation + DynamoDB load (stages 5-6)
- [ ] Game browsing page (filterable list)
- [ ] Game detail page
- [ ] Search (text + semantic)
- [ ] Local tracking (watchlist / played)
- [ ] Deploy to AWS via SST

### Week 2 (Mar 10–16): Social

- [ ] Username claim flow
- [ ] Cloud sync (local → DynamoDB)
- [ ] Public profiles
- [ ] Community stats on game pages
- [ ] Ratings + comments
- [ ] Re-run pipeline with any PAX list updates

### Week 3 (Mar 17–23): Polish

- [ ] Expo hall map (if map image available)
- [ ] UI polish, mobile optimization
- [ ] AI chatbot (stretch)
- [ ] Agentic data corrections (experimental)
- [ ] Final pipeline re-run
- [ ] Load testing / performance tuning

---

## Decisions (resolved from original open questions)

1. **Embedding model**: Gemini `gemini-embedding-001` (768d). Sufficient for ~300 games, no need for larger models.
2. **Tabletop enrichment source**: BoardGameGeek XML API as primary source for structured metadata (player count, play time, complexity, mechanics). LLM web search as fallback for titles BGG doesn't cover.
3. **Comment moderation**: Inline LLM screening via Gemini `gemini-3.1-flash-lite-preview`. Comments checked before write; rejected if inappropriate. Near-instant and negligible cost at this scale.
4. **Recovery phrase for usernames**: Deferred — not needed for v1.
5. **Pipeline runtime**: Manual CLI invocation (`bun run` from `packages/data-pipeline`). Can revisit Lambda if needed later.
