// ---------------------------------------------------------------------------
// Gamer-themed word list for 4-word recovery phrases.
// ~60 words → ~13M combinations (60^4). Plenty for a PAX event.
// ---------------------------------------------------------------------------

const WORDS = [
  // Genres
  "roguelike",
  "platformer",
  "sandbox",
  "stealth",
  "puzzle",
  "strategy",
  "survival",
  "racing",
  "rhythm",
  "shooter",
  // Game terms
  "combo",
  "crit",
  "loot",
  "boss",
  "quest",
  "respawn",
  "clutch",
  "nerf",
  "buff",
  "shield",
  "portal",
  "spawn",
  "turbo",
  "warp",
  "grind",
  // Fantasy nouns
  "wizard",
  "paladin",
  "dragon",
  "phoenix",
  "golem",
  "knight",
  "ranger",
  "rogue",
  "sorcerer",
  "titan",
  // Items & objects
  "potion",
  "scroll",
  "crystal",
  "ember",
  "relic",
  "blade",
  "forge",
  "vault",
  "beacon",
  "crown",
  // Adjectives
  "epic",
  "arcane",
  "neon",
  "cosmic",
  "pixel",
  "hyper",
  "mega",
  "ultra",
  "primal",
  "cyber",
  // PAX vibes
  "expo",
  "indie",
  "retro",
  "tabletop",
  "arcade",
];

/** Generate a 4-word recovery phrase from the gamer word list. */
export function generateRecoveryPhrase(): string {
  const words: string[] = [];
  for (let i = 0; i < 4; i++) {
    words.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  }
  return words.join("-");
}
