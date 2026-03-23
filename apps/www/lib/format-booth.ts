export interface BoothDisplay {
  /** Human-readable label, e.g. "Booth 15043", "Table TT29A", "Booths 18019, 18031" */
  label: string;
  /** Link to the map page, or null if the booth should be hidden */
  href: string | null;
}

/**
 * Format a `boothId` value for consistent display across the app.
 *
 * Returns `null` when the booth info should be hidden entirely
 * (UNSPECIFIED or null input).
 */
export function formatBoothDisplay(boothId: string | null): BoothDisplay | null {
  if (!boothId || boothId === "UNSPECIFIED") {
    return null;
  }

  // Multi-booth: contains a comma
  if (boothId.includes(",")) {
    const booths = boothId
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);
    return {
      label: `Booths ${booths.join(", ")}`,
      href: `/map?booths=${encodeURIComponent(booths.join(","))}`,
    };
  }

  // Tabletop Hall (literal string)
  if (boothId === "Tabletop Hall") {
    return {
      label: "Tabletop Hall",
      href: "/map?tab=tabletop",
    };
  }

  // Tabletop booth: starts with TT
  if (boothId.startsWith("TT")) {
    return {
      label: `Table ${boothId}`,
      href: "/map?tab=tabletop",
    };
  }

  // Standard numeric booth (or NL prefix, etc.)
  return {
    label: `Booth ${boothId}`,
    href: `/map/${encodeURIComponent(boothId)}`,
  };
}
