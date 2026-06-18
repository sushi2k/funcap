import "server-only";
import { checkPasswordPolicy } from "@/server/auth/password";
import {
  createUser,
  existsByDisplayName,
  existsByEmail,
  verifyCredentialsByEmail,
  beginMfaEnrolment as dalBeginMfaEnrolment,
  activateMfaIfCodeValid,
  verifyMfaCodeForUser,
  getMe,
} from "@/server/dal/users";
import { createSession, deleteSession, markMfaVerified, type SessionRecord } from "@/server/dal/sessions";
import {
  buildChallengeCookieValue,
  parseChallengeCookieValue,
} from "@/server/auth/mfa-challenge";
import { takeToken } from "@/server/security/rate-limit";
import { policy } from "@/server/config";
import type { MeDTO } from "@/shared/dto/me";

// ---------- Register ----------
export type RegisterResult =
  | { ok: true }
  | { ok: false; reason: "RATE_LIMITED"; retryAfterMs: number }
  | { ok: false; reason: "POLICY"; message: string }
  | { ok: false; reason: "NAME_TAKEN" };

// Email-already-taken is intentionally NOT distinguishable from success
// (AUTH-5 anti-enumeration). display_name conflict is OK to surface — it's
// public on the scoreboard.
export async function registerPlayer(args: {
  email: string;
  display_name: string;
  password: string;
  ip: string | null;
}): Promise<RegisterResult> {
  const ipKey = args.ip ?? "unknown";
  const rl = takeToken(`register:ip:${ipKey}`, policy.rateLimit.registerPerIpPerHour, 60 * 60_000);
  if (!rl.ok) return { ok: false, reason: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs };

  const pc = checkPasswordPolicy(args.password);
  if (!pc.ok) return { ok: false, reason: "POLICY", message: pc.reason };

  if (await existsByDisplayName(args.display_name)) {
    return { ok: false, reason: "NAME_TAKEN" };
  }
  if (await existsByEmail(args.email)) {
    // Silent no-op for anti-enumeration.
    return { ok: true };
  }
  await createUser({
    email: args.email,
    display_name: args.display_name,
    password: args.password,
    role: "PLAYER",
  });
  return { ok: true };
}

// ---------- Login ----------
export type LoginResult =
  | { ok: false; reason: "RATE_LIMITED"; retryAfterMs: number }
  | { ok: false; reason: "INVALID" }
  | { ok: true; mfaRequired: true; challengeCookieValue: string }
  | { ok: true; mfaRequired: false; session: SessionRecord; me: MeDTO };

export async function login(args: {
  email: string;
  password: string;
  ip: string | null;
  userAgent: string | null;
  now?: number;
}): Promise<LoginResult> {
  const now = args.now ?? Date.now();
  const accountKey = `login:account:${args.email.toLowerCase()}`;
  const rl = takeToken(accountKey, policy.rateLimit.loginPerAccountPerMin, 60_000, now);
  if (!rl.ok) return { ok: false, reason: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs };

  const check = await verifyCredentialsByEmail(args.email, args.password, now);
  if (!check.ok) {
    return { ok: false, reason: "INVALID" };
  }
  if (check.mfaEnabled) {
    return {
      ok: true,
      mfaRequired: true,
      challengeCookieValue: buildChallengeCookieValue(check.userId, now),
    };
  }
  const session = await createSession(check.userId, check.role, now, {
    ...(args.userAgent !== null ? { userAgent: args.userAgent } : {}),
    ...(args.ip !== null ? { ip: args.ip } : {}),
  });
  const me = await getMe(check.userId);
  if (!me) return { ok: false, reason: "INVALID" };
  return { ok: true, mfaRequired: false, session, me };
}

// ---------- Mid-login MFA verify ----------
export type MfaVerifyResult =
  | { ok: false; reason: "RATE_LIMITED"; retryAfterMs: number }
  | { ok: false; reason: "INVALID" }
  | { ok: true; session: SessionRecord; me: MeDTO };

export async function verifyMfaChallenge(args: {
  challengeCookieValue: string | undefined;
  code: string;
  ip: string | null;
  userAgent: string | null;
  now?: number;
}): Promise<MfaVerifyResult> {
  const now = args.now ?? Date.now();
  const payload = parseChallengeCookieValue(args.challengeCookieValue, now);
  if (!payload) return { ok: false, reason: "INVALID" };

  const rl = takeToken(`mfa:user:${payload.userId}`, policy.rateLimit.loginPerAccountPerMin, 60_000, now);
  if (!rl.ok) return { ok: false, reason: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs };

  const ok = await verifyMfaCodeForUser(payload.userId, args.code);
  if (!ok) return { ok: false, reason: "INVALID" };

  const me = await getMe(payload.userId);
  if (!me) return { ok: false, reason: "INVALID" };
  const session = await createSession(payload.userId, me.role, now, {
    ...(args.userAgent !== null ? { userAgent: args.userAgent } : {}),
    ...(args.ip !== null ? { ip: args.ip } : {}),
  });
  await markMfaVerified(session.id, now);
  return { ok: true, session: { ...session, mfaVerifiedAtMs: now }, me };
}

// ---------- Logout ----------
export async function logout(sessionId: string | null): Promise<void> {
  if (sessionId) await deleteSession(sessionId);
}

// ---------- MFA enrolment (authenticated) ----------
export async function beginMfaEnrolment(userId: string, email: string): Promise<{ secret: string; uri: string }> {
  return dalBeginMfaEnrolment(userId, email);
}

export async function activateMfa(userId: string, code: string): Promise<boolean> {
  return activateMfaIfCodeValid(userId, code);
}
