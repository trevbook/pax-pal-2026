#!/usr/bin/env python3
"""
Taxonomy Exploration Script for PAX Pal 2026

Analyzes scraped/enriched game data to propose a data-driven taxonomy
for the classify stage. Examines paxTags, web enrichment genres/mechanics,
BGG mechanics, and Steam genres/categories.

Usage:
    cd miscellaneous/python
    uv run python explore_taxonomy.py
"""

import json
from collections import Counter
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"


def load_json(path: Path) -> list:
    with open(path) as f:
        return json.load(f)


def section(title: str) -> None:
    print(f"\n{'=' * 70}")
    print(f"  {title}")
    print(f"{'=' * 70}")


def subsection(title: str) -> None:
    print(f"\n--- {title} ---")


def print_counter(counter: Counter, label: str = "", min_count: int = 1) -> None:
    if label:
        print(f"\n{label} ({len(counter)} unique):")
    for item, count in counter.most_common():
        if count >= min_count:
            print(f"  {item}: {count}")


# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------

games = load_json(DATA_DIR / "02-harmonized" / "games.json")
exhibitors = load_json(DATA_DIR / "02-harmonized" / "exhibitors.json")

enrichment_meta_path = DATA_DIR / "03-enriched" / "enrichment-meta.json"
enrichment_meta = load_json(enrichment_meta_path) if enrichment_meta_path.exists() else []

enriched_games_path = DATA_DIR / "03-enriched" / "games.json"
enriched_games = load_json(enriched_games_path) if enriched_games_path.exists() else []

# ---------------------------------------------------------------------------
# 1. Basic stats
# ---------------------------------------------------------------------------

section("1. DATA OVERVIEW")

types = Counter(g["type"] for g in games)
has_desc = sum(1 for g in games if g.get("description"))
demo_sourced = sum(1 for g in games if g.get("demoId"))
discovered = sum(1 for g in games if g.get("discoverySource"))

print(f"Total harmonized games: {len(games)}")
print(f"  video_game: {types['video_game']}")
print(f"  tabletop:   {types['tabletop']}")
print(f"  both:       {types['both']}")
print(f"  Has description: {has_desc}/{len(games)}")
print(f"  Demo-sourced: {demo_sourced}")
print(f"  Discovered: {discovered}")
print(f"\nTotal exhibitors: {len(exhibitors)}")
print(f"Total enrichment meta records: {len(enrichment_meta)}")
print(f"Total enriched games: {len(enriched_games)}")

# ---------------------------------------------------------------------------
# 2. paxTag analysis
# ---------------------------------------------------------------------------

section("2. PAX TAG ANALYSIS")

pax_tags = Counter()
pax_tags_by_type = {"video_game": Counter(), "tabletop": Counter(), "both": Counter()}

for g in games:
    for t in g.get("paxTags", []):
        pax_tags[t] += 1
        pax_tags_by_type[g["type"]][t] += 1

print_counter(pax_tags, "All paxTags")

subsection("paxTags by game type")
for gtype, counter in pax_tags_by_type.items():
    if counter:
        print_counter(counter, f"  {gtype}", min_count=2)

# Categorize paxTags into proposed taxonomy buckets
subsection("Proposed paxTag → taxonomy mapping")

PAX_TAG_MAPPING = {
    # Genre tags (video game)
    "Action": "VIDEO_GAME_GENRE → Action",
    "Adventure": "VIDEO_GAME_GENRE → Adventure",
    "Fighting": "VIDEO_GAME_GENRE → Fighting",
    "Horror/Survival": "VIDEO_GAME_GENRE → Horror + Survival",
    "Platformer": "VIDEO_GAME_GENRE → Platformer",
    "Puzzle": "VIDEO_GAME_GENRE → Puzzle",
    "Roguelike": "VIDEO_GAME_GENRE → Roguelike",
    "RPG": "VIDEO_GAME_GENRE → RPG",
    "JRPG": "VIDEO_GAME_GENRE → JRPG",
    "Sandbox": "STYLE_TAG → Sandbox",
    "Shooter": "VIDEO_GAME_GENRE → Shooter",
    "Strategy": "VIDEO_GAME_GENRE → Strategy",
    "Simulation": "VIDEO_GAME_GENRE → Simulation (note: not in paxTags currently)",
    "MMO": "VIDEO_GAME_GENRE → MMO",
    # Perspective tags (not genres, but useful metadata)
    "First Person": "STYLE_TAG or PERSPECTIVE (not a genre)",
    "Third Person": "STYLE_TAG or PERSPECTIVE (not a genre)",
    # Tabletop tags
    "Tabletop": "GAME_TYPE indicator (type=tabletop)",
    "Deck Builder": "TABLETOP_MECHANIC → Deck-Builder",
    "Dice": "TABLETOP_MECHANIC → Dice",
    "CCG": "TABLETOP_MECHANIC → CCG",
    # Platform tags
    "PC": "PLATFORM → PC",
    "PlayStation": "PLATFORM → PlayStation",
    "Xbox": "PLATFORM → Xbox",
    "Nintendo Switch": "PLATFORM → Switch",
    "Mobile": "PLATFORM → Mobile",
    "VR": "PLATFORM → VR",
    "Notebook/Laptop": "PLATFORM → PC (alias)",
    # Audience tags
    "Family Friendly": "AUDIENCE_TAG → Family-Friendly",
    "Single Player": "AUDIENCE_TAG → Single-Player",
    "Multiplayer": "AUDIENCE_TAG → Multiplayer",
    "Co-op": "AUDIENCE_TAG → Co-op",
    "PAX Together": "AUDIENCE_TAG → PAX Together",
    # Business tags
    "Free to Play": "BUSINESS_TAG → Free-to-Play",
    "Early Access/Demo": "BUSINESS_TAG → Early Access Demo",
    "Indie": "BUSINESS_TAG → Indie",
    "Retail": "BUSINESS_TAG → Retail",
    # Other tags
    "Merch": "OTHER_TAG → Merch",
    "Apparel": "OTHER_TAG → Apparel",
    "Components": "OTHER_TAG → Components",
    "Peripherals": "OTHER_TAG → (non-game, skip)",
    # Meta tags
    "Expo Hall": "META (all games are in expo hall, ignore)",
    "Retro": "STYLE_TAG → Retro",
}

