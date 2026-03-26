# Pipeline Rerun Notes — 2026-03-26

## Problem

Unconfirmed games are missing taglines and don't show up in recommendations. Root cause: the enrich stage's `--min-tier` flag gates which games get web enrichment. Games that don't pass the tier filter get no web data, which cascades:

1. **No web enrichment** → null cache entry in `cache/enrich/web/`
2. **Tagline backfill skips them** → `backfill-taglines.ts` line 78: `if (data === null) continue`
3. **Weak/missing embeddings** → embed step has little to work with (just the game name)
4. **Empty `similarGameIds`** → similarity step skips games without embeddings
5. **Invisible to recommendations** → overlap scoring never surfaces them

## Fix

When rerunning the full pipeline, **drop the `--min-tier` flag** (or use `--min-tier low`) so all discovered games get web enrichment:

```bash
bun run src/cli.ts enrich --min-tier low
```

This lets enrichment, embedding, similarity, and tagline generation flow through for every game — confirmed or not.

## Also

- The `backfill-taglines.ts` script should be updated to handle null cache entries by falling back to just the game name. Even without web data, the LLM can produce a decent tagline from the name alone.
- Downstream stages (embed, similar, load) have **no** confirmed filtering — they process everything. The enrich stage is the only bottleneck.
