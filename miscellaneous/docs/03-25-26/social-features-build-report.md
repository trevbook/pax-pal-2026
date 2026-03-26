# Social Features Build Report — Usernames, Reviews & AI Moderation in One Hour

**Date**: March 26, 2026
**Builder**: Trevor + Claude Opus 4.6 (1M context)
**Time**: ~1 hour, single Claude Code session
**Commit**: `fcfc807` — `feat(www): add social features — usernames, reviews, and AI moderation`

---

## The Prompt

Trevor opened with an energy-drink-fueled "Yuhhhh! We've got one hour." He wanted social features — but not *big* social features. The brief was deliberately cautious: usernames, public reviews, AI moderation, and gentle nudges throughout the app. The core tension he flagged upfront: is it harsh to let strangers rate unfinished game demos at a convention? The answer they landed on: yes, but pair it with a quality gate (you need to write something, not just drop a number) and AI moderation that keeps things family-friendly.

Three documents were provided as context:
- **`vision-2026.md`** — Original project vision with social features as a stretch goal
- **`frontend-plan.md`** — Frontend architecture plan mentioning "lightweight accounts"
- **`mvp-push-plan.md`** — The final sprint plan with social features as a last-mile push

## Context Sources — What the Agent Read

### 1. User-provided documentation

The three docs established the product philosophy: **useful without signing in, social as an opt-in layer**. The key constraint was that PAX is only 4 days — nobody wants to create an account for a weekend app. The identity system needed to be lighter than email/password but recoverable enough to survive a browser cache clear.

### 2. Codebase exploration (3 parallel Agent subagents)

Three specialized explore agents were launched simultaneously (~50 seconds each, 70+ tool calls combined):

- **Agent 1 — Tracking & localStorage**: Mapped the `useTracking()` hook, `useSyncExternalStore` pattern, `pax-pal-tracking` localStorage schema, cross-tab sync, haptic feedback, the `PlayedEntry` shape (already had `rating` but no `comment`).

- **Agent 2 — UI patterns & game pages**: Found the existing `ReportModal` Dialog pattern (controlled mode with `open`/`onOpenChange`), the `ActionBar` with its Watchlist/Played/Rating buttons, the `GameDetailClient` wrapper component, and the full inventory of available shadcn components (Dialog, Sheet, Input, Textarea, etc.).

- **Agent 3 — Data pipeline & AI SDK**: Traced the Gemini provider setup (`@ai-sdk/google`), `generateObject()` with Zod schemas (used for game classification), DynamoDB table patterns (compound `pk` keys, GSI access), server action conventions (`"use server"` + typed async functions), and SST Resource linking pattern.

### 3. The AI chatbot build report

The chatbot report from the previous session served as both a morale boost ("we did this in an hour before") and a technical reference. The social features reused many of the same patterns: same Gemini model, same DynamoDB client setup, same server action conventions.

## What Was "Taken Advantage Of" — Existing Infrastructure

Like the chatbot before it, the social features were largely a composition layer over existing systems:

| Existing capability | How social features used it |
|---|---|
| `useTracking()` hook + `useSyncExternalStore` | Copied the external store pattern verbatim for `useUser()` |
| `PlayedEntry` in localStorage | Extended with a `comment` field for local review storage |
| `ReportModal` Dialog pattern | Used as the template for `PlayedModal` and `UsernameModal` |
| `ActionBar` sticky footer | Added `onPlayedClick` prop to intercept the Played button |
| `GameDetailClient` wrapper | Added `initialReviews` prop + `ReviewsSection` + `PlayedModal` |
| `submitReport()` server action | Copied the pattern for `submitReview()` and `claimUsername()` |
| DynamoDB client singleton | Same `DynamoDBDocumentClient.from()` pattern, same Resource casting |
| `getModel()` (Gemini Flash Lite) | Reused for comment moderation (`generateObject` with boolean schema) |
| SST DynamoDB table definitions | Added 2 new tables following the same `sst.aws.Dynamo` pattern |
| Biome + Lefthook pre-commit | Enforced formatting on all new files automatically |

