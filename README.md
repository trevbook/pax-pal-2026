
# pax-pal-2026

A Nova-style TypeScript project

PAX Pal is a companion web app for PAX East 2026 — the third year running. It helps attendees discover games, track what they've played, and navigate the expo hall. This year's edition is a serverless Next.js app deployed on AWS via SST, with DynamoDB for structured data and S3 Vectors for semantic search.

**Previous editions:** [2024](https://github.com/trevbook/pax-pal-2024) (Streamlit + embeddings) → [2025](https://github.com/trevbook/pax-pal-2025) (React + Vite) → **2026** (Next.js + SST + AWS).

## Prerequisites

- [Bun](https://bun.sh) (latest)
- Node.js 22+ (for Next.js dev server)
- AWS CLI (configured) for SST deployment

## Getting Started

```bash
# Install dependencies
bun install

# Start the dev server
bun run --filter www dev

# Run tests
bun test
```

Or use `just` for shortcuts — run `just` to see all available commands.

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun test` | Run tests (bun:test) |
| `bun test --watch` | Run tests in watch mode |
| `bun run lint` | Lint with Biome |
| `bun run lint:fix` | Lint and auto-fix |
| `bun run format` | Format with Biome |
| `bun run format:check` | Check formatting |
| `just ci` | Run all checks (lint, test) |

## Project Structure

```
pax-pal-2026/
  package.json              # Monorepo root with dev tooling
  tsconfig.json             # TypeScript base config (bundler, strict)
  biome.json                # Biome linting and formatting
  bunfig.toml               # Bun configuration
  lefthook.yml              # Git hook automation
  justfile                  # Task runner shortcuts
  apps/
    www/  # Next.js + shadcn/ui
  packages/                 # Internal shared packages
  infra/                    # SST infrastructure
  sst.config.ts             # SST entry point
  .github/workflows/
    ci.yml                  # PR/push validation
```

## Architecture

This is a bun workspace monorepo deployed with [SST v3](https://sst.dev/) on AWS.

- **Frontend** (`apps/www`): Next.js app with shadcn/ui. Handles game browsing, search, expo hall map overlay, and user interactions (favorites, played tracking, comments).
- **Data layer**: DynamoDB for structured game/exhibitor data and lightweight user accounts. S3 Vectors for embedding-based semantic search (e.g., "find me a cooperative deck-builder").
- **Data ingestion**: Game and exhibitor data is scraped from the official PAX East site (expo hall, tabletop expo hall, and demo listings) and loaded into the data stores.
- **Shared packages** (`packages/`): Internal libraries consumed across the app and infrastructure (e.g., shared types, scraping utilities).
- **Infrastructure** (`infra/`): SST resource definitions — tables, buckets, API routes, and the Next.js site itself.

## License

UNLICENSED

