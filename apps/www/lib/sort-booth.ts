/**
 * Booth sort comparator for sorting games by booth number.
 *
 * Parsing rules (from UI spec Screen 5):
 * - Pure numeric (e.g., "15043"): sort numerically ascending
 * - NL-prefixed (e.g., "NL2"): sort after numeric booths, numerically by suffix
 * - TT-prefixed (e.g., "TT29A"): sort after NL booths, alphanumerically
 * - Multi-booth (contains ","): sort by the first booth in the list
 * - "Tabletop Hall": sort with TT booths
 * - "UNSPECIFIED" or null: sort last
 */

interface BoothSortKey {
  /** 0 = numeric, 1 = NL, 2 = TT / Tabletop Hall, 3 = null/UNSPECIFIED */
  group: number;
  /** Numeric value for sorting within group, or 0 */
  num: number;
  /** Alpha suffix for TT booths (e.g., "A" in "TT29A") */
  alpha: string;
}

function parseBoothKey(boothId: string | null): BoothSortKey {
  if (!boothId || boothId === "UNSPECIFIED") {
    return { group: 3, num: 0, alpha: "" };
  }

  // Multi-booth: use the first one
  const raw = boothId.includes(",") ? boothId.split(",")[0].trim() : boothId;

  if (raw === "Tabletop Hall") {
    return { group: 2, num: 0, alpha: "" };
  }

  if (raw.startsWith("TT")) {
    const match = raw.match(/^TT(\d+)([A-Z]?)$/);
    return {
      group: 2,
      num: match ? Number(match[1]) : 0,
      alpha: match?.[2] ?? "",
    };
  }

  if (raw.startsWith("NL")) {
    const match = raw.match(/^NL(\d+)$/);
    return { group: 1, num: match ? Number(match[1]) : 0, alpha: "" };
  }

  // Pure numeric
  const n = Number(raw);
  if (!Number.isNaN(n)) {
    return { group: 0, num: n, alpha: "" };
  }

  // Unknown format — sort before null but after known formats
  return { group: 2, num: 0, alpha: raw };
}

/** Compare two boothId values for ascending sort. */
export function compareBoothId(a: string | null, b: string | null): number {
  const ka = parseBoothKey(a);
  const kb = parseBoothKey(b);

  if (ka.group !== kb.group) return ka.group - kb.group;
  if (ka.num !== kb.num) return ka.num - kb.num;
  return ka.alpha.localeCompare(kb.alpha);
}
