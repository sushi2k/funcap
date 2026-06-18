import type { NextRequest } from "next/server";
import { errorJson, guardMutation, json, readJson } from "@/server/security/route-helpers";
import { getCurrentSession } from "@/server/auth/current-session";
import { activateMfa } from "@/application/auth";
import { MfaActivateInput, type MfaActivateInputT } from "@/shared/schemas/auth";

export async function POST(req: NextRequest) {
  const guarded = await guardMutation(req);
  if (guarded) return guarded;

  const session = await getCurrentSession(req);
  if (!session) return errorJson(401, "Not authenticated");

  const parsed = await readJson<unknown>(req);
  if ("res" in parsed) return parsed.res;
  const input = MfaActivateInput.safeParse(parsed.body);
  if (!input.success) return errorJson(400, "Invalid input");

  const ok = await activateMfa(session.userId, (input.data as MfaActivateInputT).code);
  if (!ok) return errorJson(400, "Invalid code");
  return json({ ok: true });
}
