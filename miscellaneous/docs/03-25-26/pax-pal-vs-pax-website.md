# PAX Pal vs. The PAX Website — A Feature Comparison

**Date**: March 26, 2026
**Purpose**: Comprehensive breakdown of what PAX Pal 2026 does that the official PAX East website doesn't, for a Reddit post.

---

## TL;DR

The PAX East website gives you a flat list of exhibitors and demos. PAX Pal turns that into a searchable, trackable, AI-powered companion app with personalized recommendations, an interactive map, a chatbot, social features, and 395+ enriched game profiles. It was built in ~28 hours of vibe-coding with Claude Code over 23 days.

---

## What the PAX Website Offers

The official PAX East site (east.paxsite.com) has three pages for expo hall content:

| Page | What's There |
|------|-------------|
| **Expo Hall Exhibitors** | ~345 exhibitor names, booth numbers, truncated descriptions (~100 chars), logos, category tags |
| **Expo Hall Demos** | ~160 playable demo listings with game names, exhibitor associations, brief descriptions |
| **Tabletop Expo Hall** | ~43 tabletop exhibitors, same format as main exhibitors page |

Each exhibitor links to a "showroom" page with a slightly longer description and links. That's it.

### What the PAX Website Does NOT Have

- No search (text or semantic)
- No filtering by genre, platform, mechanics, or game type
- No personal tracking (watchlist, played, ratings)
- No recommendations or "similar games"
- No interactive map with booth-game connections
- No community features (reviews, ratings, profiles)
- No AI-powered discovery
- No enriched game metadata (platforms, Steam links, BGG data, trailers, screenshots)
- No mobile-optimized experience for the show floor
- No way to share your picks with friends

---

## What PAX Pal Adds — Feature by Feature

### 1. Enriched Game Profiles (395+ games)

**PAX website**: Game name, exhibitor, maybe a sentence of description.

**PAX Pal**: Full game profiles with:
- Tagline + multi-paragraph descriptions
- Platforms (PC, PlayStation, Xbox, Switch, Mobile, VR)
- Genre and mechanic classifications (from a curated taxonomy)
- Media galleries with screenshots and HLS video trailers (pulled from Steam)
- Press coverage links
- External links (Steam, BoardGameGeek, itch.io, Twitter, Discord, YouTube)
- Release status
- Tabletop-specific metadata: player count, play time, complexity rating
- Exhibitor info with booth location
- "Confirmed" vs. "Unconfirmed" badges (some games are discovered through research, not listed on the PAX site)

**How**: A 10-stage data pipeline scrapes the PAX site, then enriches every game through BoardGameGeek, web search, and the Steam API. An LLM classifies each game into genres/mechanics/platforms. Gemini generates embedding vectors for semantic search.

---

### 2. Smart Search (Hybrid Text + Semantic)

**PAX website**: No search. You scroll a list.

**PAX Pal**: Two search modes running simultaneously:
- **Text search** (~50ms): Matches on game name, exhibitor, tags, genres, mechanics, descriptions
- **Semantic search** (~500–1500ms): AI-powered "vibe search" using Gemini embeddings — search for things like "cozy farming games" or "something like Hades" and get relevant results even if those exact words don't appear in any game description

Results are merged with 30/70 text/semantic weighting. Each result shows a match type badge (Name, Description, Semantic) so you know why it surfaced.

---

### 3. AI Chatbot ("Ask PAX Pal")

**PAX website**: N/A.

**PAX Pal**: A conversational AI assistant powered by Gemini Flash Lite with four RAG tools:
- **Search games** — natural language queries over the full game database
- **Game details** — pull up full info on any specific game
- **Booth lookup** — "What's at booth 1234?"
- **Taste analysis** — "Based on my watchlist, what should I check out?"

The chatbot is aware of your tracked games and can make personalized suggestions. Chat history persists in localStorage with session management. Built in ~1 hour on top of existing search/recommendation infrastructure.

---

### 4. Personalized Recommendations

**PAX website**: N/A.

**PAX Pal**: Three recommendation surfaces:
- **Home page** "Recommended For You" section — appears after you watchlist/play any game
- **"Sort by Recommended"** in the game catalogue — ranks all 395+ games by relevance to your taste
- **Similar Games** on every game detail page — pre-computed top 10 most similar games using embedding cosine similarity

The recommendation engine uses overlap-based scoring: each game in your watchlist/played list has pre-computed similar games. Games that appear in multiple similarity lists score higher. Played games are weighted 1.5x vs. watchlist games. No cold-start problem — works from your very first watchlist addition.

---

### 5. Interactive Expo Hall Map

**PAX website**: A static map image (maybe, if you can find it).