for tag, mapping in sorted(PAX_TAG_MAPPING.items(), key=lambda x: x[1]):
    count = pax_tags.get(tag, 0)
    print(f"  {tag} ({count}) → {mapping}")

# Identify unmapped paxTags
unmapped = set(pax_tags.keys()) - set(PAX_TAG_MAPPING.keys())
if unmapped:
    print(f"\n  UNMAPPED paxTags: {unmapped}")

# ---------------------------------------------------------------------------
# 3. Enrichment genre/mechanic analysis
# ---------------------------------------------------------------------------

section("3. ENRICHMENT DATA ANALYSIS")

web_genres = Counter()
web_mechanics = Counter()
web_platforms = Counter()
bgg_mechanics = Counter()
steam_genres = Counter()
steam_categories = Counter()

for m in enrichment_meta:
    if m.get("web"):
        for g in m["web"].get("genres") or []:
            web_genres[g] += 1
        for mech in m["web"].get("mechanics") or []:
            web_mechanics[mech] += 1
        for p in m["web"].get("platforms") or []:
            web_platforms[p] += 1
    if m.get("bgg"):
        for mech in m["bgg"].get("mechanics") or []:
            bgg_mechanics[mech] += 1
    if m.get("steam"):
        for g in m["steam"].get("genres") or []:
            steam_genres[g] += 1
        for c in m["steam"].get("categories") or []:
            steam_categories[c] += 1

print_counter(web_genres, "Web enrichment genres")
print_counter(web_mechanics, "Web enrichment mechanics")
print_counter(bgg_mechanics, "BGG mechanics")
print_counter(steam_genres, "Steam genres")
print_counter(steam_categories, "Steam categories")
print_counter(web_platforms, "Web platforms")

if not enrichment_meta:
    print("\n  ⚠ No enrichment meta data found. Run the full enrich stage first")
    print("    for richer genre/mechanic analysis.")

# ---------------------------------------------------------------------------
# 4. Gap analysis: what's in enrichment but not current taxonomy?
# ---------------------------------------------------------------------------

section("4. GAP ANALYSIS")

CURRENT_VIDEO_GENRES = {
    "Action", "Adventure", "Fighting", "Horror", "Platformer", "Puzzle",
    "Roguelike", "RPG", "JRPG", "Sandbox", "Shooter", "Strategy",
    "Simulation", "Retro",
}

CURRENT_TABLETOP_MECHANICS = {
    "Deck-Builder", "Dice", "CCG", "Co-op Play", "Worker Placement",
    "Area Control", "Roll-and-Write",
}

subsection("Enrichment genres NOT in current VIDEO_GAME_GENRES")
for genre, count in web_genres.most_common():
    if genre not in CURRENT_VIDEO_GENRES:
        print(f"  {genre}: {count}")
for genre, count in steam_genres.most_common():
    if genre not in CURRENT_VIDEO_GENRES:
        print(f"  [Steam] {genre}: {count}")

subsection("Enrichment mechanics NOT in current TABLETOP_MECHANICS")
all_enrichment_mechanics = bgg_mechanics + web_mechanics
for mech, count in all_enrichment_mechanics.most_common():
    if mech not in CURRENT_TABLETOP_MECHANICS:
        print(f"  {mech}: {count}")

# ---------------------------------------------------------------------------
# 5. Proposed taxonomy
# ---------------------------------------------------------------------------

section("5. PROPOSED TAXONOMY")

