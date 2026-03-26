# PAX Pal 2026 — Vibe-Coding Time Analysis

**Generated:** 2026-03-26

How much time has actually gone into building PAX Pal 2026 with Claude Code?

## TL;DR

**~27.5 hours of active coding** across **58 sessions** and **320 prompts** over 23 days (March 4–26, 2026).

## Methodology

Claude Code stores every conversation as a JSONL file under `~/.claude/projects/<project-hash>/`. Each line is a JSON object with a `timestamp` (ISO 8601), `type` (user, assistant, tool_use, etc.), and other metadata.

A Node.js script ([miscellaneous/analyze-sessions.mjs](../analyze-sessions.mjs)) was written to:

1. **Parse every JSONL file** for this project (61 files, 58 with actual messages).
2. **Extract timestamps** from each message to determine session start/end times.
3. **Calculate active time** by summing inter-message gaps, but **excluding idle gaps longer than 30 minutes** — if you walked away for an hour mid-session, that dead time doesn't count.
4. **Cap any single session** at 3 hours max as a safety valve.
5. **Aggregate** across all sessions by day.

One gotcha: in the Claude API protocol, tool results are wrapped in `role: "user"` messages. The script filters these out by only counting messages where the content array contains a `text` block (i.e., an actual human-typed prompt), not `tool_result` blocks. Without this filter, "user messages" was inflated ~10x (3,278 vs. 320).

This gives a much more honest number than wall-clock time (which totaled 125 hours due to overnight gaps and idle periods).

## Results

### Aggregate Statistics

| Metric               | Value          |
| -------------------- | -------------- |
| Total sessions       | 58             |
| Date range           | Mar 4 – Mar 26 |
| Total active time    | 27h 39m        |
| Total wall-clock     | 125h 10m       |
| Avg session (active) | 28m 36s        |
| Human prompts        | 320            |
| Assistant messages   | 4,683          |

### Daily Breakdown

| Date       | Sessions | Active Time | Prompts |
| ---------- | -------: | ----------: | ------: |
| 2026-03-04 |        3 |       2h 5m |      18 |
| 2026-03-05 |        1 |       1h 2m |       8 |
| 2026-03-18 |        9 |      2h 46m |      35 |
| 2026-03-19 |        8 |      4h 10m |      51 |
| 2026-03-23 |       21 |     10h 18m |     124 |
| 2026-03-24 |        1 |      1h 22m |       9 |
| 2026-03-25 |        2 |      0h 7m  |       5 |
| 2026-03-26 |       13 |      5h 46m |      70 |

### Timeline Pattern

The work happened in three distinct bursts with gaps in between:

1. **Mar 4–5 — Scaffolding** (3h 7m): Initial project setup, infrastructure, early data pipeline.
2. **Mar 18–19 — Data Pipeline** (6h 56m): Scraping, enrichment, embedding pipeline buildout.
3. **Mar 23–26 — Frontend Sprint** (17h 28m): The big push — full Next.js frontend, UI polish, recommendations, PWA, domain setup, and MVP finalization.

### Longest Sessions

| Duration | Date   | What was built                                |
| -------: | ------ | --------------------------------------------- |
|  1h 50m  | Mar 19 | Major data pipeline work                      |
|  1h 49m  | Mar 23 | Stage 3 frontend plan review + implementation |
|  1h 44m  | Mar 23 | Confirmed vs. unconfirmed games feature       |
|  1h 22m  | Mar 24 | Google Cloud Vision integration               |
|  1h 15m  | Mar 18 | Early pipeline/infrastructure work            |

## Caveats

- **Active time is a lower bound.** The 30-minute gap filter removes idle time, but also removes any genuine thinking/reading/testing done outside the Claude Code conversation.
- **Wall-clock time is an upper bound.** 125 hours includes overnight gaps where sessions were left open.
- **The truth is somewhere in between**, probably closer to the active number plus some manual testing/browsing overhead — so roughly **30–35 hours** total effort is a reasonable estimate.
- Sessions before Mar 23 lack AI-generated titles (the feature wasn't logged yet), so the earlier session descriptions are inferred from timestamps and git history.