**PAX Pal**: An interactive SVG map with:
- Clickable booth overlays linked to game data
- Tap a booth → slide-out showing what games are there
- Separate Expo Hall and Tabletop Hall tabs
- Deep-link from any game detail page ("Find on Map" button highlights the booth)
- Booth data generated via OCR pipeline on the official map image, cross-validated against game records

---

### 6. Personal Game Tracking

**PAX website**: N/A. Bring a spreadsheet.

**PAX Pal**: Full tracking system in localStorage:
- **Watchlist**: Heart games you want to check out before/during the show
- **Played**: Mark games as played when you visit the booth
- **Ratings**: 1–5 star rating for played games
- **Comments**: Optional personal notes on played games
- **Progress tracking**: Home page shows your played/watchlist completion percentage with stats
- **Cross-tab sync**: Updates propagate across browser tabs instantly
- **My Games hub**: Dedicated page with Watchlist and Played tabs, sorting, and management

Works entirely offline. No account needed for personal tracking.

---

### 7. Social Features & Public Profiles

**PAX website**: N/A.

**PAX Pal**: Lightweight social layer designed for a 4-day convention:
- **Username claiming**: Pick a username (3–20 chars), get a fun 4-word gamer-themed recovery phrase (e.g., "wizard-loot-cosmic-arcade") — no email needed
- **Public reviews**: Rate + comment on games you've played, published with your username
- **AI moderation**: Every review passes through Gemini Flash Lite for family-friendly content screening (fail-open — if the AI is down, reviews still post)
- **Public profiles** (`/profile/{username}`): Shows your played games, watchlist, reviews, and stats — shareable URL
- **Profile sync**: Tracking data syncs to DynamoDB when you claim a username
- **Social nudges**: Gentle prompts to claim a username when you have games tracked but aren't signed in

The identity system is deliberately minimal — a UUID token in localStorage verified server-side. Recovery phrase enables account recovery after a browser clear. No OAuth, no email, no passwords.

---

### 8. Game Catalogue with Filtering

**PAX website**: A flat list of exhibitors. A separate flat list of demos.

**PAX Pal**: Full catalogue experience:
- **Type tabs**: Video Games vs. Tabletop
- **Genre/mechanic filter chips** (dynamic per tab)
- **Name search** within the catalogue
- **Sort options**: Name (A-Z), Booth Number, Recommended
- **Confirmed/unconfirmed toggle**: Hide games that haven't been verified on the PAX site
- **Pagination** with "Load more"
- **Responsive**: Drawer-based filters on mobile, sidebar on desktop
- **Game cards**: Image, name, exhibitor, booth, type badge, genre tags, watchlist button

---

### 9. Rich Media

**PAX website**: Exhibitor logos. Maybe a game screenshot.

**PAX Pal**: Per-game media galleries with:
- Multiple screenshots (sourced from Steam)
- HLS video trailers with custom player (via hls.js)
- Video thumbnails as gallery previews
- Responsive carousel interface
- Lazy-loaded images via Next.js Image optimization

---

### 10. Mobile-First PWA

**PAX website**: Desktop-oriented pages viewed on a phone.

**PAX Pal**: Designed for the show floor:
- Mobile-first responsive layout
- Bottom navigation bar (Home, Games, PAX Pal, Map, My Games)
- PWA manifest for "Add to Home Screen" — runs like a native app
- `100dvh` viewport handling for iOS
- Touch-friendly targets, haptic feedback on interactions
- Dark mode toggle for battery saving and readability in dim halls

---

### 11. Data Pipeline (Behind the Scenes)

This is the invisible infrastructure that makes everything above possible. The PAX website publishes raw exhibitor/demo lists. PAX Pal runs a 10-stage pipeline:

```
Scrape → Harmonize → Discover → Enrich → Classify → Embed → Dedup → Similar → Load → Map
```

Key stages:
- **Discover**: A 3-tier system (structural deduction → LLM classification → web search) that finds games the PAX site doesn't list as demos. This is how PAX Pal has 395+ games vs. the PAX site's ~160 demos.
- **Enrich**: Pulls metadata from BoardGameGeek, web search, and the Steam API. Validates all URLs. Extracts screenshots, trailers, press links, social links.
- **Classify**: LLM assigns genres, mechanics, platforms, audience tags, and style tags from a curated taxonomy.
- **Embed**: Generates 768-dimensional Gemini embedding vectors for semantic search and recommendations.
- **Similar**: Pre-computes top 10 similar games per game using cosine similarity.
- **Map**: OCR pipeline extracts booth locations from the official map image.

All stages cache aggressively and support incremental re-runs. The full pipeline runs in ~20 minutes.

