import { describe, expect, it } from "vitest";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "@/server/auth/password";

describe("password", () => {
  it("hashes and verifies a correct password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple-12");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, "correct-horse-battery-staple-12")).toBe(true);
    expect(await verifyPassword(hash, "wrong-password-attempt-XXXX1234")).toBe(false);
  }, 10_000);

  it("rejects short passwords", () => {
    const r = checkPasswordPolicy("short");
    expect(r.ok).toBe(false);
  });

  it("rejects breached passwords", () => {
    const r = checkPasswordPolicy("Password123");
    expect(r.ok).toBe(false);
  });

  it("accepts a strong non-breached password", () => {
    const r = checkPasswordPolicy("correct-horse-battery-staple-12");
    expect(r.ok).toBe(true);
  });
});
