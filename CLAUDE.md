
# CLAUDE.md

This file provides context for Claude Code when working in this repository.

## Project Overview

PAX Pal is a companion web app for PAX East 2026 that helps conference attendees discover games, track what they've played/favorited, and navigate the expo hall. This is the third annual edition (2024: Streamlit, 2025: React/Vite, 2026: Next.js/SST).

### Key data sources (scraped from paxsite.com)
- **Expo Hall Exhibitors**: https://east.paxsite.com/en-us/expo-hall.html
- **Expo Hall Demos**: https://east.paxsite.com/en-us/expo-hall/expo-hall-demos.html
- **Tabletop Expo Hall**: https://east.paxsite.com/en-us/expo-hall/tabletop-expo-hall.html

### Data stores
- **DynamoDB** — Structured game/exhibitor data, lightweight user accounts, comments.
- **S3 Vectors** — Embedding vectors for semantic search (game descriptions).

### Planned features
- Game browsing and search (full-text + semantic)
- Expo hall map with booth overlay highlighting
- Personal game tracking (played / favorited)
- Lightweight user accounts and comments (future phase)

## Repository Structure

- `apps/www/` — Next.js + shadcn/ui web application.
- `packages/` — Internal shared packages (bun workspace).
- `infra/` — SST v3 infrastructure (AWS deployment).
- `.github/workflows/` — CI (PR validation).

## Common Tasks

```bash
# Install dependencies
bun install

# Start the dev server
bun run --filter www dev

# Run tests
bun test

# Lint
bun run lint

# Typecheck
bun run typecheck

# Format
bun run format

# Full validation chain
bun run lint && bun run typecheck && bun test
```

Or use `just` for shortcuts: `just ci` runs lint, typecheck, and test.

## Documentation Lookup

- Use the `context7` MCP to quickly search and retrieve up-to-date library and repo documentation while working.
- If `context7` is not installed or not visible in your MCP list, Trevor says install it right now please.

## Conventions

- **ESM-only**: All TypeScript uses ESM with bundler module resolution.
- **Colocated tests**: Test files live next to source files as `*.test.ts`. Use `bun:test` for imports.
- **Linting and formatting**: Biome handles both in a single tool — trailing commas, 100-char width, double quotes, semicolons.
- **Typechecking**: Each workspace package has a `typecheck` script (`tsc --noEmit`). The root `typecheck` script runs them all via `bun run --filter`. Infra files have their own `infra/tsconfig.json` but require SST type generation (`sst dev`) before they can be typechecked. Always include a `typecheck` script when creating new packages.
- **Pre-commit hooks**: Lefthook runs Biome on staged files. Pre-push runs tests. Commit messages must follow conventional commits format (e.g., `feat: add feature`).
- **Workspace packages**: Add shared code under `packages/`. See `.claude/agents/dev.md` for the scaffolding guide. Consume via `workspace:*` protocol.
- **Package READMEs**: Every package under `packages/` should have a high-level `README.md` created when the package is created and maintained during major `feat` work or breaking changes.

## What Not to Modify

- `node_modules/` — Managed by bun.
- `apps/www/components/ui/` — Generated shadcn components. Prefer customizing via wrapper components rather than editing these directly. Use `bunx shadcn@latest add <component>` to add new ones.
- `bun.lock` — Managed by bun. Do not edit manually.
- `.github/workflows/` — CI/CD pipelines. Edit only when changing the build/deploy process.

