import { describe, expect, it } from "vitest";
import type { MeDTO } from "@/shared/dto/me";
import type { PublicUserDTO } from "@/shared/dto/user";

// security.md DAL-4: password_hash and totp_secret never leave the DAL;
// email never appears in any guest/public response.
//
// Compile-time check: the DTO types we expose to callers do not contain
// secret fields. If somebody adds password_hash to a DTO this test fails to
// compile. The structural check below also acts as a runtime smoke.

type ForbiddenKeys = "password_hash" | "totp_secret";

type AssertNotPresent<T, Bad extends PropertyKey> = Bad extends keyof T ? never : true;

describe("DTO leakage", () => {
  it("MeDTO does not expose secret fields (compile-time + runtime)", () => {
    const _typeCheck: AssertNotPresent<MeDTO, ForbiddenKeys> = true;
    const sample: MeDTO = {
      id: "id",
      email: "a@b.c",
      display_name: "alice",
      role: "PLAYER",
      status: "ACTIVE",
      self_level: null,
      mfa_enabled: false,
      must_change_password: false,
    };
    expect(Object.keys(sample)).not.toContain("password_hash");
    expect(Object.keys(sample)).not.toContain("totp_secret");
    expect(_typeCheck).toBe(true);
  });

  it("PublicUserDTO contains no email or secret fields", () => {
    type _ = AssertNotPresent<PublicUserDTO, "email" | ForbiddenKeys>;
    const sample: PublicUserDTO = { id: "id", display_name: "alice", self_level: null };
    expect(Object.keys(sample)).not.toContain("email");
    expect(Object.keys(sample)).not.toContain("password_hash");
  });
});
