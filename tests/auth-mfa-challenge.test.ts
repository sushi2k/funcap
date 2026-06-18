import { describe, expect, it } from "vitest";
import {
  buildChallengeCookieValue,
  parseChallengeCookieValue,
} from "@/server/auth/mfa-challenge";

describe("mfa challenge cookie", () => {
  it("roundtrips userId within the TTL", () => {
    const now = Date.now();
    const cookie = buildChallengeCookieValue("user-123", now);
    const parsed = parseChallengeCookieValue(cookie, now + 1_000);
    expect(parsed?.userId).toBe("user-123");
  });

  it("rejects an expired cookie", () => {
    const now = Date.now();
    const cookie = buildChallengeCookieValue("user-123", now);
    const tenMinLater = now + 10 * 60_000;
    expect(parseChallengeCookieValue(cookie, tenMinLater)).toBeNull();
  });

  it("rejects a tampered MAC", () => {
    const cookie = buildChallengeCookieValue("user-123");
    const broken = cookie.slice(0, -2) + "XX";
    expect(parseChallengeCookieValue(broken)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(parseChallengeCookieValue("not.a.cookie")).toBeNull();
    expect(parseChallengeCookieValue(undefined)).toBeNull();
  });
});
