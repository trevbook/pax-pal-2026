# PAX Pal: Prior Year Characterization

A detailed breakdown of PAX Pal 2024 and 2025 — features, technical architecture, data pipelines, and lessons learned — to inform the 2026 edition.

---

## PAX Pal 2024

### Overview

A lightweight Streamlit app focused on a single feature: semantic game search using OpenAI embeddings. Users described the kind of game they wanted to play in natural language and received the 7 most similar matches from the PAX East 2024 expo hall.

### Features

| Feature | Description |
|---------|-------------|
| **Semantic Search** | Single text input ("Describe a game you want to play...") returns the 7 most similar games ranked by cosine similarity. |
| **Results Display** | Each result shows: game title, publisher, booth number, full description, similarity percentage, and a link to the game's external page. |

No browsing, filtering, tracking, or map features — intentionally minimal MVP.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Streamlit |
| Embeddings | OpenAI `text-embedding-3-large` (3,072 dimensions) |
| Data format | Parquet (hosted on GitHub CDN) |
| Similarity | NumPy dot product (cosine similarity on normalized vectors) |
| Language | Python |

### Data Model

| Field | Type | Notes |
|-------|------|-------|
| `id` | int | Unique game ID |
| `publisher` | str | Publisher name |
| `booth` | str | Booth number at PAX East |
| `ganme_name` | str | Game title (typo preserved from source) |
| `description` | str | Full game description |
| `link` | str | External URL |
| `description_emb` | float[3072] | Pre-computed embedding vector |

~210 games total. Some had "No Info" descriptions.

### Data Pipeline

1. **Source**: Manually curated Excel file (`pax-east-2024-games.xlsx`) with game info.
2. **Embedding**: Jupyter notebook embeds each game description via OpenAI `text-embedding-3-large`.
3. **Storage**: Embeddings serialized into a Parquet file (~3.9 MB), hosted on GitHub raw CDN.
4. **Runtime**: App loads the Parquet, embeds the user's query on-the-fly, computes dot product similarity against all games, returns top 7.

### Deployment

- Streamlit Cloud (stateless)
- Data served from GitHub CDN (free, cached)
- One OpenAI API call per search query

### Key Takeaways for 2026

- **Semantic search works well** for game discovery — even with a basic dot-product approach, users could describe vague preferences and get relevant results.
- **Pre-computed embeddings** are cheap and effective; only the query needs real-time embedding.
- **Data quality matters**: games with "No Info" descriptions produced poor matches.
- **3,072 dimensions is overkill** for ~200 games — 2025 successfully dropped to 1,536.

---

## PAX Pal 2025

### Overview

A full-featured React app with a FastAPI backend, SQLite database (with sqlite-vec for vector search), and Docker-based deployment. Major leap in functionality: hybrid search, game tracking, recommendations, booth map, and a multi-source data pipeline.

### Features

| Feature | Description |
|---------|-------------|
| **Hybrid Search** | Combined semantic + full-text search with configurable weighting (default 70% semantic / 30% lexical). Adjustable result limit (default 5, max 50). |
| **Browse All Games** | Paginated table (20/page) with sorting, global text search, and multi-select filters for platforms and genres/tags. URL-persisted filter state. |
| **Game Details** | Full detail view: name, summary, description, platforms, genres, developer, exhibitor, booth. Media carousel (videos prioritized). "You Might Also Like" recommendations. |
| **Personal Tracking** | Mark games as Favorited or Played. "My Games" page with collection management, statistics, and filter views. Confirmation modals for destructive actions. |
| **AI Recommendations** | Cosine similarity on `snappy_summary` embeddings. Aggregates similar games from favorited + played, excludes known games, ranked by frequency. Displayed in carousel. |
| **Booth Map** | Interactive map viewer (`/map/:boothId`). Highlights booth with magenta circle overlay, centered on coordinates. Fullscreen toggle. |
| **Info Page** | About the app, feature list, contact links (GitHub, email, Twitter, BlueSky). |

### UI Patterns

