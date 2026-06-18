import "server-only";
import { generateSecret, generateSync, generateURI, verifySync } from "otplib";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "@/server/config";

// RFC 6238 TOTP (security.md SEC-4, req §16). otplib v13 functional API.
const STRATEGY = "totp" as const;
const ISSUER = "Funcap";

function key32(): Buffer {
  return createHash("sha256").update(config.TOTP_ENCRYPTION_KEY).digest();
}

export function generateTotpSecret(): string {
  return generateSecret();
}

export function buildOtpAuthUri(secret: string, accountLabel: string): string {
  return generateURI({ strategy: STRATEGY, secret, issuer: ISSUER, label: accountLabel });
}

// Generates the current TOTP code for a secret. Used by tests and by any
// internal flow that needs to verify a freshly-generated code.
export function generateCurrentTotpCode(secret: string): string {
  return generateSync({ strategy: STRATEGY, secret });
}

export function verifyTotpCode(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  try {
    const r = verifySync({ strategy: STRATEGY, secret, token: code, epochTolerance: 1 });
    return r.valid;
  } catch {
    return false;
  }
}

// AES-256-GCM with random IV; output: base64url(iv || tag || ciphertext) (SEC-3).
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key32(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptSecret(encoded: string): string {
  const buf = Buffer.from(encoded, "base64url");
  if (buf.length < 12 + 16 + 1) throw new Error("Ciphertext too short");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key32(), iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(enc), decipher.final()]);
  return out.toString("utf8");
}
