# Scrape Stage Refactor: HTML → LeapEvent API

## Problem

`--source live` was broken. The PAX site (east.paxsite.com) loads exhibitor/demo data dynamically via JavaScript — our `fetch()` call got back an empty HTML shell and parsed 0 entries across all three pages.

## Discovery

The site's client-side JS fetches structured data from a **LeapEvent/GrowTix API** at `conventions.leapevent.tech/api/`. The API key (`bf9cc1a9-09d0-4bf7-9c13-96d85fe03f61`) is a public read-only key embedded in the page HTML — it identifies the PAX East 2026 event, not an authenticated session.

Three endpoints power the exhibitor pages:

| Endpoint | Returns |
|----------|---------|
| `/space_orders?key=` | All exhibitors (368) with full descriptions, tags, categories, booth, images |
| `/space_order_specials?key=` | Demos (161) + merch specials (174) = 335 total |
| `/space_order_categories?key=` | Category definitions (Exhibitor, Tabletop, Premium, etc.) |

The API data is richer than what HTML scraping provided:
- **Full descriptions** (HTML truncated them)
- **161 demos** vs 109 from HTML parsing
- **Structured tags** with IDs instead of CSS class extraction
- **Tabletop membership** is a category on the exhibitor record, not a separate page

## Solution

Replaced the HTML fetch+parse path for `--source live` with API fetch+transform. `--source local` still uses the sample HTML files (regression safety net for tests).

### New files
- **`scrape/api.ts`** — API response TypeScript types + pure transform functions (`transformExhibitors`, `transformDemos`). No side effects, easy to test.
- **`scrape/api.test.ts`** — 14 unit tests covering field mapping, tabletop detection, edge cases (empty images, trailing spaces, special filtering).
- **`scrape/fetch.ts`** — Replaces `fetch-html.ts`. Exports `fetchLocalHtml()` for local mode and `fetchApi()` for live mode.

### Modified files
- **`cli.ts`** — `--source live` routes through `fetchApi()` → `transformExhibitors()` + `transformDemos()`. Local path unchanged.
- **`index.ts`** — Updated exports.
- **`integration.test.ts`** — Import path fix (`fetch-html` → `fetch`).

### Deleted files
- **`scrape/fetch-html.ts`** — Replaced by `fetch.ts`.

### Key design decisions
- **Tabletop detection**: Exhibitors with category id `19605` ("Tabletop") appear in both the exhibitors and tabletop output arrays, matching the prior HTML behavior where the same exhibitor appeared on both pages. This keeps harmonize untouched.
- **Demo filtering**: Only `type === "exclusive"` specials are demos. `type === "special"` entries are merch/promos — filtered out.
- **Image selection**: API returns `{big, med, small, thumb}` or `[]`. We use `small` for consistency with the HTML scraper's image sizes.

## Results

| Metric | Local (HTML) | Live (API) |
|--------|-------------|------------|
| Exhibitors | 345 | 368 |
| Demos | 109 | 161 |
| Tabletop | 43 | 43 |
| Harmonized games | 396 | 443 |
| Unmatched demos | 0 | 0 |
