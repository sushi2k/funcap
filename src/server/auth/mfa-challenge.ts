import "server-only";
import { createHmac } from "node:crypto";
import { config, policy } from "@/server/config";
import { constantTimeEqualString } from "@/server/security/random";

// Mid-login MFA challenge: short-lived signed cookie carrying { userId,
// expiresAt }. Created after password OK + MFA required; consumed by
// /auth/mfa/verify, which verifies the TOTP code and then issues the real
// session. Avoids creating a real Session row in the half-authenticated state.

type ChallengePayload = { userId: string; expiresAtMs: number };

function sign(payload: string): string {
  return createHmac("sha256", config.SESSION_SECRET).update(payload).digest("base64url");
}

export function buildChallengeCookieValue(userId: string, now: number = Date.now()): string {
  const payload: ChallengePayload = { userId, expiresAtMs: now + policy.mfaChallengeTtlMs };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function parseChallengeCookieValue(
  raw: string | undefined,
  now: number = Date.now(),
): ChallengePayload | null {
  if (!raw) return null;
  const [encoded, mac] = raw.split(".");
  if (!encoded || !mac) return null;
  if (!constantTimeEqualString(mac, sign(encoded))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ChallengePayload;
    if (typeof payload.userId !== "string" || typeof payload.expiresAtMs !== "number") return null;
    if (payload.expiresAtMs < now) return null;
    return payload;
  } catch {
    return null;
  }
}
