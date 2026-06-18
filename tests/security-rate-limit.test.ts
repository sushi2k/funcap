import { beforeEach, describe, expect, it } from "vitest";
import { _resetRateLimitStore, takeToken } from "@/server/security/rate-limit";

describe("rate-limit (sliding window)", () => {
  beforeEach(() => _resetRateLimitStore());

  it("permits up to the limit, then blocks", () => {
    for (let i = 0; i < 3; i++) {
      expect(takeToken("k", 3, 60_000, 1_000).ok).toBe(true);
    }
    const blocked = takeToken("k", 3, 60_000, 1_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("frees up after the window passes", () => {
    for (let i = 0; i < 3; i++) takeToken("k", 3, 60_000, 1_000);
    const afterWindow = takeToken("k", 3, 60_000, 1_000 + 60_001);
    expect(afterWindow.ok).toBe(true);
  });

  it("keys are isolated", () => {
    for (let i = 0; i < 3; i++) takeToken("a", 3, 60_000, 1_000);
    expect(takeToken("b", 3, 60_000, 1_000).ok).toBe(true);
  });
});
