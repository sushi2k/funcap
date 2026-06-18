import type { NextRequest } from "next/server";
import { errorJson, guardMutation, json, readJson } from "@/server/security/route-helpers";
import { clientIp } from "@/server/security/request-info";
import { RegisterInput, type RegisterInputT } from "@/shared/schemas/auth";
import { registerPlayer } from "@/application/auth";

export async function POST(req: NextRequest) {
  const guarded = await guardMutation(req);
  if (guarded) return guarded;

  const parsed = await readJson<unknown>(req);
  if ("res" in parsed) return parsed.res;

  const input = RegisterInput.safeParse(parsed.body);
  if (!input.success) return errorJson(400, "Invalid input");

  const r = await registerPlayer({
    ...(input.data as RegisterInputT),
    ip: clientIp(req),
  });
  if (r.ok) return json({ ok: true });
  switch (r.reason) {
    case "RATE_LIMITED":
      return json({ error: "Too many registrations" }, { status: 429, headers: { "Retry-After": String(Math.ceil(r.retryAfterMs / 1000)) } });
    case "POLICY":
      return errorJson(400, r.message);
    case "NAME_TAKEN":
      return errorJson(409, "Display name already taken");
  }
}
