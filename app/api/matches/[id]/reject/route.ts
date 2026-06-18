import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorJson, guardMutation, json, readJson } from "@/server/security/route-helpers";
import { getCurrentSession } from "@/server/auth/current-session";
import { RejectMatchInput } from "@/shared/schemas/match";
import { rejectScore } from "@/application/match";

const IdParam = z.string().uuid();

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guarded = await guardMutation(req);
  if (guarded) return guarded;

  const session = await getCurrentSession(req);
  if (!session) return errorJson(401, "Not authenticated");

  const { id: rawId } = await ctx.params;
  const idParse = IdParam.safeParse(rawId);
  if (!idParse.success) return errorJson(400, "Invalid match id");

  const parsed = await readJson<unknown>(req);
  if ("res" in parsed) return parsed.res;
  const input = RejectMatchInput.safeParse(parsed.body);
  if (!input.success) return errorJson(400, "Invalid input");

  const r = await rejectScore(idParse.data, session.userId, input.data.reason);
  if (!r.ok) {
    switch (r.reason) {
      case "NOT_FOUND":
        return errorJson(404, "Match not found");
      case "FORBIDDEN":
        return errorJson(403, "Only the counterparty may reject this match");
      case "ALREADY_LOCKED":
      case "WRONG_STATE":
        return errorJson(409, "Match is not in a state that permits rejection");
      case "PAIRING_CONFLICT":
        return errorJson(409, "Pairing already has a non-voided official match");
    }
  }
  return json({ match: r.match });
}
