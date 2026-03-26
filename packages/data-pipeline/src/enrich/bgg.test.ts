import { describe, expect, it } from "bun:test";
import { extractBggId } from "./bgg";

describe("extractBggId", () => {
  it("extracts ID from standard BGG URL", () => {
    expect(extractBggId("https://boardgamegeek.com/boardgame/268201/dice-throne")).toBe(268201);
  });

  it("extracts ID from BGG URL without slug", () => {
    expect(extractBggId("https://boardgamegeek.com/boardgame/268201")).toBe(268201);
  });

  it("extracts ID from www variant", () => {
    expect(extractBggId("https://www.boardgamegeek.com/boardgame/199792/everdell")).toBe(199792);
  });

  it("returns null for non-BGG URL", () => {
    expect(extractBggId("https://store.steampowered.com/app/123")).toBeNull();
  });

  it("returns null for BGG non-boardgame URL", () => {
    expect(extractBggId("https://boardgamegeek.com/thread/12345/some-topic")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractBggId("")).toBeNull();
  });
});
