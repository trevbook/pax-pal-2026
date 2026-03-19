import { describe, expect, it } from "bun:test";
import { levenshteinSimilarity } from "./bgg";

describe("levenshteinSimilarity", () => {
  it("returns 1.0 for identical strings", () => {
    expect(levenshteinSimilarity("Catan", "Catan")).toBe(1);
  });

  it("is case-insensitive", () => {
    expect(levenshteinSimilarity("catan", "CATAN")).toBe(1);
  });

  it("trims whitespace", () => {
    expect(levenshteinSimilarity("  Catan  ", "Catan")).toBe(1);
  });

  it("returns high similarity for close names", () => {
    const score = levenshteinSimilarity("Wingspan", "Wingspans");
    expect(score).toBeGreaterThan(0.85);
  });

  it("returns moderate similarity for somewhat related names", () => {
    const score = levenshteinSimilarity("Ticket to Ride", "Ticket to Ride: Europe");
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(0.9);
  });

  it("returns low similarity for unrelated names", () => {
    const score = levenshteinSimilarity("Catan", "Monopoly");
    expect(score).toBeLessThan(0.4);
  });

  it("handles empty strings", () => {
    expect(levenshteinSimilarity("", "")).toBe(1);
    expect(levenshteinSimilarity("abc", "")).toBe(0);
    expect(levenshteinSimilarity("", "abc")).toBe(0);
  });

  it("handles single character differences", () => {
    // "cat" vs "bat" — 1 substitution out of 3 chars = 0.667
    const score = levenshteinSimilarity("cat", "bat");
    expect(score).toBeCloseTo(0.667, 2);
  });
});