The social features introduced **2 new DynamoDB tables and 0 new dependencies**. Every library used — AI SDK, shadcn Dialog, Zod, sonner toasts, Lucide icons — was already in the project.

## What Was Actually Built — 8 New Files, ~1,290 Lines

### Infrastructure (2 modified files)

**`infra/database.ts`** — Added two new DynamoDB tables:

- **Users table**: `pk: USER#{username}`, with a `byRecovery` GSI on `recoveryPhrase` for account recovery lookups. Uses a DynamoDB conditional put (`attribute_not_exists(pk)`) to atomically claim usernames — no race conditions.

- **Reviews table**: Composite key `pk: GAME#{slug}` / `sk: REVIEW#{username}` — one review per user per game, naturally overwritten on re-submission. `byUser` GSI enables a future "view all reviews by user" feature.

**`infra/frontend.ts`** — Linked both new tables to the Next.js frontend for SST Resource access.

### Backend (1 new file)

**`apps/www/app/actions/social.ts`** (~252 lines) — Four server actions:

1. **`claimUsername(username)`** — Validates format (3–20 chars, alphanumeric + `_-`), generates a UUID secret token + 4-word recovery phrase, conditional-puts to DynamoDB. Returns the credentials on success, `"taken"` or `"invalid"` on failure.

2. **`recoverUsername(phrase)`** — Normalizes the input phrase, queries the `byRecovery` GSI. Returns credentials if found.

3. **`submitReview(input)`** — Three-step pipeline:
   - **Auth**: Verifies the username's `secretToken` against DynamoDB (not a JWT — just a UUID stored client-side and validated server-side).
   - **Moderation**: Calls `generateObject()` with Gemini Flash Lite to evaluate the comment against a family-friendly content policy. Returns a structured `{ allowed: boolean, reason: string | null }`. Fail-open: if the Gemini call errors, the comment is allowed through.
   - **Write**: Puts the review to the Reviews table with composite key.

4. **`getReviewsForGame(slug)`** — Queries all reviews for a game, sorted by recency. Called server-side during SSG/ISR and used as `initialReviews` prop.

### Identity Layer (3 new files)

**`apps/www/lib/user.ts`** (~36 lines) — localStorage schema for user identity. Separate key (`pax-pal-user`) from tracking data (`pax-pal-tracking`) to keep concerns decoupled. Simple CRUD: `readUser()`, `writeUser()`, `clearUser()`.

**`apps/www/hooks/use-user.ts`** (~62 lines) — Mirrors the `useTracking()` hook architecture exactly: `useSyncExternalStore` + listener set + cross-tab sync via `storage` event. Returns `{ user, setUser, clearUser }`.

**`apps/www/lib/recovery-words.ts`** (~82 lines) — Gamer-themed 4-word recovery phrase generator. 58 words across 6 categories (genres, game terms, fantasy nouns, items, adjectives, PAX vibes) → ~11.3M combinations. Examples: `wizard-loot-cosmic-arcade`, `roguelike-shield-neon-expo`. Fun enough to screenshot, memorable enough to write down on a con badge.

### UI Components (3 new files)

**`apps/www/components/played-modal.tsx`** (~315 lines) — The centerpiece. A single Dialog with a step-based flow:

1. **Step: "review"** — Star rating (1–5, toggle to deselect) + textarea (500 char limit) + inline username claim nudge (appears only when you've typed a comment but don't have a username). Two action buttons: "Just Mark Played" (local only) and "Submit Review" (requires username + rating + comment).

2. **Step: "recovery-phrase"** — Shown immediately after claiming a username, *within the same dialog* (no nested modal). Yellow card with the 4-word phrase, copy button, and a "Back to review" button to return to step 1 (now logged in and ready to publish).

The inline username claim was a deliberate design choice over the original nested-modal approach. The first iteration opened a `UsernameModal` on top of the `PlayedModal`, which looked jarring on mobile. The fix: embed a compact username input + "Claim" button directly in the review form's social nudge area. The full standalone `UsernameModal` still exists for the My Games page banner.

