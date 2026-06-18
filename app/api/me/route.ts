import type { NextRequest } from "next/server";
import { errorJson, guardMutation, json, readJson } from "@/server/security/route-helpers";
import { getCurrentSession } from "@/server/auth/current-session";
import { changePassword, getMe } from "@/application/me";
import { ChangePasswordInput, type ChangePasswordInputT } from "@/shared/schemas/auth";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session) return errorJson(401, "Not authenticated");
  const me = await getMe(session.userId);
  if (!me) return errorJson(401, "Not authenticated");
  return json({ me });
}

export async function PATCH(req: NextRequest) {
  const guarded = await guardMutation(req);
  if (guarded) return guarded;

  const session = await getCurrentSession(req);
  if (!session) return errorJson(401, "Not authenticated");

  const parsed = await readJson<unknown>(req);
  if ("res" in parsed) return parsed.res;

  const input = ChangePasswordInput.safeParse(parsed.body);
  if (!input.success) return errorJson(400, "Invalid input");
  const data = input.data as ChangePasswordInputT;

  const r = await changePassword(session.userId, data.current_password, data.new_password);
  if (r.ok) return json({ ok: true });
  if (r.reason === "POLICY") return errorJson(400, r.message);
  return errorJson(403, "Current password incorrect");
}
