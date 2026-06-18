import type { NextRequest } from "next/server";
import { errorJson, guardMutation, json, readJson } from "@/server/security/route-helpers";
import { clientIp, userAgent } from "@/server/security/request-info";
import { LoginInput, type LoginInputT } from "@/shared/schemas/auth";
import { login } from "@/application/auth";
import { attachChallengeCookie, attachSessionCookie } from "@/server/auth/current-session";

export async function POST(req: NextRequest) {
  const guarded = await guardMutation(req);
  if (guarded) return guarded;

  const parsed = await readJson<unknown>(req);
  if ("res" in parsed) return parsed.res;

  const input = LoginInput.safeParse(parsed.body);
  if (!input.success) return errorJson(400, "Invalid input");
  const data = input.data as LoginInputT;

  const r = await login({ email: data.email, password: data.password, ip: clientIp(req), userAgent: userAgent(req) });
  if (!r.ok) {
    if (r.reason === "RATE_LIMITED") {
      return json({ error: "Too many attempts" }, { status: 429, headers: { "Retry-After": String(Math.ceil(r.retryAfterMs / 1000)) } });
    }
    return errorJson(401, "Invalid email or password");
  }
  if (r.mfaRequired) {
    const res = json({ ok: true, mfa_required: true });
    attachChallengeCookie(res, r.challengeCookieValue);
    return res;
  }
  const res = json({ ok: true, mfa_required: false, me: r.me });
  attachSessionCookie(res, r.session);
  return res;
}