- **Mantine component library** (v8) — Cards, AppShell, MultiSelect, Table
- **Embla Carousel** — Media galleries and recommendation carousels
- **Mantine Notifications** — Toast feedback (pink for favorites, green for played, blue for general)
- **Confirmation Modals** — Destructive actions (unfavorite, mark unplayed, clear all data)
- **TanStack React Table** — Headless table with pagination, sorting, filtering
- **Responsive Navigation** — Hamburger menu on mobile, collapsible navbar

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + React Router 7 + Vite 6 |
| UI | Mantine 8, @tabler/icons-react, Embla Carousel |
| Tables | @tanstack/react-table 8 |
| HTTP | Axios |
| Backend | FastAPI + Uvicorn (Python 3.12) |
| Database | SQLite + sqlite-vec (vector search) + FTS5 (full-text) |
| Embeddings | OpenAI `text-embedding-3-small` (1,536 dimensions) |
| AI Summaries | OpenAI `gpt-4o` |
| Scraping | BeautifulSoup4, Playwright, Google Cloud Vision (OCR) |
| Deployment | Docker Compose (dev), Nginx + Uvicorn (prod) |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/search?q=...&semantic_weight=...&limit=...` | Hybrid search |
| GET | `/api/games/count` | Total game count |
| GET | `/api/games/all` | All games (table view) |
| POST | `/api/games/by-ids` | Batch fetch by IDs |
| GET | `/api/games/{id}` | Single game details |
| POST | `/api/recommendations/from-played` | Get recommendations from played/favorited |
| GET | `/health` | Health check |

### Data Model

#### Game Schema

| Field | Type | Notes |
|-------|------|-------|
| `id` | str (12-char hex) | Unique identifier |
| `name` | str | Game title |
| `snappy_summary` | str | 1-sentence marketing blurb |
| `description_texts` | JSON array | Multiple descriptions: `[{source, text}]` (pax_app, pax_website, ai_search_summary) |
| `platforms` | JSON array | e.g., `["PC", "Switch"]` |
| `genres_and_tags` | JSON array | e.g., `["Indie", "Adventure", "Action"]` |
| `developer` | str | Developer name |
| `exhibitor` | str | Booth exhibitor name |
| `booth_number` | float | Expo hall booth ID |
| `header_image_url` | str | Primary image |
| `steam_link` | str | Steam store URL |
| `media` | JSON array | `[{type, source, url}]` — videos prioritized |
| `released` | bool | Release status |
| `release_time` | str | Release date |
| `links` | JSON array | `[{title, url}]` — external links |
| `similar_games` | JSON array | Pre-computed top 6 similar game IDs |

182 games total in the final dataset.

#### Embedding Storage

- **Table**: `game_embs` (sqlite-vec virtual table)
- **Format**: `FLOAT[1536]` binary blobs, ~6 KB per embedding
- **Embedded text types**:
  - `combined`: name + summary + genres + longest description (used for search)
  - `snappy_summary_and_tags`: summary + genres (used for similar games)

#### Full-Text Search Index

- **Table**: `games_fts` (FTS5 virtual table)
- **Indexed content**: Concatenated name + summary + genres + description
- **Ranking**: BM25, normalized to 0–1

#### User State (localStorage)

```javascript
{
  "localGames": { "game_id": { /* full game object */ } },
  "favoriteGameIds": ["id1", "id2"],
  "playedGameIds": ["id3", "id4"]
}
```

Helper functions: `addGameToFavorites()`, `removeGameFromFavorites()`, `updatePlayedGameStatus()`, `getCombinedDisplayedGames()`, `clearAllGameData()`.

#### Booth Coordinates

`booths.json`: `{ "booth_id": [x1, y1, x2, y2] }` — pixel bounding boxes on the map image.

### Search Architecture

1. User submits query text.
2. Backend embeds query via OpenAI `text-embedding-3-small`.
3. **Semantic path**: sqlite-vec cosine distance → top 20 → normalize to 0–1 similarity.
4. **Lexical path**: FTS5 BM25 → top 20 → normalize to 0–1.
5. **Merge**: `semantic_weight * sem_score + (1 - semantic_weight) * fts_score`.
6. Sort descending, return top N.

### Recommendation Architecture

1. Pre-compute: For each game, calculate cosine similarity on `snappy_summary` embeddings, store top 6 as `similar_games`.
2. Runtime: Client sends list of played/favorited IDs → backend aggregates all `similar_games` lists → counts frequency → sorts by frequency → returns top results (excluding already-known games).

### Data Pipeline

10 sequential Jupyter notebooks in `experiments/notebooks/`:

| # | Notebook | Input | Output |
|---|----------|-------|--------|
| 01 | Scraping the Exhibitor List | PAX website HTML | `exhibitor_list.json`, `exhibitor_details.json` |
| 02 | Parsing App Screenshots | PAX app screenshots | `games_from_app.json` (via Google Cloud Vision OCR) |
| 03 | Scraping the Expo Hall Demos | PAX website HTML | `expo_hall_demos.json`, `expo_hall_demos_detailed.json` |
| 04 | Harmonizing Data | All JSON sources | `unified_games_data.json` (182 unique games, deduplicated via fuzzy matching) |
| 05 | Enriching Data | Unified JSON | `final_enriched_games_data.json` (Steam details, AI summaries via gpt-4o) |
| 06 | Preparing SQLite Database | Enriched JSON | `database.sqlite` (games + embeddings + FTS + similar_games) |
| 07 | Exploring Data | Database | (analysis only) |
| 08 | Parsing the Show Floor Map | Map image | `booths.json` (booth bounding boxes) |
| 09 | Creating a QR Code | App URL | `pax_pal_qr.png` |
| 10 | Adding Missing Games | Manual additions | `extra_final_enriched_games_data.json` |

### Deployment

- **Dev**: Docker Compose — Vite dev server (:5173) + Uvicorn (:8000) with hot reload. Vite proxies `/api/*` to backend.
- **Prod**: Multi-stage Dockerfiles. Frontend → Nginx serving static `dist/`. Backend → Uvicorn on Python 3.12-slim. SQLite as mounted volume.

### Key Takeaways for 2026

- **Hybrid search >> pure semantic**: The 70/30 blend caught exact matches that pure embedding search missed.
- **Multi-source scraping is essential**: No single source (website, app, exhibitor list) had complete data. Harmonization + deduplication is a critical step.
- **Steam enrichment adds enormous value**: Images, genres, release info, and descriptions make the app feel polished. Worth automating early.
- **Pre-computed similar games work well**: Computing at DB-build time avoids runtime cost and enables instant recommendations.
- **localStorage tracking is surprisingly effective**: No auth needed, instant, works offline. Downside: not portable across devices.
- **Booth map needs real coordinates**: The 2025 approach (bounding boxes from map parsing) worked but was fragile. Need a more systematic approach for 2026.
- **The notebook pipeline is powerful but slow**: 10 sequential notebooks is manageable but not repeatable. Consider scripting the pipeline for 2026.
- **Docker Compose is heavy for a conference app**: Cold starts and container management add friction. Serverless (SST) should be a major improvement.

---

## Feature Evolution Summary

| Feature | 2024 | 2025 | 2026 (Planned) |
|---------|------|------|----------------|
| Semantic search | Pure cosine similarity (3,072d) | Hybrid semantic + FTS (1,536d) | S3 Vectors + DynamoDB |
| Browsing | None | Paginated table with filters | TBD |
| Game details | Inline in results | Full page with media carousel | TBD |
| Tracking | None | Favorites + Played (localStorage) | Lightweight accounts (DynamoDB) |
| Recommendations | None | Pre-computed cosine similarity | TBD |
| Map | None | Booth overlay with highlighting | Map overlay (MVP) |
| Comments | None | None | Planned |
| Data sources | 1 (manual Excel) | 3+ (scraping + OCR + Steam) | 3 PAX pages + enrichment |
| Embeddings | text-embedding-3-large | text-embedding-3-small | TBD (S3 Vectors) |
| Backend | None (Streamlit) | FastAPI + SQLite | Next.js + SST + AWS |
| Deployment | Streamlit Cloud | Docker Compose | SST serverless |
| Total games | ~210 | 182 | TBD |
