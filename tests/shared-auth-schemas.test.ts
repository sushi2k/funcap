import { describe, expect, it } from "vitest";
import { LoginInput, MfaCode, RegisterInput, ChangePasswordInput } from "@/shared/schemas/auth";

describe("shared auth schemas", () => {
  it("RegisterInput accepts a valid payload", () => {
    const r = RegisterInput.safeParse({
      email: "alice@example.com",
      display_name: "Alice_99",
      password: "correct-horse-battery-staple-12",
    });
    expect(r.success).toBe(true);
  });

  it("RegisterInput rejects short password and bad display_name", () => {
    expect(RegisterInput.safeParse({
      email: "alice@example.com",
      display_name: "<script>",
      password: "short",
    }).success).toBe(false);
  });

  it("LoginInput requires email and password", () => {
    expect(LoginInput.safeParse({ email: "x", password: "" }).success).toBe(false);
    expect(LoginInput.safeParse({ email: "alice@example.com", password: "any" }).success).toBe(true);
  });

  it("MfaCode is exactly 6 digits", () => {
    expect(MfaCode.safeParse("123456").success).toBe(true);
    expect(MfaCode.safeParse("12345").success).toBe(false);
    expect(MfaCode.safeParse("12345a").success).toBe(false);
  });

  it("ChangePasswordInput enforces new-password min length", () => {
    expect(ChangePasswordInput.safeParse({
      current_password: "x",
      new_password: "short",
    }).success).toBe(false);
    expect(ChangePasswordInput.safeParse({
      current_password: "x",
      new_password: "correct-horse-battery-staple-12",
    }).success).toBe(true);
  });
});