---

### 12. Analytics

**PAX website**: Unknown (probably Google Analytics).

**PAX Pal**: CloudWatch RUM for real-time page-level analytics — lets the developer see which pages people actually use during the convention.

---

## Side-by-Side Summary

| Feature | PAX Website | PAX Pal |
|---------|:-----------:|:-------:|
| Game listings | ~160 demos | 395+ enriched profiles |
| Game descriptions | ~100 chars, truncated | Full descriptions + taglines |
| Search | None | Hybrid text + AI semantic |
| AI chatbot | No | Yes (RAG-powered, personalized) |
| Recommendations | No | 3 surfaces (home, catalogue sort, similar games) |
| Interactive map | No | Clickable SVG with booth-game links |
| Personal tracking | No | Watchlist + Played + Ratings + Comments |
| Social features | No | Usernames, public reviews, shareable profiles |
| Filtering | Exhibitor categories only | Genre, mechanic, type, platform, confirmed status |
| Sorting | None | Name, Booth, Recommended |
| Game metadata | Minimal | Platforms, genres, mechanics, press, Steam, BGG |
| Media | Exhibitor logos | Screenshots, HLS video trailers |
| Mobile experience | Desktop site on phone | Mobile-first PWA with bottom nav |
| Dark mode | No | Yes |
| Offline tracking | No | Yes (localStorage) |
| Community ratings | No | Yes (with AI moderation) |
| Data pipeline | Manual publishing | 10-stage automated pipeline with LLM enrichment |

---

## Year-over-Year Evolution (2024 → 2025 → 2026)

PAX Pal has been rebuilt from scratch each year. Here's how the feature set has grown:

### Architecture

| Layer | 2024 | 2025 | 2026 |
|-------|------|------|------|
| **Framework** | Streamlit (Python) | React 18 + Vite 6 | Next.js 15 (App Router) |
| **UI library** | Streamlit widgets | Mantine 8 + TanStack Table | shadcn/ui + Tailwind |
| **Backend** | None (Streamlit handles it) | FastAPI + Uvicorn (Python) | Next.js Server Actions + API routes |
| **Database** | Parquet file on GitHub CDN | SQLite + sqlite-vec + FTS5 | DynamoDB + S3 Vectors |
| **Embeddings** | OpenAI `text-embedding-3-large` (3,072d) | OpenAI `text-embedding-3-small` (1,536d) | Gemini `gemini-embedding-2-preview` (768d) |
| **AI model** | None | OpenAI `gpt-4o` (summaries only) | Gemini Flash Lite (chat, moderation, classification) |
| **Deployment** | Streamlit Cloud | Docker Compose + Nginx | SST v3 serverless (AWS) |
| **Total games** | ~210 | 182 | 395+ |

### Feature Matrix

| Feature | 2024 | 2025 | 2026 |
|---------|:----:|:----:|:----:|
| **Semantic search** | Pure cosine similarity | Hybrid 70/30 semantic + FTS | Hybrid 30/70 text + semantic with S3 Vectors |
| **Text search** | No | FTS5 BM25 | DynamoDB field matching |
| **Game browsing** | No | Paginated table with filters | Card catalogue with genre/mechanic/type filters |
| **Game detail pages** | Inline in results | Full page with media carousel | Full page with media gallery, HLS video, metadata, similar games, reviews |
| **Personal tracking** | No | Favorites + Played (localStorage) | Watchlist + Played + Ratings + Comments (localStorage) |
| **Recommendations** | No | Pre-computed cosine similarity (top 6) | Overlap-based scoring across 3 surfaces (home, catalogue sort, similar games) |
| **Interactive map** | No | Booth overlay with magenta circle | Clickable SVG with booth-game linking, dual hall tabs |
| **AI chatbot** | No | No | RAG-powered with 4 tools (search, details, booth lookup, taste analysis) |
| **Social features** | No | No | Usernames, public reviews, AI moderation, shareable profiles |
| **Public profiles** | No | No | `/profile/{username}` with stats, played, watchlist, reviews |
| **AI moderation** | No | No | Gemini-powered content screening on reviews |
| **Dark mode** | No | No | Yes |
| **PWA / Add to Home Screen** | No | No | Yes (manifest + icons) |
| **Cloud sync** | No | No | Optional (on username claim) |
| **Media galleries** | No | Videos + images in carousel | Screenshots + HLS video trailers from Steam |
| **Similar games** | No | Pre-computed top 6 | Pre-computed top 10 via embedding cosine similarity |
| **Data pipeline** | Manual Excel → Jupyter | 10 sequential Jupyter notebooks | 10-stage CLI pipeline (scrape → load) with LLM enrichment |
| **Analytics** | No | No | CloudWatch RUM |

