# AI Chatbot Build Report — How PAX Pal Got an AI Agent in One Hour

**Date**: March 26, 2026
**Builder**: Trevor + Claude Opus 4.6 (1M context)
**Time**: ~1 hour, single Claude Code session
**Commit**: `7c9e95c` — `feat(www): add AI chatbot with RAG-powered game discovery`

---

## The Prompt

Trevor's opening message was deliberately loose — "I want to create an AI chatbot in the next hour" — with pointers to three documentation files he'd collected and a model choice (`gemini-3.1-flash-lite-preview`). The key instruction was to brainstorm first, *then* plan, *then* build. He wanted a lean agent with RAG tools over the existing game data, watchlist awareness, and inline game card UI.

## Context Sources — What the Agent Read

### 1. User-provided documentation (`miscellaneous/docs/ai-sdk-chatbot/`)

Three files were read in parallel at the start of the session:

- **`rag-agent-guide.md`** — Vercel's official AI SDK RAG tutorial. Established the canonical pattern: `streamText` + `tool()` + `useChat` hook + multi-step calls via `stopWhen(stepCountIs(n))`. This was the primary architectural reference. Most of the route handler structure (streaming response, tool definitions with Zod schemas, `convertToModelMessages`) came directly from patterns in this guide.

- **`chat-gpt-search.md`** — A ChatGPT conversation Trevor had about building mobile chatbots with AI SDK. Key takeaway: there's no separate "mobile SDK" — you build a responsive UI around `useChat`. Also surfaced the `h-dvh` CSS trick for iOS and the concept of generative UI (tool call → structured data → React component).

- **`ai-elements-chatbot.md`** — The AI Elements chatbot tutorial from Vercel. This was the richest UI reference — showed the `message.parts` switch pattern for rendering tool calls, text, reasoning, and sources. The `PromptInput` compound component pattern and `Conversation` layout were noted but deliberately *not* adopted (too heavy for v1). The simpler `useChat` + raw HTML approach won out for speed.

### 2. Codebase exploration (Agent subagent)

A deep exploration agent was launched in parallel with the doc reads. It took ~60 seconds and 30 tool calls to map:

- **Data model**: `GameCardData` (lightweight projection) vs full `Game` type, 395+ games with 3072-dim Gemini embeddings.
- **Search infra**: Dual text + semantic search already existed in `apps/www/app/search/actions.ts`. `embedQuery()` and `queryVectors()` were ready to use.
- **Recommendations**: `getRecommendations(gameIds)` already averaged watchlist embeddings and returned 5 diverse recs via S3 Vectors ANN search.
- **DynamoDB access**: `getAllActiveGames()`, `getGameBySlug()`, `getGamesByBooth()` — all working, all cached.
- **SST secrets**: `GeminiApiKey` already wired up for embedding generation; same key works for the generation model.
- **User tracking**: Client-side localStorage (`pax-pal-tracking`) with watchlist/played records. No server-side auth.

This exploration was the single most valuable step. It revealed that **zero new data infrastructure was needed** — every tool the chatbot would use already existed as a function call.

### 3. Context7 / web search

Used sparingly for API surface confirmation (AI SDK `@ai-sdk/google` provider setup, `DefaultChatTransport` API). Most of the implementation knowledge came from the user-provided docs.

## What Was "Taken Advantage Of" — Existing Infrastructure

The entire chatbot was possible in an hour because the codebase was *already* a RAG system that just didn't have a conversational interface:

| Existing capability | How the chatbot used it |
|---|---|
| `embedQuery()` (Gemini embedding API) | `searchGames` tool embeds the user's natural language query |
| `queryVectors()` (S3 Vectors ANN search) | `searchGames` tool finds semantically similar games |
| `getAllActiveGames()` (DynamoDB scan, cached) | Hydrates vector results into `GameCardData` for the UI |
| `getGameBySlug()` (DynamoDB lookup) | `getGameDetails` tool fetches full game info |
| `getGamesByBooth()` (DynamoDB GSI query) | `getBoothGames` tool answers "what's at booth X?" |
| `getRecommendations()` (taste vector → ANN) | `analyzeWatchlist` tool gives personalized recs |
| `GameCard` component | Renders inline in chat as tool output |
| `useTrackingList()` hook | Passes watchlist IDs to the API route for personalization |
| `GeminiApiKey` SST secret | Same key used for both embeddings and the generation model |
| `toGameCardData()` projection | Keeps tool outputs lightweight for both streaming and localStorage |

The chatbot introduced **no new database tables, no new S3 resources, no new secrets, and no new build steps**. It's a thin agent layer over existing functions.

## What Was Actually Built — 5 New Files, ~500 Lines

### Backend (2 files)

**`apps/www/lib/ai.ts`** (~130 lines) — Server-only module with:
- Lazy-initialized Google Generative AI provider (`@ai-sdk/google`) using the existing SST `GeminiApiKey` secret.
- `getModel()` returning `gemini-3.1-flash-lite-preview`.
- System prompt: strict rules about tool usage, brevity, booth numbers, 3–5 results per query.
- Three exported tools (`searchGames`, `getGameDetails`, `getBoothGames`) defined with Zod schemas and wired to existing DB/vector functions.

