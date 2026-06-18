import type { NextRequest } from "next/server";
import { errorJson, guardMutation, json, readJson } from "@/server/security/route-helpers";
import { clientIp, userAgent } from "@/server/security/request-info";
import { MfaVerifyInput, type MfaVerifyInputT } from "@/shared/schemas/auth";
import { verifyMfaChallenge } from "@/application/auth";
import { attachSessionCookie, clearAuthCookies } from "@/server/auth/current-session";
import { policy } from "@/server/config";

export async function POST(req: NextRequest) {
  const guarded = await guardMutation(req);
  if (guarded) return guarded;

  const parsed = await readJson<unknown>(req);
  if ("res" in parsed) return parsed.res;
  const input = MfaVerifyInput.safeParse(parsed.body);
  if (!input.success) return errorJson(400, "Invalid input");
  const data = input.data as MfaVerifyInputT;

  const r = await verifyMfaChallenge({
    challengeCookieValue: req.cookies.get(policy.cookie.mfaChallengeName)?.value,
    code: data.code,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });
  if (!r.ok) {
    if (r.reason === "RATE_LIMITED") {
      return json({ error: "Too many attempts" }, { status: 429, headers: { "Retry-After": String(Math.ceil(r.retryAfterMs / 1000)) } });
    }
    return errorJson(401, "Invalid code");
  }
  const res = json({ ok: true, me: r.me });
  // Clear the challenge cookie and attach the real session cookie.
  clearAuthCookies(res);
  attachSessionCookie(res, r.session);
  return res;
}
