set dotenv-load := true
set export := true

STAGE := "production"

# Default: show available commands
default:
    @just --list

# Install dependencies
install:
    bun install

# Run tests
test:
    bun test

# Run tests in watch mode
test-watch:
    bun test --watch

# Lint project files
lint:
    bunx biome check .

# Lint and auto-fix
lint-fix:
    bunx biome check --write .

# Format all files
format:
    bunx biome format --write .

# Typecheck all packages
typecheck:
    bun run typecheck


# Run all checks (CI)
ci: lint typecheck test

# Start the app dev server
dev:
    bun run --filter www dev

# Start SST dev mode
sst-dev:
    bunx sst dev --stage {{STAGE}}

# Set an SST secret
sst-set-secret SECRET VALUE:
    bunx sst secret set {{SECRET}} {{VALUE}} --stage {{STAGE}}

# Deploy with SST
sst-deploy:
    bunx sst deploy --stage {{STAGE}}

# Load pipeline data into AWS (DynamoDB + S3 Vectors)
load *ARGS:
    bunx sst shell --stage {{STAGE}} -- bun run packages/data-pipeline/src/cli.ts load {{ARGS}}


