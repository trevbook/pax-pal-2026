import { describe, expect, it } from "bun:test";
import { extractSteamAppId } from "./steam";

describe("extractSteamAppId", () => {
  it("extracts app ID from standard store URL", () => {
    expect(extractSteamAppId("https://store.steampowered.com/app/12345")).toBe(12345);
  });

  it("extracts app ID from URL with game name", () => {
    expect(extractSteamAppId("https://store.steampowered.com/app/12345/Some_Game_Name")).toBe(
      12345,
    );
  });

  it("extracts app ID from URL with query params", () => {
    expect(extractSteamAppId("https://store.steampowered.com/app/12345?utm_source=pax")).toBe(
      12345,
    );
  });

  it("extracts app ID from URL with trailing slash", () => {
    expect(extractSteamAppId("https://store.steampowered.com/app/12345/")).toBe(12345);
  });

  it("returns null for non-Steam URLs", () => {
    expect(extractSteamAppId("https://example.com/game")).toBeNull();
  });

  it("returns null for Steam URLs without app path", () => {
    expect(extractSteamAppId("https://store.steampowered.com/publisher/valve")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractSteamAppId("")).toBeNull();
  });

  it("handles http (no s) URLs", () => {
    expect(extractSteamAppId("http://store.steampowered.com/app/99999")).toBe(99999);
  });
});
