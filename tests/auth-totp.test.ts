import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  generateCurrentTotpCode,
  generateTotpSecret,
  verifyTotpCode,
  buildOtpAuthUri,
} from "@/server/auth/totp";

describe("totp", () => {
  it("generates a secret and verifies its current code", () => {
    const secret = generateTotpSecret();
    const code = generateCurrentTotpCode(secret);
    expect(verifyTotpCode(secret, code)).toBe(true);
  });

  it("rejects malformed codes", () => {
    expect(verifyTotpCode("JBSWY3DPEHPK3PXP", "12345")).toBe(false);
    expect(verifyTotpCode("JBSWY3DPEHPK3PXP", "abcdef")).toBe(false);
  });

  it("builds an otpauth URI containing the issuer", () => {
    const uri = buildOtpAuthUri("JBSWY3DPEHPK3PXP", "alice@example.com");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("Funcap");
  });

  it("AES-256-GCM encrypts and decrypts roundtrip", () => {
    const plain = "JBSWY3DPEHPK3PXP";
    const enc = encryptSecret(plain);
    expect(enc).not.toBe(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it("fails to decrypt tampered ciphertext", () => {
    const enc = encryptSecret("secret-value");
    const tampered = enc.slice(0, -2) + (enc.endsWith("A") ? "BB" : "AA");
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
