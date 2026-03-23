# @pax-pal/data-pipeline

Data pipeline for scraping, harmonizing, discovering, enriching, classifying, embedding, and loading PAX East 2026 game data.

## Pipeline Stages

| Stage | Input | Output |
|-------|-------|--------|
| **Scrape** | HTML pages (local) or LeapEvent API (live) | `01-scraped/{exhibitors,demos,tabletop}.json` |
| **Harmonize** | Scraped JSON files | `02-harmonized/{exhibitors,games}.json` |
| **Discover** | Harmonized exhibitors | Updated `02-harmonized/games.json` (discovered games appended) |
| **Enrich** | Harmonized games | `03-enriched/games.json` + `enrichment-meta.json` |
| **Classify** | Enriched games | `04-classified/games.json` + `classifications.json` |
| **Embed** | Classified games | `05-embedded/games.json` (with 3072d vectors) |
| **Load** | Embedded games + exhibitors | DynamoDB tables + S3 Vectors index |

## Usage

```bash
# Run full pipeline (excludes load unless env vars are set)
bun run src/cli.ts all

# Run individual stages
bun run src/cli.ts scrape
bun run src/cli.ts harmonize
bun run src/cli.ts discover
bun run src/cli.ts enrich
bun run src/cli.ts classify
bun run src/cli.ts embed
bun run src/cli.ts load

# Use live API instead of local HTML
bun run src/cli.ts scrape --source live

# Enable Tier 3 web search for discover
bun run src/cli.ts discover --web-search

# Dry-run load (prints what would be written)
bun run src/cli.ts load --dry-run
```

## Environment Variables

| Variable | Required for | Description |
|----------|-------------|-------------|
| `OPENAI_API_KEY` | Discover, Enrich | OpenAI API key for LLM classification and web search |
| `GEMINI_API_KEY` | Embed | Google Gemini API key for embedding generation |
| `GAMES_TABLE_NAME` | Load | DynamoDB Games table name (from SST output) |
| `EXHIBITORS_TABLE_NAME` | Load | DynamoDB Exhibitors table name (from SST output) |
| `VECTOR_INDEX_ARN` | Load | S3 Vectors index ARN (from SST output) |

### Running the load stage

After deploying infrastructure with `sst deploy --stage dev`, set the required env vars from SST outputs:

```bash
GAMES_TABLE_NAME=<from sst output> \
EXHIBITORS_TABLE_NAME=<from sst output> \
VECTOR_INDEX_ARN=<from sst output> \
bun run --filter data-pipeline load
```

## Output

All intermediate data written to `miscellaneous/data/`. Caches stored in `miscellaneous/data/cache/`.

## Testing

```bash
bun test
```
