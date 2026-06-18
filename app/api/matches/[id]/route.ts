import type { NextRequest } from "next/server";
import { errorJson, guardMutation, json, readJson } from "@/server/security/route-helpers";
import { getCurrentSession } from "@/server/auth/current-session";
import { EditMatchInput } from "@/shared/schemas/match";
import { editPendingScore, withdrawScore } from "@/application/match";
import { z } from "zod";

const IdParam = z.string().uuid();

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guarded = await guardMutation(req);
  if (guarded) return guarded;

  const session = await getCurrentSession(req);
  if (!session) return errorJson(401, "Not authenticated");

  const { id: rawId } = await ctx.params;
  const idParse = IdParam.safeParse(rawId);
  if (!idParse.success) return errorJson(400, "Invalid match id");

  const parsed = await readJson<unknown>(req);
  if ("res" in parsed) return parsed.res;
  const input = EditMatchInput.safeParse(parsed.body);
  if (!input.success) return errorJson(400, "Invalid input");

  const r = await editPendingScore({
    matchId: idParse.data,
    callerUserId: session.userId,
    outcome: input.data.outcome,
    sets: input.data.sets,
    retiredById: input.data.retired_by_id,
    walkoverWinnerId: input.data.walkover_winner_id,
  });
  if (!r.ok) return mapTransitionError(r);
  return json({ match: r.match });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guarded = await guardMutation(req);
  if (guarded) return guarded;

  const session = await getCurrentSession(req);
  if (!session) return errorJson(401, "Not authenticated");

  const { id: rawId } = await ctx.params;
  const idParse = IdParam.safeParse(rawId);
  if (!idParse.success) return errorJson(400, "Invalid match id");

  const r = await withdrawScore(idParse.data, session.userId);
  if (!r.ok) return mapTransitionError(r);
  return json({ match: r.match });
}

function mapTransitionError(r: { ok: false; reason: string; message?: string }) {
  switch (r.reason) {
    case "NOT_FOUND":
      return errorJson(404, "Match not found");
    case "FORBIDDEN":
      return errorJson(403, "Forbidden");
    case "ALREADY_LOCKED":
    case "WRONG_STATE":
      return errorJson(409, "Match is not in a state that permits this action");
    case "PAIRING_CONFLICT":
      return errorJson(409, "Pairing already has a non-voided official match");
    case "INVALID_SCORE":
      return errorJson(400, r.message ?? "Invalid score");
    default:
      return errorJson(400, "Bad request");
  }
}
