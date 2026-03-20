import { describe, expect, it } from "bun:test";
import { checkUrl } from "./validate";

describe("checkUrl", () => {
  it("returns true for a reachable URL", async () => {
    // Use a well-known URL that should always respond
    const result = await checkUrl("https://www.google.com", 5000);
    expect(result).toBe(true);
  });

  it("returns false for a non-existent domain", async () => {
    const result = await checkUrl("https://this-domain-definitely-does-not-exist-12345.com", 3000);
    expect(result).toBe(false);
  });

  it("returns false for an invalid URL", async () => {
    const result = await checkUrl("not-a-url", 1000);
    expect(result).toBe(false);
  });

  it("returns false when timeout is exceeded", async () => {
    // Use a very short timeout to trigger timeout
    const result = await checkUrl("https://httpbin.org/delay/10", 100);
    expect(result).toBe(false);
  });

  it("rejects HTML pages when expecting image Content-Type", async () => {
    const result = await checkUrl("https://www.google.com", { expectedContentType: "image" });
    expect(result).toBe(false);
  });

  it("accepts URLs without Content-Type check (backward compat)", async () => {
    const result = await checkUrl("https://www.google.com", 5000);
    expect(result).toBe(true);
  });

  it("accepts URLs with options object and no Content-Type check", async () => {
    const result = await checkUrl("https://www.google.com", { timeout: 5000 });
    expect(result).toBe(true);
  });
});