### What's New in 2026 (vs. 2025)

**Completely new features** (didn't exist in any prior year):

1. **AI Chatbot** — Conversational game discovery with RAG tools. Ask natural language questions, get personalized answers with inline game cards.
2. **Social layer** — Usernames, public reviews, AI-moderated comments, recovery phrases, shareable profiles. The first year PAX Pal has any server-side identity.
3. **Public profiles** — `/profile/{username}` pages showing played games, watchlist, reviews, and stats.
4. **AI content moderation** — Every review passes through Gemini Flash Lite for family-friendly screening.
5. **PWA support** — Add to Home Screen with app icons and standalone display mode.
6. **Dark mode** — Theme toggle in the header.
7. **Cloud sync** — Tracking data syncs to DynamoDB when a username is claimed.
8. **CloudWatch RUM** — Real-time page analytics during the convention.

**Major upgrades over 2025**:

9. **2x the games** — 395+ vs. 182. The 3-tier discovery system (structural deduction → LLM classification → web search) finds games the PAX site doesn't list as demos.
10. **Serverless architecture** — SST v3 on AWS replaces Docker Compose. No cold starts, no container management, scales automatically.
11. **Richer game metadata** — Taglines, tabletop-specific fields (player count, play time, complexity), press links, social links (Twitter, Discord, YouTube, itch.io). 2025 had basic Steam data; 2026 layers BGG + web search + Steam.
12. **Smarter recommendations** — Overlap-based scoring replaces simple embedding averaging. Three recommendation surfaces (home page, catalogue sort, game detail similar games) vs. one carousel in 2025.
13. **Better map** — Clickable SVG with booth-to-game linking and a slide-out panel vs. 2025's static image with a circle overlay. Dual Expo Hall + Tabletop Hall tabs.
14. **HLS video trailers** — Full streaming video player using hls.js for Steam trailers, not just embedded video URLs.
15. **Confirmed/unconfirmed tracking** — Games discovered through research (not on the PAX demo list) are flagged with an "Unconfirmed" badge so users know the confidence level.
16. **Scripted pipeline** — Fully automated 10-stage CLI pipeline with aggressive caching and incremental re-runs, replacing 2025's 10 sequential Jupyter notebooks.
17. **Star ratings with context** — 2025 had binary favorite/played. 2026 adds 1–5 star ratings with optional written reviews.

### What Carried Forward (Proven Patterns)

These worked well in prior years and were kept/refined:

- **Hybrid search** — The 70/30 semantic/text blend from 2025 proved that pure semantic isn't enough. 2026 flips to 30/70 text/semantic but keeps the hybrid approach.
- **Pre-computed similar games** — Computing at build time avoids runtime cost. Expanded from top 6 to top 10.
- **localStorage tracking** — Still the primary storage for personal data. No auth required for basic tracking.
- **Multi-source data pipeline** — 2025 proved that no single source has complete data. 2026 formalizes this into a staged pipeline with reconciliation.
- **Steam enrichment** — Images, genres, and media from Steam make the app feel polished. Automated earlier in the pipeline this year.
- **Booth map** — Users loved finding games on the map in 2025. Upgraded from static overlay to interactive SVG.

---

## Build Stats

| Metric | Value |
|--------|-------|
| Active coding time | ~28 hours |
| Calendar span | 23 days (Mar 4–26, 2026) |
| Sessions | 58 |
| Human prompts | 320 |
| Built with | Claude Code (Claude Opus 4.6, 1M context) |
| Frontend | Next.js + Tailwind + shadcn/ui |
| Backend | AWS (DynamoDB, S3 Vectors, SST v3) |
| AI | Gemini Flash Lite (chat, search, moderation, embeddings) |
| Third annual edition | 2024: Streamlit, 2025: React/Vite, 2026: Next.js/SST |

---

## The Pitch (for Reddit)

The PAX East website gives you a list of booths and a list of demos. That's useful, but it's hard to figure out which of the 395+ games are actually interesting to *you*.

PAX Pal is a free companion app that:
- Lets you **search by vibe** ("cozy co-op games", "something like Hollow Knight")
- **Recommends games** based on what you've watchlisted
- Has an **AI chatbot** you can ask "I have 2 hours, what should I play?"
- Shows an **interactive expo map** so you can find any game's booth
- Lets you **track your PAX** — watchlist before the show, rate games as you play them
- Has **public profiles** so you can share your PAX picks with friends
- Works great **on your phone** — designed for the show floor

It's a passion project, third year running. This year it was built almost entirely through vibe-coding with Claude Code in about 28 hours of active time. The whole thing is open source.