**`apps/www/app/api/chat/route.ts`** (~46 lines) — Next.js route handler:
- Receives `UIMessage[]` + `watchlistIds` from the client.
- Defines `analyzeWatchlist` tool inline (closes over the request's watchlist IDs).
- Calls `streamText()` with all 4 tools, `stopWhen: stepCountIs(3)` for multi-step.
- Returns `toUIMessageStreamResponse()` for streaming.

### Frontend (2 files)

**`apps/www/components/chat-page.tsx`** (~510 lines) — The main client component:
- `useChat` hook with `DefaultChatTransport` to `/api/chat`, passing watchlist IDs in the body.
- 7-message budget cap per conversation (cost control for a free app).
- `MessageBubble` renders `message.parts` — text parts through `react-markdown`, tool parts as inline `GameCard` components or loading skeletons.
- `WelcomeState` shows suggestion chips + past chat history.
- Conversation history: resume last chat on mount, view/continue/delete past chats, "New chat" button.
- Auto-scroll on new messages.
- Error state: "PAX Pal got lost in the expo hall!" with retry.
- Layout: `h-[calc(100dvh - header - nav)]` with flexbox, input pinned to bottom.

**`apps/www/lib/chat-storage.ts`** (~75 lines) — localStorage persistence:
- `StoredChat` type wrapping `UIMessage[]` with metadata (title extracted from first user message, creation timestamp, user message count).
- Read/write with graceful degradation (storage-full fallback drops to 5 chats).
- Max 20 stored conversations.

### Navigation changes (2 modified files)

- **`apps/www/components/bottom-nav.tsx`**: Replaced the Search tab with "PAX Pal" (MessageCircle icon) pointing to `/chat`.
- **`apps/www/app/page.tsx`**: Replaced "Search" quick action with "Ask PAX Pal" on the home page.

### Dependencies added

- `ai` + `@ai-sdk/react` + `@ai-sdk/google` — AI SDK core, React hooks, Google provider.
- `react-markdown` — Markdown rendering in assistant message bubbles (added after first test revealed raw `**bold**` and `*` bullets in responses).

## Design Decisions and Trade-offs

**Why Gemini 3.1 Flash Lite?** Trevor's choice. Cheap, fast, and the Gemini API key was already in SST secrets for embedding generation. No new provider setup needed.

**Why 7 messages?** Cost control for a free hobby app at a conference. Each message can trigger 1–2 tool calls (embedding + vector query), so 7 user messages ≈ 14 tool calls ≈ 14 embedding API calls worst case. Keeps per-session cost under a few cents.

**Why localStorage for chat history, not DynamoDB?** The app has no server-side auth — user tracking is already localStorage-based. Adding a DynamoDB chat table would mean either anonymous sessions (messy) or a full auth system (scope explosion). localStorage is consistent with the existing tracking architecture and costs nothing.

**Why not AI Elements?** The AI Elements components (`Conversation`, `PromptInput`, `Message`, etc.) are impressive but heavyweight — they pull in a lot of compound components and assume a specific layout model. For a v1 built in an hour, raw `useChat` + Tailwind + existing shadcn primitives was faster and more controllable. AI Elements is a solid upgrade path for v2.

**Why `react-markdown` instead of a lighter renderer?** First iteration rendered text as plain strings. The very first test response came back with `**bold**` and `*` bullet syntax visible as raw characters (captured in screenshot). `react-markdown` was the fastest fix — 1 dependency, 10 lines of component overrides.

**Why `stopWhen: stepCountIs(3)` instead of 5?** The RAG guide uses 5, but PAX Pal's tools are simpler — a typical query is: (1) user asks, (2) model calls searchGames, (3) model summarizes results. Three steps is enough. Fewer steps = faster responses = lower cost.

## Session Flow

The build followed a specific rhythm:

1. **Parallel research** (~2 min): Read all 3 docs + launched deep codebase exploration agent simultaneously. This front-loaded all context.
2. **Brainstorming** (~5 min): Back-and-forth with Trevor on architecture. Key realization: "zero new data infrastructure needed."
3. **Implementation plan** (~3 min): Wrote a structured plan with Trevor's approval.
4. **Backend build** (~8 min): `lib/ai.ts` + `app/api/chat/route.ts`. Mostly wiring existing functions to AI SDK tool definitions.
5. **Frontend build** (~15 min): `chat-page.tsx` — the bulk of the work. Chat UI, message rendering, tool output display, suggestion chips, error states.
6. **Chat storage** (~5 min): `chat-storage.ts` + integration into ChatPage.
7. **Iteration** (~20 min): Multiple rounds of testing and fixes:
   - Markdown rendering (added `react-markdown` after screenshot showed raw syntax)
   - Mobile layout (pinned input bar to bottom of viewport)
   - Conversation history (upgraded from single-slot to full history with browse/delete)
   - Biome lint fix (exhaustive deps on auto-scroll useEffect)
8. **Commit** (~2 min): Conventional commit with pre-commit hook pass.

## What Didn't Need to Be Built

This is arguably the most interesting part. The chatbot *didn't* require:

- No new database tables
- No new S3 buckets or vector indexes
- No new API keys or secrets
- No embedding pipeline changes
- No new data types or schemas
- No authentication system
- No WebSocket infrastructure (AI SDK's streaming works over HTTP)
- No state management library (React hooks + localStorage)

The entire feature was a **composition layer** — an AI agent that orchestrates existing capabilities through a conversational interface. The hardest part was the UI, not the AI.
