
# Dev Agent — pax-pal-2026

You are a development agent for the **pax-pal-2026** monorepo.
Always read existing code before generating new code — patterns evolve and the source of truth is the codebase, not this document.

## Project Structure

```
pax-pal-2026/
├── apps/
│   └── www/  # Next.js + shadcn/ui app
├── packages/               # Internal shared packages
├── infra/                  # SST v3 infrastructure
│   ├── frontend.ts
│   └── secrets.ts
├── sst.config.ts           # SST entry point
├── biome.json              # Linting + formatting (Biome)
├── bunfig.toml             # Bun test config
├── tsconfig.json           # TypeScript base config (bundler resolution, strict)
├── lefthook.yml            # Git hooks (Biome pre-commit, tests pre-push)
├── justfile                # Task runner shortcuts
└── package.json            # Workspaces, scripts, dependencies
```

## Code Conventions

- **TypeScript strict mode** — no `any` unless absolutely necessary
- **ESM with bundler resolution** — `.js` extensions in imports are optional
- **Type-only imports** — use `import type { X } from "module"` (enforced by Biome)
- **Biome** handles both linting and formatting — double quotes, semicolons, trailing commas, 100-char width
- **Immutable by default** — prefer `readonly` properties, `const` over `let`

## Testing

- **Test runner**: bun:test (native, no config needed)
- **Imports**: `import { describe, expect, it } from "bun:test"`
- **File naming**: `*.test.ts` colocated next to source files
- **Run**: `bun test` or `just test`

Example:
```typescript
import { describe, expect, it } from "bun:test";
import { myFunction } from "./my-module";

describe("myFunction", () => {
  it("does the expected thing", () => {
    expect(myFunction("input")).toBe("output");
  });
});
```

## Scaffolding: New Package

To add a new internal package to the monorepo:

1. Create the directory structure:
   ```
   packages/<package-name>/
   ├── README.md
   ├── package.json
   ├── tsconfig.json
   └── src/
       └── index.ts
   ```

2. `package.json`:
   ```json
   {
     "name": "@<scope>/<package-name>",
     "version": "0.1.0",
     "private": true,
     "type": "module",
     "main": "./src/index.ts",
     "types": "./src/index.ts",
     "scripts": {
       "typecheck": "tsc --noEmit"
     },
     "devDependencies": {
       "@types/bun": "^1.3.9",
       "typescript": "^5.9.3"
     }
   }
   ```

3. `tsconfig.json`:
   ```json
   {
     "extends": "../../tsconfig.json",
     "compilerOptions": {
       "rootDir": "src",
       "outDir": "dist"
     },
     "include": ["src/**/*.ts"]
   }
   ```

4. Run `bun install` from the repo root to link the package.

5. Add to consuming packages: `bun add "@<scope>/<package-name>@workspace:*"`

6. Create and maintain a high-level `README.md` for every package under `packages/`:
   - Add it when the package is first created.
   - Keep it updated for major `feat` work and any breaking changes.

## Scaffolding: New API Route (Next.js App Router)

Add a route handler in `apps/www/app/api/<route>/route.ts`:

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "ok" });
}

export async function POST(request: Request) {
  const body = await request.json();
  // handle request
  return NextResponse.json({ success: true });
}
```

## Commit Message Format

Conventional commits are enforced by a commit-msg hook:

```
feat: add new feature
fix: resolve bug in auth flow
test: add tests for query builder
chore: update dependencies
docs: update README
refactor: simplify error handling
```

Format: `<type>[optional scope]: <description>`

## Pre-PR Checklist

Run all checks before pushing:

```bash
just ci
```

This runs: `lint → typecheck → test`

Or individually:
```bash
just lint        # Biome check
just typecheck   # tsc --noEmit (all packages + infra)
just test        # bun test
```

## Key File Paths

| File | Purpose |
|------|---------|
| `apps/www/` | Next.js application |
| `packages/` | Internal shared packages |
| `biome.json` | Linting + formatting rules |
| `tsconfig.json` | TypeScript base configuration |
| `lefthook.yml` | Git hook configuration |
| `justfile` | Task runner commands |
| `package.json` | Workspaces, scripts, deps |
| `CLAUDE.md` | Project context for Claude |
| `sst.config.ts` | SST entry point |
| `infra/frontend.ts` | Next.js deployment resource |
| `infra/secrets.ts` | SST secrets |

