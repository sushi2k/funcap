import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { policy } from "@/server/config";
import { buildSetCookie, clearCookie } from "@/server/security/cookies";
import { findActiveSession, type SessionRecord } from "@/server/dal/sessions";

export async function getCurrentSession(req: NextRequest, now: number = Date.now()): Promise<SessionRecord | null> {
  const cookie = req.cookies.get(policy.cookie.sessionName)?.value;
  if (!cookie) return null;
  return findActiveSession(cookie, now);
}

export function attachSessionCookie(res: NextResponse, session: SessionRecord): void {
  const maxAgeSeconds = Math.max(0, Math.floor((session.expiresAtMs - Date.now()) / 1000));
  res.headers.append(
    "Set-Cookie",
    buildSetCookie(policy.cookie.sessionName, session.id, { httpOnly: true, maxAgeSeconds }),
  );
}

export function attachChallengeCookie(res: NextResponse, value: string): void {
  res.headers.append(
    "Set-Cookie",
    buildSetCookie(policy.cookie.mfaChallengeName, value, {
      httpOnly: true,
      maxAgeSeconds: Math.floor(policy.mfaChallengeTtlMs / 1000),
    }),
  );
}

export function clearAuthCookies(res: NextResponse): void {
  res.headers.append("Set-Cookie", clearCookie(policy.cookie.sessionName));
  res.headers.append("Set-Cookie", clearCookie(policy.cookie.mfaChallengeName));
}