**`apps/www/components/username-modal.tsx`** (~252 lines) — Standalone three-view Dialog for username claim/recovery. Used from the My Games page. Views: "claim" (input + validation), "recover" (phrase input + GSI lookup), "success" (recovery phrase display + copy).

**`apps/www/components/reviews-section.tsx`** (~67 lines) — Server-component-safe review list with relative timestamps (`timeAgo()`), star ratings, and username attribution. Empty state: "No reviews yet. Play this game and share what you think!"

### Modified Files (6 files)

**`apps/www/components/action-bar.tsx`** — Added `onPlayedClick` prop. When provided and the game isn't yet played, clicking "Played?" opens the modal instead of directly toggling the state. Unmarking a played game still works via direct toggle.

**`apps/www/components/game-detail-client.tsx`** — Added `initialReviews` prop, `ReviewsSection` rendering, `PlayedModal` integration, and an `onReviewPublished` callback that optimistically prepends new reviews to the local state (deduplicating by username).

**`apps/www/app/games/[slug]/page.tsx`** — Server-side `getReviewsForGame(slug)` call during page render, passed as `initialReviews` to the client wrapper.

**`apps/www/components/my-games.tsx`** — Dismissable social banner: "Share your PAX journey — claim a username to make your reviews public." Appears only when the user has played games but hasn't claimed a username. Dismissal persisted in localStorage (`pax-pal-username-banner-dismissed`).

**`apps/www/hooks/use-tracking.ts`** — Added `markPlayedWithReview(rating, comment)` method and `comment` field to the tracking return value.

**`apps/www/lib/tracking.ts`** — Extended `PlayedEntry` with `comment: string | null`.

### Tooling (1 new file)

**`scripts/wipe-social-data.ts`** (~82 lines) — Destructive utility that scans and batch-deletes all rows in the Users and Reviews tables for the current SST stage. Runs inside `bunx sst shell` for Resource access. Paginated scan + BatchWrite in chunks of 25. Used during development/testing to reset social data without touching game data.

## Design Decisions and Trade-offs

**Why no real auth?** PAX is 4 days. Email/password is overkill, OAuth requires redirect flows that feel heavy on a mobile PWA. The "identity" system is a username + UUID token stored in localStorage, verified server-side on each write. It's the lightest possible thing that prevents impersonation. The recovery phrase (queried via GSI) handles the "I cleared my browser" edge case.

**Why 4-word recovery phrases instead of email?** The gamer word list makes it fun and on-brand. `wizard-loot-cosmic-arcade` is something you'd screenshot and text to a friend. Email recovery means building a mail pipeline, handling bounces, dealing with spam filters — all for a 4-day app.

**Why AI moderation instead of word lists?** A static blocklist catches obvious slurs but misses creative meanness and passes through frustration that's actually fine ("the controls felt awful"). Gemini Flash Lite is fast enough (~200ms) for synchronous moderation and can understand context. The prompt is deliberately lenient — only rejecting clearly inappropriate content — because honest negative reviews are valuable signal.

**Why fail-open on moderation errors?** If the Gemini API is down, blocking users from posting reviews would be worse than letting an unmoderated comment through. The content is displayed on game pages but isn't indexed by search engines or broadcast anywhere. The risk profile of a missed inappropriate comment is low; the cost of a broken review flow at a live convention is high.

**Why optimistic review display?** The first implementation required a page refresh to see your own review after posting. The fix: `onReviewPublished` callback passes the new review back to `GameDetailClient`, which prepends it to the local `reviews` state array (deduplicating by username). The review shows up instantly in the `ReviewsSection`, and the next page load fetches the canonical server data.

**Why a separate `UsernameModal` when the `PlayedModal` has inline claiming?** Two entry points for different contexts. The `PlayedModal`'s inline claim is the primary flow — you're already writing a review, the username input appears naturally. The standalone `UsernameModal` is for the My Games page banner, where the user is browsing their tracked games and the social nudge is a separate CTA.

