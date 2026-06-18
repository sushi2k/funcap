import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorJson, guardMutation, json } from "@/server/security/route-helpers";
import { getCurrentSession } from "@/server/auth/current-session";
import { approveScore } from "@/application/match";

const IdParam = z.string().uuid();

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guarded = await guardMutation(req);
  if (guarded) return guarded;

  const session = await getCurrentSession(req);
  if (!session) return errorJson(401, "Not authenticated");

  const { id: rawId } = await ctx.params;
  const idParse = IdParam.safeParse(rawId);
  if (!idParse.success) return errorJson(400, "Invalid match id");

  const r = await approveScore(idParse.data, session.userId);
  if (!r.ok) {
    switch (r.reason) {
      case "NOT_FOUND":
        return errorJson(404, "Match not found");
      case "FORBIDDEN":
        return errorJson(403, "Only the counterparty may approve this match");
      case "ALREADY_LOCKED":
      case "WRONG_STATE":
        return errorJson(409, "Match is not in a state that permits approval");
      case "PAIRING_CONFLICT":
        return errorJson(409, "Pairing already has a non-voided official match");
    }
  }
  return json({ match: r.match });
}
