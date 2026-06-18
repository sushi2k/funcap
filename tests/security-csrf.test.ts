import { describe, expect, it } from "vitest";
import { csrfMatches, newCsrfToken } from "@/server/security/csrf";

describe("csrf", () => {
  it("generates non-empty tokens", () => {
    const t = newCsrfToken();
    expect(typeof t).toBe("string");
    expect(t.length).toBeGreaterThan(16);
  });

  it("matches equal tokens", () => {
    const t = newCsrfToken();
    expect(csrfMatches(t, t)).toBe(true);
  });

  it("rejects mismatched, missing, or empty tokens", () => {
    const a = newCsrfToken();
    const b = newCsrfToken();
    expect(csrfMatches(a, b)).toBe(false);
    expect(csrfMatches(a, undefined)).toBe(false);
    expect(csrfMatches(undefined, a)).toBe(false);
    expect(csrfMatches("", "")).toBe(false);
  });
});
