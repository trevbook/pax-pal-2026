# Stage 2: Data Pipeline — Scrape & Harmonize

*2026-03-05T21:32:09Z by Showboat 0.6.1*
<!-- showboat-id: aa34b448-72af-4708-b3cf-67ac7dce85fa -->

## Package Structure

The `@pax-pal/data-pipeline` package handles scraping PAX East HTML pages and harmonizing the results into a unified game catalog. Here's what was built:

```bash
find packages/data-pipeline/src -type f -name "*.ts" \! -name "*.test.ts" | sort
```

```output
packages/data-pipeline/src/cli.ts
packages/data-pipeline/src/harmonize/harmonize.ts
packages/data-pipeline/src/index.ts
packages/data-pipeline/src/scrape/demos.ts
packages/data-pipeline/src/scrape/exhibitors.ts
packages/data-pipeline/src/scrape/fetch-html.ts
```

## Scrape Stage

Three HTML pages are parsed with cheerio: Expo Hall Exhibitors (345 entries), Demos (109 entries), and Tabletop Exhibitors (42 entries). The exhibitors and tabletop pages share identical HTML structure, so a single `parseExhibitorPage()` handles both.

```bash
bun run packages/data-pipeline/src/cli.ts scrape 2>&1 | grep -v "Wrote\|^$"
```

```output
[scrape] Fetching HTML (source: local)...
[scrape] Parsing...
  Exhibitors: 345
  Demos: 109
  Tabletop: 42
[scrape] Done.
Pipeline complete.
```

A sample scraped exhibitor entry — note the PAX tags extracted from CSS classes and the booth location parsed from the description area:

```bash
bun -e "const d = await Bun.file('miscellaneous/data/01-scraped/exhibitors.json').json(); const {lastScrapedAt, ...rest} = d[0]; console.log(JSON.stringify(rest, null, 2))"
```

```output
{
  "id": "643353",
  "name": "AREA 35",
  "slug": "area-35",
  "boothLocation": "15043",
  "description": "AREA 35 is a game developer located in the heart of Tokyo, best known as the creator of the TINY …",
  "imageUrl": "https://conv-prod-app.s3.amazonaws.com/media/small/87/8/91/4b06b5e0-b88c-4d5a-92f4-68b19e094765.png",
  "showroomUrl": "https://east.paxsite.com/en-us/expo-hall/showroom.html?gtID=643353&exhibitor-name=AREA-35",
  "isFeatured": true,
  "paxTags": [
    "Action",
    "Adventure",
    "Early-Access-Demo",
    "Family-Friendly",
    "Indie",
    "Merch",
    "Mobile",
    "Multiplayer",
    "PC",
    "Puzzle",
    "Retro",
    "Sandbox",
    "Single-Player",
    "Strategy",
    "Third-Person",
    "Exhibitor"
  ],
  "sourcePage": "exhibitors"
}
```

A sample demo entry — the key field is `exhibitorId` which links directly to the exhibitor's `data-id`, enabling exact-match harmonization:

```bash
bun -e "const d = await Bun.file('miscellaneous/data/01-scraped/demos.json').json(); const {lastScrapedAt, ...rest} = d[0]; console.log(JSON.stringify(rest, null, 2))"
```

```output
{
  "id": "58318",
  "name": "Altered Alma",
  "exhibitorName": "Critical Reflex",
  "exhibitorId": "648079",
  "description": null,
  "imageUrl": "https://conv-prod-app.s3.amazonaws.com/media/med/71/19/20/51456bfe-8faf-4850-924f-63efa04e436d.png"
}
```

## Harmonize Stage

The harmonizer merges all three sources into a unified game list. Exhibitors form the base set, tabletop entries merge by ID to update type, and demos link via `exhibitorId`. Zero unmatched demos — no fuzzy matching was needed.

```bash
bun run packages/data-pipeline/src/cli.ts harmonize 2>&1 | grep -v "Wrote\|^$"
```

```output
[harmonize] Loading scraped data...
[harmonize] Merging...
  Games: 346
  Unmatched demos: 0
  By type: {"video_game":217,"tabletop":125,"both":4}
[harmonize] Done.
Pipeline complete.
```

A harmonized game that appeared on all three pages (exhibitor + tabletop + demo) — note type `both` and all three source pages tracked:

```bash
bun -e "const d = await Bun.file('miscellaneous/data/02-harmonized/games.json').json(); const g = d.find(x => x.type === 'both'); const {lastScrapedAt, ...rest} = g; console.log(JSON.stringify(rest, null, 2))"
```

```output
{
  "id": "643268",
  "name": "Addax Games",
  "slug": "addax-games",
  "type": "both",
  "exhibitor": "Addax Games",
  "boothLocation": "11081",
  "description": "Addax Games is an indie tabletop game publisher formed by a team of passionate board gamers …",
  "imageUrl": "https://conv-prod-app.s3.amazonaws.com/media/small/81/52/14/e1ec14cb-389d-49f5-9f55-563332640a91.png",
  "showroomUrl": "https://east.paxsite.com/en-us/expo-hall/showroom.html?gtID=643268&exhibitor-name=Addax-Games",
  "isFeatured": false,
  "paxTags": [
    "Adventure",
    "Co-op",
    "Early-Access-Demo",
    "Expo-Hall",
    "Family-Friendly",
    "Strategy",
    "Tabletop",
    "Exhibitor"
  ],
  "sourcePages": [
    "exhibitors",
    "demos"
  ],
  "demoId": "57925"
}
```

## Tests

25 tests cover the scrape and harmonize stages — field extraction from synthetic HTML, demo-to-exhibitor matching, type resolution, and edge cases:

```bash
bun test packages/data-pipeline 2>&1 | grep "pass\|fail\|expect"
```

```output
 25 pass
 0 fail
 44 expect() calls
```

## Full CI

Lint, typecheck, and all tests (including `@pax-pal/core`) pass:

```bash
bun run lint 2>&1 | grep -v "^$" | grep -v "ms\." && echo "---" && bun run typecheck 2>&1 | grep -v "^$" && echo "---" && bun test 2>&1 | grep "pass\|fail\|expect"
```

```output
$ biome check .
---
$ bun run --filter '*' typecheck
@pax-pal/core typecheck: Exited with code 0
@pax-pal/data-pipeline typecheck: Exited with code 0
www typecheck: Exited with code 0
---
 41 pass
 0 fail
 92 expect() calls
```
