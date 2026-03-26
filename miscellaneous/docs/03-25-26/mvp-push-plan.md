# MVP Push Plan — PAX Eve (March 25, 2026)

**Date**: March 25, 2026
**Goal**: Final polish pass before PAX East tomorrow. Complete the home page, add an about page, and ship personalized game recommendations.
**Time budget**: ~2 hours
**Parent plan**: [`frontend-plan.md`](../03-23-26/frontend-plan.md) (Stages 7–8)

---

## How to Use This Document

This is a **living document**. When working on any feature below:

1. Update the status summary table as features begin and complete.
2. Add **implementation notes** under each feature after completing it — record deviations from the plan, key decisions, files created/modified, and anything the next person needs to know.
3. If a feature's scope changes during implementation, update the plan section *and* note what changed and why.
4. Stretch goals may graduate into the main status table if they get picked up — move them up and assign a number.

The goal is that any future Claude (or human) picking up this plan can read the status table, find the next incomplete feature, and have enough context to start working immediately.

---

## Status Summary

| # | Feature | ~Time | Status |
|---|---------|-------|--------|
| 1 | Favicon (🎮 emoji SVG) | 5 min | ✅ Complete |
| 2 | Home page v1 | 40 min | ✅ Complete |
| 3 | Info blurb + `/about` page | 20 min | ✅ Complete |
| 4 | Personalized recommendations | 1 hr | ✅ Complete |

---

## 1. Favicon

**Goal**: Replace the default Next.js favicon with a game controller emoji.

### Tasks

1. Create an SVG favicon with the 🎮 emoji (text-based SVG — no image asset needed)
2. Wire it up in the root layout or via Next.js `app/icon.tsx` / `app/favicon.ico` replacement

### Notes

- SVG favicons are supported in all modern browsers. Use `<text>` element to render the emoji at a large size within a small viewBox.
- Alternative: generate a static `.ico` from the emoji. SVG is simpler.

---

## 2. Home Page v1

**Goal**: Replace the placeholder home page with a real landing experience. This is Stage 8 from the frontend plan, scoped down to what's shippable tonight.

**UI spec reference**: Screen 1 (Home) from [`ui-spec.md`](../03-22-26/ui-spec.md)

### Sections (top to bottom)

1. **Hero** — "PAX Pal 2026" title + "Your PAX East companion" subtitle + search bar (tap navigates to `/search`)

2. **Quick Actions** — horizontal row of icon buttons: Browse Games → `/games`, Search → `/search`, Expo Map → `/map`, My Games → `/my-games`

3. **Your PAX Progress** (conditional — only if tracking data exists)
   - Progress bar showing played/total ratio
   - Stats row: watchlisted, played, rated, average rating
   - Reuse stats from `useTrackingStats()` hook
   - If no tracking data: "Start building your PAX game plan!" nudge with CTA to browse games

4. **Recommended For You** (conditional — only if watchlist has 1+ games)
   - Swipeable card gallery (large GameCard variant, horizontal scroll with snap)
   - Details in Feature 4 below
   - If no watchlist: don't show this section (or show a teaser: "Add games to your watchlist to get personalized picks!")

5. **Quick Stats** — "{gameCount} games to discover across {exhibitorCount} exhibitors" — server-rendered from DynamoDB count

6. **Info Blurb** — short "What is PAX Pal?" paragraph + "Learn more →" link to `/about`

### Key decisions

- Home page is a **server component** for the static parts (stats, metadata). The progress and recommendations sections are **client components** (read localStorage).
- Search bar on home is a styled link/button that navigates to `/search`, not a real input. Keeps the home page simple.

---

## 3. Info Blurb + `/about` Page

**Goal**: Tell people what the app is and who made it. Light touch — a blurb on the home page for most people, a dedicated page for the curious.

### Home page blurb (part of Feature 2)

Short paragraph at the bottom of the home page:

