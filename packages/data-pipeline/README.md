# @pax-pal/data-pipeline

Data pipeline for scraping, harmonizing, enriching, classifying, and embedding PAX East 2026 game data.

## Pipeline Stages

| Stage | Status | Input | Output |
|-------|--------|-------|--------|
| **Scrape** | Done | HTML pages (local/live) | `01-scraped/{exhibitors,demos,tabletop}.json` |
| **Harmonize** | Done | Scraped JSON files | `02-harmonized/games.json` |
| **Enrich** | Planned | Harmonized games | `03-enriched/games.json` |
| **Classify** | Planned | Enriched games | `04-classified/games.json` |
| **Embed** | Planned | Classified games | `05-embedded/games.json` |

## Usage

```bash
# Run full pipeline
bun run src/cli.ts all

# Run individual stages
bun run src/cli.ts scrape
bun run src/cli.ts harmonize

# Use live HTML instead of local samples
bun run src/cli.ts scrape --source live
```

## Output

All intermediate data written to `miscellaneous/data/`.

## Testing

```bash
bun test
```
