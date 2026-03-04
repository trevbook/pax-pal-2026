---
name: post-setup
description: Finish setting up this Nova repo — install deps, validate, and generate docs
disable-model-invocation: true
allowed-tools: Bash(test *), Bash(bun *), Bash(bunx *), Bash(just *), Bash(git init)
---


# Post-Setup

You are finishing the setup of a freshly generated Nova-style TypeScript monorepo.

## Phase 1: Install and Validate

Run these steps in order. If any step fails, diagnose the issue and fix it before continuing.

1. Verify `.git/` exists (should have been created by the template). If not, run `git init`.
2. Verify bun is installed by running `bun --version`. If not installed, instruct the user to install it from https://bun.sh
3. Run `bun install` from the repo root.
4. Run `bun run format` to normalize all files (especially shadcn output) to the project's Biome config.
5. Run the full validation chain:
   ```bash
   bun run lint && bun run typecheck && bun test
   ```
6. If any step fails, fix the issue and re-run from that step.

## Phase 2: Interview

Ask the user a few open-ended questions in plain text to understand the project. Do NOT use AskUserQuestion — just ask conversationally and let them respond naturally.

Start with something like:

> Before I generate the project docs, I'd like to understand what you're building. Tell me about this project — what is it, what problem does it solve, and who is it for?

Then follow up based on their answer. You might ask about:
- Key technical decisions or constraints (specific APIs, data sources, deployment targets)
- Anything contributors should understand about the intended architecture
- Whether the default package.json description should be updated

Keep it to 2–3 exchanges. Don't over-interview.

## Phase 3: Generate Documentation

The README.md and CLAUDE.md have already been scaffolded with deterministic content (project structure, prerequisites, available scripts, conventions). Your job is to fill in the project-specific sections.

Based on the user's answers from Phase 2:

1. **Update `README.md`**:
   - Replace the `<!-- CLAUDE:PROJECT_DESCRIPTION -->` placeholder with a real project description
   - Replace the `<!-- CLAUDE:ARCHITECTURE_NOTES -->` placeholder with architecture context from the interview

2. **Update `CLAUDE.md`**:
   - Replace the `<!-- CLAUDE:PROJECT_CONTEXT -->` placeholder with architectural context from the interview
   - Add any project-specific conventions or notes the user mentioned

3. **Update `package.json`** description if the user gave a better one than the default.

4. Run `bun run format` and then `bun run format:check` to ensure all edits are cleanly formatted.

## Known Issues to Watch For

- **Lefthook prepare fails:** Ensure `.git/` exists before `bun install`.
- **shadcn uses npm internally:** You may see warnings about different package managers. These are harmless — bun takes over on workspace install.
- **Biome format differences from shadcn defaults:** shadcn scaffolds with its own formatting. Run `bun run format` to normalize everything to the project's Biome config before running `bun run format:check`.