> PAX Pal helps you discover games at PAX East 2026. Browse the full catalogue, search by vibe with AI-powered recommendations, and track your watchlist as you explore the expo hall.

Followed by a "Learn more →" link to `/about`.

### `/about` page

Port the structure and tone from [2025's InfoPage](../../../pax-pal-2025/frontend/src/pages/InfoPage.jsx), updated for 2026:

1. **Title**: "About PAX Pal"

2. **Intro paragraph**: Explain motivation — the official expo hall page is a flat list, PAX Pal makes it browsable, searchable, and personal.

3. **Key features list** (updated for 2026):
   - **Smart Search**: Hybrid text + AI-powered semantic search to find games by vibe, not just keywords
   - **Personalized Recommendations**: Watchlist a few games and get AI-driven picks tailored to your taste
   - **Interactive Expo Map**: Tap booths to see what's there, or find any game's booth on the map
   - **Track Your PAX**: Watchlist games before the show, mark them as played, rate your favorites
   - **Mobile-First**: Designed to use on your phone while walking the expo floor

4. **Third year running blurb**: Brief note that this is the third annual PAX Pal (2024: Streamlit, 2025: React, 2026: Next.js). Shows the passion project trajectory.

5. **Links**:
   - GitHub: [trevbook/pax-pal-2026](https://github.com/trevbook/pax-pal-2026)
   - Email: trevormhubbard@gmail.com
   - Twitter: [@trevbook](https://x.com/trevbook)
   - BlueSky: [trevbook.bsky.social](https://bsky.app/profile/trevbook.bsky.social)

6. **"Built with" note**: Optional tasteful colophon — Next.js, AWS, Claude. Keep it short.

### Routing

- `/about` — new route, `app/about/page.tsx`
- Not linked in the bottom nav (5 tabs is already full). Accessible from home page "Learn more" link and potentially from the top header as a small info icon.

---

## 4. Personalized Recommendations

**Goal**: "Recommended For You" section on the home page. Uses embedding vector averaging to find games similar to the user's watchlist/played games. Refreshes reactively when tracking data changes.

### Architecture

```
Client (home page)                          Server Action
─────────────────                          ─────────────
useTrackingList() → get game IDs    ──→    getRecommendations(gameIds)
                                             │
                                             ├─ GetVectors(gameIds)     ← S3 Vectors
                                             │    → embeddings[]
                                             │
                                             ├─ average embeddings
                                             │    → tasteVector
                                             │
                                             ├─ QueryVectors(tasteVector, topK=20)
                                             │    → candidateIds[]       ← S3 Vectors
                                             │
                                             ├─ filter out input gameIds
                                             │
                                             └─ hydrate from getAllActiveGames()
                                                  → GameCardData[]      ← DynamoDB
                                                                   ──→  render carousel
```

### Server action: `getRecommendations`

**Location**: `app/actions.ts` or `app/home/actions.ts`

**Input**: `gameIds: string[]` (union of watchlist + played game IDs)

**Logic**:

1. **Guard**: If `gameIds` is empty, return `[]`.
2. **Fetch embeddings**: `GetVectorsCommand({ indexArn, keys: gameIds.slice(0, 50) })` — cap at 50 to stay well within the 100-key limit. Use `returnData: true` to get the actual vectors.
3. **Average**: Element-wise mean of all returned float32 vectors → `tasteVector`.
4. **Query**: `queryVectors(tasteVector, 20)` — get top 20 nearest neighbors.
5. **Filter**: Remove any game IDs that are in the input set (already tracked).
6. **Hydrate**: Look up remaining IDs in `getAllActiveGames()` cache → return as `GameCardData[]`. Take top 6.
7. **Error handling**: If S3 Vectors is unreachable, return `[]` gracefully (don't break the home page).

### IAM

- Need to grant `s3vectors:GetVectors` permission in addition to the existing `s3vectors:QueryVectors`. Update `infra/vectors.ts` Linkable.

### Client component: `RecommendedGames`

**Location**: `components/recommended-games.tsx`

**Behavior**:

1. Reads tracking data via `useTrackingList()`.
2. Extracts game IDs from watchlist + played maps.
3. Calls `getRecommendations(gameIds)` server action on mount and whenever tracking data changes (debounced ~1s to avoid hammering on rapid changes).
4. Renders a horizontal swipeable gallery of large `GameCard` components.
5. Shows skeleton loader while fetching.
6. If no recommendations returned (empty watchlist or error): shows a teaser message or hides the section entirely.

### Gallery UX

- **Layout**: Horizontal scroll container with CSS scroll-snap (`scroll-snap-type: x mandatory`, `scroll-snap-align: start` on each card).
- **Card size**: Large variant — roughly 85% viewport width on mobile so the next card peeks in, encouraging swipe. On desktop, show 2-3 cards visible.
- **Card content**: Reuse existing `GameCard` component, possibly with a new "gallery" variant that's taller and shows more info (summary preview, genres).
- **Interaction**: Each card links to `/games/[slug]` as usual. Watchlist toggle button overlaid on each card so users can add recommendations directly.
- **Scroll indicators**: Optional dot indicators below, or just rely on the peek affordance.

### Edge cases

- **1 game in watchlist**: Still works — `GetVectors` returns 1 vector, "average" is just that vector, recommendations are "more like this one game." Totally valid.
- **User adds a recommended game to watchlist**: Next refresh of recommendations should incorporate it and return different results. The debounced re-fetch handles this automatically.
- **All games already tracked**: Return `[]`, hide the section.
- **Cold start (no tracking data)**: Don't show the section at all. The "Start building your PAX game plan!" CTA in the progress section covers this.

---

## Implementation Order

Work in this sequence — each builds on the last:

1. **Favicon** — standalone, zero dependencies, quick win
2. **`/about` page** — standalone route, no dependencies on other features
3. **Home page shell** — hero, quick actions, stats, info blurb, progress section. Gets the page looking complete.
4. **Recommendations server action** — `GetVectors` + averaging + `QueryVectors` logic. Add IAM permission.
5. **Recommendations UI** — gallery component, wire into home page, test the reactive refresh

Steps 1-2 can be committed independently. Steps 3-5 build on each other and should be validated together.

---

## What's NOT in scope tonight

These are explicitly deferred — not forgotten, just not the right call for a last-night push.

- **Map pathfinding / route generation** — Real feature, not an MVP-eve task. The interactive map with booth highlighting already gives attendees what they need to navigate.
- **Social features** — Requires backend (user accounts, cloud sync). Firmly Tier 2/3 in the vision doc.
- **Exhibitor catalogue pages** — Nice-to-have from the frontend plan, but not essential when games are the primary browsing unit.
- **PWA manifest** — Would be great for "Add to Home Screen" but not blocking.
- **Offline report queueing** — Polish item from Stage 8, skip for now.

---

## Stretch Goals (Post-MVP / During PAX / Future)

Things to tackle if tonight's work finishes early, or between sessions at PAX, or for next year. Roughly ordered by impact-to-effort ratio.

### Quick wins (< 1 hour each)

- **Similar Games on game detail page** — The recommendations server action (`GetVectors` → average → `QueryVectors`) generalizes trivially to a single-game version. Fetch the embedding for the current game, query for nearest neighbors, show as "More Like This" cards below the existing "More from [exhibitor]" section. ([Frontend plan nice-to-have](../03-23-26/frontend-plan.md))

- **Clickable metadata chips** — Make genre tags, platform badges, and mechanic chips on game detail pages link to filtered catalogue views (e.g., tapping "Roguelike" navigates to `/games?genre=Roguelike`). Small UX win that makes the whole app feel more interconnected. ([Frontend plan nice-to-have](../03-23-26/frontend-plan.md))

- **PWA manifest** — Add a `manifest.json` with app name, icons (🎮 favicon scaled up), theme color, `display: standalone`. Enables "Add to Home Screen" on mobile — huge for PAX floor usage where people want quick access without a browser tab.

- **"Sort by recommended" in catalogue** — Extend the recommendations logic to work as a sort option on the `/games` page. Instead of returning 6 results, score all games by distance to the taste vector and use that as sort order. The server action already does most of this.

### Medium features (1-3 hours)

- **Map pathfinding / route planner** — Generate an optimized walking route through the user's watchlisted booths. Naive approach: nearest-neighbor traversal over booth centroid coordinates from `booths.json`. Render as numbered markers on the map with a connecting path SVG overlay. Doesn't need to be Dijkstra — even geographic clustering ("start at this end of the hall") would be useful.

- **Exhibitor catalogue & detail pages** — Screens 8-9 from the [UI spec](../03-22-26/ui-spec.md). Browse exhibitors, see all their games in one place. Data already exists in DynamoDB (`Exhibitors` table + `byBooth` GSI). Lower priority than game-centric features but adds completeness.

- **Loading & error state polish** — Skeleton loaders for page transitions, graceful error boundaries, image fallback chains. Currently the app works but transitions can feel abrupt. ([Frontend plan Stage 8](../03-23-26/frontend-plan.md))

- **Offline report queueing** — Queue game reports in localStorage when offline, flush when connectivity returns. The report modal UI already exists but doesn't handle offline. ([UI spec: Offline Report Queueing](../03-22-26/ui-spec.md))

### Big features (half-day+)

- **Lightweight social: username claims + cloud sync** — Claim a username (DynamoDB conditional put), sync tracking data to the cloud, public profile at `/u/{username}`. The vision doc's [Tier 2](../03-03-26/vision-2026.md) (F6-F7). Would enable community stats and shared watchlists. Biggest unlock for making the app feel "alive" at PAX, but significant backend work.

- **Community stats on game pages** — "42 people want to check this out", average community rating. Requires the social layer above. Would make game detail pages much more compelling. ([Vision F8](../03-03-26/vision-2026.md))

- **Ratings & comments** — Short text reviews attached to usernames, with inline LLM moderation via Gemini. Requires social layer + a Comments DynamoDB table. ([Vision F9](../03-03-26/vision-2026.md))

- **AI chatbot** — "I have 2 hours and want to play something cooperative with my partner." RAG over the game embeddings + metadata filtering + conversational LLM. The data layer is already chatbot-friendly (embeddings in S3 Vectors, structured metadata in DynamoDB). Would be the ultimate PAX companion feature but is a real project. ([Vision F11](../03-03-26/vision-2026.md))

- **Agentic data corrections** — Live data fixes from the PAX floor via natural language commands to Claude Code. "Booth 25 is actually showing Game XYZ." Experimental idea from the [vision doc (F12)](../03-03-26/vision-2026.md) — speculative but compelling if the pipeline is clean enough to accept structured corrections.

---

## References

| Resource | Location |
|----------|----------|
| Frontend plan | [`miscellaneous/docs/03-23-26/frontend-plan.md`](../03-23-26/frontend-plan.md) |
| UI spec | [`miscellaneous/docs/03-22-26/ui-spec.md`](../03-22-26/ui-spec.md) |
| 2025 InfoPage | `pax-pal-2025/frontend/src/pages/InfoPage.jsx` |
| S3 Vectors SDK | `@aws-sdk/client-s3vectors` — `GetVectorsCommand`, `QueryVectorsCommand` |
| Vectors utility | [`apps/www/lib/vectors.ts`](../../../apps/www/lib/vectors.ts) |
| Tracking hooks | [`apps/www/hooks/use-tracking.ts`](../../../apps/www/hooks/use-tracking.ts) |
