import type { NextRequest } from "next/server";
import { guardMutation, json } from "@/server/security/route-helpers";
import { clearAuthCookies, getCurrentSession } from "@/server/auth/current-session";
import { logout } from "@/application/auth";

export async function POST(req: NextRequest) {
  const guarded = await guardMutation(req);
  if (guarded) return guarded;

  const session = await getCurrentSession(req);
  await logout(session?.id ?? null);

  const res = json({ ok: true });
  clearAuthCookies(res);
  return res;
}
