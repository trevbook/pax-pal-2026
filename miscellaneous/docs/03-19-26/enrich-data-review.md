# Enrich Stage — Data Quality Review

**Date**: March 19, 2026
**Data source**: `--limit 3` test run (3 random games), producing 26 web cache files, 4 BGG cache files, 19 Steam cache files.

---

## HIGH Priority

### 1. Fabricated screenshot URLs

The LLM invents plausible-looking Steam screenshot URLs with fake hex hashes. The URL validator catches them (they 404), but it wastes validation calls and indicates a prompting gap.

**Examples:**

`cache/enrich/web/demo:58308.json` (Angel Engine):
```json
"screenshotUrls": [
  "https://shared.akamai.steamstatic.com/.../ss_0f6f8b0b3b2d3c7f0c0f2df0f57b1b7f6a2c9f2b.jpg",
  "https://shared.akamai.steamstatic.com/.../ss_2d7a8e6f4e8d2e1f0c0f7d6c3a1b9e0d4f5a6b7c.jpg"
]
```

Also seen in: `demo:57405` (Curse Chapter), `demo:58995` (of the Devil), `demo:58450` (Disgaea Mayhem — uses `ss_1.jpg` through `ss_4.jpg`), `demo:58916` (Order Automatica).

**Fix — prompt + post-hoc:**
- Add to `web.ts` system prompt: *"Do NOT fabricate or guess URLs. If you cannot find an actual screenshot URL from search results, return an empty array. Never construct URLs by guessing hash patterns."*
- Post-hoc: could regex-reject `screenshotUrls` entries that look like fabricated hashes (e.g., 32+ hex char filenames that don't appear in any search result), though the URL validator already handles this.

### 2. Social links — bare domains and wrong domains

Three distinct sub-problems:

**2a. Steam linkfilter wrappers**

`cache/enrich/web/demo:59550.json` (Box Knight):
```json
"socialLinks": {
  "twitter": "https://steamcommunity.com/linkfilter/?url=https://twitter.com",
  "discord": "https://steamcommunity.com/linkfilter/?url=https://discord.gg",
  "youtube": "https://steamcommunity.com/linkfilter/?url=https://youtube.com"
}
```

These pass validation (Steam returns 200) and pass the bare-domain check (they're `steamcommunity.com` URLs). But they're useless — they redirect to bare social media homepages.

**2b. Wrong domain in field**

`cache/enrich/web/demo:58236.json` (Hazard Pay):
```json
"socialLinks": {
  "discord": "https://steamcommunity.com/app/2692620",
  "youtube": "https://www.youtube.com"
}
```

The `discord` field contains a Steam community page, not a Discord link. The `youtube` field is a bare domain that passes the current check because `youtube.com` returns 200.

**2c. Bare domains passing validation**

`cache/enrich/web/discovered:645780:we-were-here-tomorrow.json` has `discord: "https://discord.gg/"` — trailing slash variant not in the `BARE_SOCIAL_DOMAINS` set.

**Fix — multi-layer in `enrich.ts`:**
1. Strip Steam linkfilter wrappers: if URL starts with `steamcommunity.com/linkfilter/?url=`, extract the inner URL and re-evaluate.
2. Domain validation: `twitter` field must contain `x.com` or `twitter.com` in the host; `discord` must contain `discord.gg` or `discord.com`; `youtube` must contain `youtube.com` or `youtu.be`; `itchIo` must contain `itch.io`. Null out mismatches.
3. Path-required check: after stripping to the real URL, apply the existing bare-domain filter. Consider normalizing (strip trailing slash) before checking.
4. Prompt: add to system prompt: *"For socialLinks, each field must point to the game's ACTUAL profile on that platform. Do not use Steam community links, Steam linkfilter URLs, or any URL that doesn't belong to the specified platform. If you can't find the actual profile, return null."*

### 3. BGG enrichment returning null for all tabletop games

All 4 BGG cache files contain `null`:
- `discovered:643437:invincible-the-card-game-new-recruits.json`
- `discovered:643446:fishy-squishy-crusty-quirky.json`
- `discovered:643451:cheer-up.json`
- `discovered:644240:a-bunch-of-fun-guys.json`

These are all known published tabletop games. "A Bunch of Fun Guys" is a Gamewright title. "Invincible: The Card Game" is by Skybound Games. The BGG search should find them.

**Investigation needed — in `bgg.ts`:**
- Is the BGG API actually returning results for these queries? Add logging to `searchBgg()` to print candidate count and top match score.
- The game names have colons and subtitles ("Invincible: The Card Game - New Recruits") — try searching with just the first part before the colon/dash.
- Check if Levenshtein 0.60 threshold is too high for subtitled games. BGG often uses different subtitle formatting (e.g., "Invincible: The Card Game – New Recruits" with an em dash vs hyphen).
- Consider adding a "simplified name" search fallback: if no match on full name, retry with `name.split(/[:\-–—]/)[0].trim()`.

---

## MEDIUM Priority

### 4. Markdown citation artifacts in text fields

The LLM embeds OpenAI web search citation syntax in `summary` and `description` fields.

`cache/enrich/web/demo:58268.json` (ATMOSFAR) summary:
```
...floating-islands world. ([store.steampowered.com](https://store.steampowered.com/app/1798230/ATMOSFAR/?utm_source=openai))
```

Also seen in: `demo:56992` (Tower Tanks), `demo:59550` (Box Knight), `discovered:648353` (Terra Nova), `demo:58995` (of the Devil).

Note the `?utm_source=openai` tracking parameters too.

**Fix — prompt + post-hoc in `enrich.ts`:**
- Add to system prompt: *"Write summary and description as plain text. Do not include markdown links, citations, or source annotations in text fields. URLs belong in pressLinks/socialLinks, not inline in descriptions."*
- Post-hoc: regex strip patterns like `\(\[.*?\]\(https?://.*?\)\)` and `\?utm_source=openai` from `summary` and `description` fields in `scrubWebEnrichment()`.

### 5. `imageUrl` pointing to webpages, not images

Some `imageUrl` values point to HTML pages that return HTTP 200 but are not images.

| Game | `imageUrl` | Problem |
|------|-----------|---------|
| ItsyRealm | `https://itsyrealm.com/` | Homepage |
| Kiln | `https://assets.doublefine.com/` | Bare CDN domain |
| Never's End | `https://www.neversendgame.com/press-kit/` | Press kit page |
| THE GOOD OLD DAYS | `https://www.aksysgames.com/goodolddays/` | Product page |

**Fix — in `validate.ts`:**
- For `imageUrl` specifically, check the response `Content-Type` header. If it doesn't start with `image/`, treat it as invalid.
- Alternative: in `checkUrl()`, add an optional `expectedContentType` parameter. The orchestrator passes `"image"` for image URLs. If the HEAD response `Content-Type` doesn't match, return false.

### 6. Press links are storefronts, not editorial content

Several games got retail store pages classified as press coverage:

`cache/enrich/web/discovered:643437:invincible-the-card-game-new-recruits.json`:
```json
"pressLinks": [
  { "url": "https://www.gamenerdz.com/...", "source": "Game Nerdz", "type": "other" },
  { "url": "https://www.nobleknight.com/...", "source": "Noble Knight Games", "type": "other" },
  { "url": "https://www.cardhaus.com/...", "source": "Cardhaus", "type": "other" }
]
```

Also seen: Steam store pages and SteamDB links classified as "press" in Angel Engine, Lunarium, Dinobreak.

**Fix — prompt + post-hoc:**
- Add to system prompt: *"For pressLinks, only include editorial content — articles, reviews, previews, interviews from journalists or content creators. Do NOT include store pages (Steam, itch.io, retail shops), developer's own announcements, or database/tracker pages (SteamDB, HowLongToBeat)."*
- Post-hoc: filter `pressLinks` where `url` contains known store/db domains: `store.steampowered.com`, `steamdb.info`, `gamenerdz.com`, `nobleknight.com`, `cardhaus.com`, `boardgameprices.com`.

### 7. Steam `reviewScore` always null, `movies` always empty

**`reviewScore`**: The pipeline uses `data.metacritic?.score` (`steam.ts:81`), but most indie games lack Metacritic scores. The Steam API does expose `data.recommendations.total` (number of user reviews) but not a percentage score directly. Consider switching to `data.recommendations?.total` as a "review count" signal, or dropping this field since user review % requires a separate API call.

**`movies`**: Extraction at `steam.ts:55-58` maps `m.webm?.max` — this path may be wrong for the current Steam API response shape. The Steam API returns movies as:
```json
{ "id": 123, "name": "Trailer", "thumbnail": "...", "webm": { "480": "url", "max": "url" } }
```
The extraction looks correct in theory. Most likely these specific games just don't have movie entries in the API response. **Verify** by fetching a known game with trailers (e.g., `https://store.steampowered.com/api/appdetails?appids=1245620`) and checking if the `movies` field populates.

---

## LOW Priority

### 8. `playerCount` / `playTime` format inconsistency

Values are all over the place:

| Game | `playerCount` | `playTime` |
|------|--------------|------------|
| Disgaea Mayhem | `"1"` | `null` |
| ATMOSFAR | `"1-4"` | `null` |
| Katuba's Poacher | `"single-player"` | `null` |
| ItsyRealm | `"1 (optional small party co-op...)"` | `"5-10 hours currently in Early Access..."` |

**Fix**: Defer to classify stage. When classify normalizes taxonomy, it can also normalize these into structured formats. Alternatively, add examples to the web search prompt: *"Use numeric ranges like '1', '2-4', '1-6'. Do not write prose descriptions."*

### 9. Genre over-inflation

The LLM returns 5-9 genres with overlapping terms:

`demo:56686.json` (Litany) would have: "Strategy", "Card Game", "Roguelike", "Roguelike Deckbuilder", "Roguelite", "Deckbuilding", "Card Battler", "Turn-Based", "Turn-Based Strategy".

**Fix**: Defer to classify stage — taxonomy mapping will collapse these into the defined `VIDEO_GAME_GENRES` and `TABLETOP_MECHANICS` enum values, naturally deduplicating. The web enrichment uses loose `z.array(z.string())` intentionally for this reason.

### 10. Platform redundancy

Web enrichment sometimes returns both `"PC"` and `"Windows"` for the same game, or vague terms like `"Nintendo"` instead of `"Switch"`.

**Fix**: Same as genres — defer to classify stage. The `PLATFORMS` enum (`"PC"`, `"PlayStation"`, `"Xbox"`, `"Switch"`, `"Mobile"`, `"VR"`) will normalize these.

### 11. Kiln — completely fabricated URL stubs

`cache/enrich/web/discovered:650144:kiln.json` is an extreme case where the LLM couldn't find anything and filled every URL field with bare domain stubs:

```json
{
  "imageUrl": "https://assets.doublefine.com/",
  "steamUrl": "https://store.steampowered.com/app/",
  "trailerUrl": "https://youtu.be/",
  "screenshotUrls": ["https://assets.doublefine.com/", ...]
}
```

The URL validator catches these, but this is a sign the LLM needs stronger "return null, not a stub" instructions. Covered by the fix in issue #1.

---

## Summary

| # | Issue | Fix location | Effort |
|---|-------|-------------|--------|
| 1 | Fabricated screenshot URLs | `web.ts` prompt | Small |
| 2 | Social link domain issues | `enrich.ts` scrub + `web.ts` prompt | Medium |
| 3 | BGG returning all nulls | `bgg.ts` search logic + debugging | Medium |
| 4 | Markdown citations in text | `enrich.ts` scrub + `web.ts` prompt | Small |
| 5 | imageUrl pointing to HTML pages | `validate.ts` Content-Type check | Small |
| 6 | Store pages in pressLinks | `enrich.ts` filter + `web.ts` prompt | Small |
| 7 | Steam reviewScore/movies empty | `steam.ts` extraction paths | Small |
| 8 | playerCount/playTime format | Defer to classify | — |
| 9 | Genre over-inflation | Defer to classify | — |
| 10 | Platform redundancy | Defer to classify | — |
| 11 | URL stubs (Kiln) | Covered by #1 | — |
