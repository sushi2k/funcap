import { describe, expect, it } from "vitest";
import { isStepUpFresh } from "@/server/security/step-up";

describe("step-up freshness", () => {
  it("returns false when no MFA verification recorded", () => {
    expect(isStepUpFresh({ mfa_verified_at: null })).toBe(false);
  });

  it("returns true within the 5-minute window", () => {
    const now = Date.now();
    const recent = new Date(now - 60_000).toISOString();
    expect(isStepUpFresh({ mfa_verified_at: recent }, now)).toBe(true);
  });

  it("returns false past the window", () => {
    const now = Date.now();
    const old = new Date(now - 10 * 60_000).toISOString();
    expect(isStepUpFresh({ mfa_verified_at: old }, now)).toBe(false);
  });

  it("returns false for malformed timestamps", () => {
    expect(isStepUpFresh({ mfa_verified_at: "not-a-date" })).toBe(false);
  });
});