subsection("VIDEO_GAME_GENRES (expanded)")
proposed_vg_genres = [
    "Action", "Adventure", "Fighting", "Horror", "Platformer", "Puzzle",
    "Roguelike", "RPG", "JRPG", "Shooter", "Strategy", "Simulation",
    # New additions based on data:
    "Survival",       # paxTag "Horror/Survival" splits into Horror + Survival
    "MMO",            # paxTag "MMO" (3 games)
    "Racing",         # common genre, not in paxTags but likely in enrichment
    "Rhythm",         # niche but distinct
    "Sports",         # common genre
    "Tower Defense",  # common indie genre at PAX
    "Visual Novel",   # common indie genre at PAX
    "Metroidvania",   # common indie genre at PAX
    "Souls-like",     # common indie genre at PAX
]
for i, g in enumerate(proposed_vg_genres, 1):
    marker = " (NEW)" if g not in CURRENT_VIDEO_GENRES else ""
    count = pax_tags.get(g, 0) + pax_tags.get(g.replace("-", " "), 0)
    count_str = f" [paxTag count: {count}]" if count else ""
    print(f"  {i:2d}. {g}{marker}{count_str}")

subsection("TABLETOP_GENRES (new category)")
proposed_tt_genres = [
    "Board Game", "Card Game", "Miniatures", "RPG/TTRPG",
    "Party Game", "War Game", "Escape Room",
]
for i, g in enumerate(proposed_tt_genres, 1):
    print(f"  {i}. {g}")

subsection("TABLETOP_MECHANICS (expanded)")
proposed_tt_mechanics = [
    # Existing
    "Deck-Builder", "Dice", "CCG", "Co-op Play", "Worker Placement",
    "Area Control", "Roll-and-Write",
    # New additions
    "Hand Management", "Set Collection", "Drafting", "Tile Placement",
    "Push Your Luck", "Deduction", "Engine Building", "Negotiation",
]
for i, m in enumerate(proposed_tt_mechanics, 1):
    marker = " (NEW)" if m not in CURRENT_TABLETOP_MECHANICS else ""
    bgg_count = bgg_mechanics.get(m, 0)
    web_count = web_mechanics.get(m, 0)
    if bgg_count or web_count:
        print(f"  {i:2d}. {m}{marker} [BGG: {bgg_count}, Web: {web_count}]")
    else:
        print(f"  {i:2d}. {m}{marker}")

subsection("STYLE_TAGS (new category)")
proposed_style_tags = [
    "Retro", "Pixel Art", "Cozy", "Narrative-Driven", "Sandbox", "Open World",
]
for i, t in enumerate(proposed_style_tags, 1):
    count = pax_tags.get(t, 0)
    count_str = f" [paxTag count: {count}]" if count else ""
    print(f"  {i}. {t}{count_str}")

subsection("AUDIENCE_TAGS (expanded)")
proposed_audience = [
    "Family-Friendly", "Single-Player", "Multiplayer", "Co-op", "PAX Together",
    # New
    "Competitive", "Local Multiplayer", "Online Multiplayer",
]
for i, t in enumerate(proposed_audience, 1):
    mapped_pax = t.replace("-", " ")
    count = pax_tags.get(mapped_pax, 0) or pax_tags.get(t, 0)
    count_str = f" [paxTag count: {count}]" if count else ""
    new = " (NEW)" if t in ("Competitive", "Local Multiplayer", "Online Multiplayer") else ""
    print(f"  {i}. {t}{new}{count_str}")

subsection("BUSINESS_TAGS (unchanged)")
for t in ["Free-to-Play", "Early Access Demo", "Indie", "Retail"]:
    mapped_pax = t.replace("-", " ")
    count = pax_tags.get(mapped_pax, 0) or pax_tags.get(t, 0)
    # Handle special mappings
    if t == "Free-to-Play":
        count = pax_tags.get("Free to Play", 0)
    elif t == "Early Access Demo":
        count = pax_tags.get("Early Access/Demo", 0)
    print(f"  {t} [paxTag count: {count}]")

subsection("OTHER_TAGS (unchanged)")
for t in ["Merch", "Apparel", "Components"]:
    count = pax_tags.get(t, 0)
    print(f"  {t} [paxTag count: {count}]")

# ---------------------------------------------------------------------------
# 6. Summary
# ---------------------------------------------------------------------------

section("6. SUMMARY")

print("""
Key findings:
1. paxTags provide strong signal for ~80% of classification — most map directly
   to taxonomy values. "Horror/Survival" should split into two separate genres.

2. "Retro" and "Sandbox" are better as style tags than genres — they modify
   other genres (e.g., "Retro Platformer", "Sandbox RPG").

3. Perspective tags ("First Person", "Third Person") appear in paxTags but
   are NOT genres. Consider as metadata or drop.

4. "Expo Hall" is a meta tag present on all games — ignore in classification.

5. Tabletop games need a GENRE dimension (Board Game, Card Game, etc.)
   separate from MECHANICS (Deck-Builder, Dice, etc.). Currently only
   mechanics exist.

6. The enrichment data (when fully populated) will reveal additional
   free-form genres from web search, BGG, and Steam that should map
   to the expanded taxonomy.

7. paxTag coverage is excellent for platform detection — PC (149),
   PlayStation (36), Xbox (33), Switch (30), Mobile (15), VR (4).

Recommended next steps:
- Review this report with the enrichment data fully populated
- Finalize taxonomy values in taxonomy.ts
- Build paxTag → taxonomy mapping into the classify stage prompt
""")
