import type { NextRequest } from "next/server";
import { errorJson, guardMutation, json, readJson } from "@/server/security/route-helpers";
import { getCurrentSession } from "@/server/auth/current-session";
import { EnterMatchInput } from "@/shared/schemas/match";
import { enterScore } from "@/application/match";

export async function POST(req: NextRequest) {
  const guarded = await guardMutation(req);
  if (guarded) return guarded;

  const session = await getCurrentSession(req);
  if (!session) return errorJson(401, "Not authenticated");

  const parsed = await readJson<unknown>(req);
  if ("res" in parsed) return parsed.res;

  const input = EnterMatchInput.safeParse(parsed.body);
  if (!input.success) return errorJson(400, "Invalid input");

  const r = await enterScore({
    callerUserId: session.userId,
    opponentId: input.data.opponent_id,
    type: input.data.type,
    outcome: input.data.outcome,
    sets: input.data.sets,
    playedAt: input.data.played_at,
    retiredById: input.data.retired_by_id,
    walkoverWinnerId: input.data.walkover_winner_id,
  });
  if (!r.ok) {
    switch (r.reason) {
      case "SELF_OPPONENT":
      case "OPPONENT_NOT_FOUND":
      case "NO_ACTIVE_TOURNAMENT":
        return errorJson(400, "Invalid opponent or played_at");
      case "WINDOW_CLOSED":
        return errorJson(409, "Tournament window does not permit new entries");
      case "PAIRING_CONFLICT":
        return errorJson(409, "An official match already exists for this pairing in this tournament");
      case "INVALID_SCORE":
        return errorJson(400, r.message);
    }
  }
  return json({ match: r.match }, { status: 201 });
}