**Why keep star ratings despite the concern about demoralizing devs?** Trevor was torn but ultimately decided the data value outweighed the risk. The quality gate (you must write a comment to publish) means every rating comes with context. A 2-star review that says "cool concept but the demo kept crashing" is more useful to everyone (including the dev) than a bare number. The AI moderation also screens out pile-on meanness.

**Why `comment` required for public reviews but rating optional for local tracking?** Two different audiences. Your local "My Games" tracking is for you — a quick star rating helps you remember what you liked. Public reviews are for the community — a number without context isn't useful and can feel harsh. The quality gate (`rating + comment` for public, `rating` alone for private) threads this needle.

## Architecture Diagram

```
                     ┌──────────────────────┐
                     │   Game Detail Page    │
                     │   (Server Component)  │
                     └──────────┬───────────┘
                                │
                    getReviewsForGame(slug)
                                │
                     ┌──────────▼───────────┐
                     │  GameDetailClient     │
                     │  (Client Component)   │
                     │                       │
                     │  ├─ ReviewsSection    │──── reviews[] (state, initialized from server)
                     │  ├─ ActionBar         │──── onPlayedClick → opens PlayedModal
                     │  ├─ PlayedModal       │──── submitReview() → DynamoDB + optimistic update
                     │  └─ ReportModal       │
                     └──────────────────────┘

                     ┌──────────────────────┐
                     │     PlayedModal       │
                     │                       │
                     │  Step 1: "review"     │──── Rating + Comment + Inline Username Claim
                     │  Step 2: "recovery"   │──── Recovery Phrase Display
                     │                       │
                     │  ├─ claimUsername()    │──── DynamoDB conditional put
                     │  ├─ moderateComment()  │──── Gemini Flash Lite generateObject()
                     │  └─ submitReview()     │──── Auth check → Moderate → DynamoDB put
                     └──────────────────────┘

                     ┌──────────────────────┐
                     │    My Games Page      │
                     │                       │
                     │  ├─ Social Banner     │──── "Claim a username" (dismissable)
                     │  └─ UsernameModal     │──── Standalone claim/recover flow
                     └──────────────────────┘
```

## Data Flow

```
Client (localStorage)                    Server (DynamoDB)
─────────────────────                    ──────────────────
pax-pal-tracking                         Users table
  └─ played[gameId]                        pk: USER#{username}
       ├─ rating: number | null            secretToken: UUID
       └─ comment: string | null           recoveryPhrase: "word-word-word-word"
                                           byRecovery GSI: recoveryPhrase → User
pax-pal-user
  ├─ username: string                    Reviews table
  ├─ secretToken: UUID                     pk: GAME#{slug}
  └─ recoveryPhrase: string               sk: REVIEW#{username}
                                           rating, comment, createdAt
                                           byUser GSI: username → Reviews[]
```

## What Didn't Need to Be Built

- No new API keys or secrets (reuses existing Gemini key)
- No new npm dependencies (AI SDK, shadcn, Zod, sonner all pre-existing)
- No email or OAuth provider integration
- No WebSocket infrastructure for real-time review updates
- No separate admin panel for moderation (AI handles it inline)
- No migration scripts (new tables, no schema changes to existing ones)
- No changes to the build/deploy pipeline

## Session Flow

1. **Parallel research** (~7 min): 3 exploration agents launched simultaneously — tracking system, UI patterns, AI/infra patterns. All three returned comprehensive reports.
2. **Feature brainstorming** (~5 min): Discussion with Trevor about scope, rating philosophy, username system design, moderation approach.
3. **Implementation** (~35 min): Built all 8 new files + 6 modifications. Backend first (tables, server actions, moderation), then identity layer (localStorage, hook, recovery words), then UI (modals, reviews section, integration).
4. **Iteration** (~10 min): Fixed double-modal pattern (inlined username claim), fixed unicode rendering issue in character count helper text, added optimistic review display, wrote the data wipe script.
5. **Commit** (~3 min): Two separate commits — chat improvements and social features — with conventional commit messages.
