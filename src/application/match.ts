import "server-only";
import { validatePlayedAt } from "@/domain/tournament/state";
import { validateMatchResult, type SetScore, type MatchOutcome } from "@/domain/scoring";
import type { MatchType } from "@/domain/match/transitions";
import {
  createMatch as dalCreate,
  editPendingMatch as dalEdit,
  withdrawPendingMatch as dalWithdraw,
  approvePendingMatch as dalApprove,
  rejectPendingMatch as dalReject,
  getMatchById,
  listMatchesForUser,
  listOfficialOpponentsInTournament,
  getCareerStats,
  getCareerStatsMany,
} from "@/server/dal/matches";
import { getDisplayNamesFor } from "@/server/dal/scoreboard";
import {
  findTournamentContainingPlayedAt,
  getTournamentById,
  listTournaments,
} from "@/server/dal/tournaments";
import { listActiveCandidatesExcept, getSelfLevel } from "@/server/dal/users";
import { rankSuggestions, type Candidate } from "@/domain/matchmaking";
import type { MatchDTO, MyMatchDTO, SuggestionDTO } from "@/shared/dto/match";

// ---------- Enter score (POST /matches) ----------

export type EnterMatchInput = {
  callerUserId: string;
  opponentId: string;
  type: MatchType;
  outcome: MatchOutcome;
  sets: SetScore[];
  playedAt: string;
  retiredById?: string | undefined;
  walkoverWinnerId?: string | undefined;
};

export type EnterMatchResult =
  | { ok: true; match: MatchDTO }
  | { ok: false; reason: "OPPONENT_NOT_FOUND" | "SELF_OPPONENT" | "NO_ACTIVE_TOURNAMENT" | "WINDOW_CLOSED" | "PAIRING_CONFLICT"; }
  | { ok: false; reason: "INVALID_SCORE"; message: string };

export async function enterScore(input: EnterMatchInput, now: number = Date.now()): Promise<EnterMatchResult> {
  if (input.callerUserId === input.opponentId) {
    return { ok: false, reason: "SELF_OPPONENT" };
  }

  // Tournament attachment (req §5.4).
  const tournament = await findTournamentContainingPlayedAt(input.playedAt, now);
  if (!tournament) return { ok: false, reason: "NO_ACTIVE_TOURNAMENT" };

  // played_at must be in ACTIVE; entry permitted in ACTIVE or CLOSING (§6.4).
  const playedErr = validatePlayedAt(tournament, input.playedAt);
  if (playedErr) return { ok: false, reason: "NO_ACTIVE_TOURNAMENT" };
  if (tournament.state !== "ACTIVE" && tournament.state !== "CLOSING") {
    return { ok: false, reason: "WINDOW_CLOSED" };
  }

  // Score validity + derived winner (req §7).
  const score = validateMatchResult({
    format: tournament.match_format,
    outcome: input.outcome,
    sets: input.sets,
    player_a_id: input.callerUserId,
    player_b_id: input.opponentId,
    retired_by_id: input.retiredById ?? null,
    walkover_winner_id: input.walkoverWinnerId ?? null,
  });
  if (!score.ok) return { ok: false, reason: "INVALID_SCORE", message: score.error };

  const r = await dalCreate({
    tournamentId: tournament.id,
    type: input.type,
    enteredByUserId: input.callerUserId,
    opponentId: input.opponentId,
    outcome: input.outcome,
    sets: input.sets,
    winnerId: score.winner_id,
    retiredById: input.retiredById ?? null,
    playedAt: input.playedAt,
    enteredAt: new Date(now).toISOString(),
  });
  if (!r.ok) return { ok: false, reason: r.reason };
  return { ok: true, match: r.match };
}

// ---------- Edit / withdraw / approve / reject ----------

export type EditScoreInput = {
  matchId: string;
  callerUserId: string;
  outcome: MatchOutcome;
  sets: SetScore[];
  retiredById?: string | undefined;
  walkoverWinnerId?: string | undefined;
};

export type EditScoreResult =
  | { ok: true; match: MatchDTO }
  | { ok: false; reason: "NOT_FOUND" | "FORBIDDEN" | "WRONG_STATE" | "ALREADY_LOCKED" }
  | { ok: false; reason: "INVALID_SCORE"; message: string };

export async function editPendingScore(input: EditScoreInput): Promise<EditScoreResult> {
  const existing = await getMatchById(input.matchId);
  if (!existing) return { ok: false, reason: "NOT_FOUND" };
  const tournament = await getTournamentById(existing.tournament_id);
  if (!tournament) return { ok: false, reason: "NOT_FOUND" };

  const score = validateMatchResult({
    format: tournament.match_format,
    outcome: input.outcome,
    sets: input.sets,
    player_a_id: existing.player_a_id,
    player_b_id: existing.player_b_id,
    retired_by_id: input.retiredById ?? null,
    walkover_winner_id: input.walkoverWinnerId ?? null,
  });
  if (!score.ok) return { ok: false, reason: "INVALID_SCORE", message: score.error };

  const r = await dalEdit({
    matchId: input.matchId,
    callerUserId: input.callerUserId,
    outcome: input.outcome,
    sets: input.sets,
    winnerId: score.winner_id,
  });
  if (!r.ok) {
    return { ok: false, reason: r.reason === "NOT_FOUND" ? "NOT_FOUND" : r.reason };
  }
  return { ok: true, match: r.match };
}

export type StateChangeResult =
  | { ok: true; match: MatchDTO }
  | { ok: false; reason: "NOT_FOUND" | "FORBIDDEN" | "WRONG_STATE" | "ALREADY_LOCKED" | "PAIRING_CONFLICT" };

export async function withdrawScore(matchId: string, callerUserId: string, now: number = Date.now()): Promise<StateChangeResult> {
  const r = await dalWithdraw({ matchId, callerUserId, nowIso: new Date(now).toISOString() });
  if (!r.ok) return { ok: false, reason: r.reason };
  return { ok: true, match: r.match };
}

export async function approveScore(matchId: string, callerUserId: string, now: number = Date.now()): Promise<StateChangeResult> {
  const r = await dalApprove({ matchId, callerUserId, nowIso: new Date(now).toISOString() });
  if (!r.ok) return { ok: false, reason: r.reason };
  return { ok: true, match: r.match };
}

export async function rejectScore(
  matchId: string,
  callerUserId: string,
  reason: string,
  now: number = Date.now(),
): Promise<StateChangeResult> {
  const r = await dalReject({ matchId, callerUserId, reason, nowIso: new Date(now).toISOString() });
  if (!r.ok) return { ok: false, reason: r.reason };
  return { ok: true, match: r.match };
}

// ---------- Matchmaking ----------

export type SuggestionsInput = {
  callerUserId: string;
  type: MatchType;
};

export async function listSuggestions(
  input: SuggestionsInput,
  now: number = Date.now(),
): Promise<SuggestionDTO[]> {
  // For OFFICIAL, exclude opponents already played in the *current* tournament
  // (ACTIVE/CLOSING). For FRIENDLY, no such exclusion.
  let excludeIds: string[] = [];
  if (input.type === "OFFICIAL") {
    const all = await listTournaments(now);
    const current = all.find((t) => t.state === "ACTIVE" || t.state === "CLOSING");
    if (current) {
      excludeIds = await listOfficialOpponentsInTournament(input.callerUserId, current.id);
    }
  }

  const candidates = await listActiveCandidatesExcept(input.callerUserId, excludeIds);
  if (candidates.length === 0) return [];

  const ids = candidates.map((c) => c.id);
  const statsMap = await getCareerStatsMany(ids);
  const callerLevel = await getSelfLevel(input.callerUserId);
  const callerStats = await getCareerStats(input.callerUserId);

  const ranked = rankSuggestions(
    {
      id: input.callerUserId,
      self_level: callerLevel,
      career_wins: callerStats.wins,
      career_played: callerStats.played,
    },
    candidates.map<Candidate>((c) => {
      const s = statsMap.get(c.id) ?? { wins: 0, played: 0 };
      return {
        id: c.id,
        display_name: c.display_name,
        self_level: c.self_level,
        career_wins: s.wins,
        career_played: s.played,
      };
    }),
  );

  return ranked.map<SuggestionDTO>((c) => ({
    id: c.id,
    display_name: c.display_name,
    self_level: c.self_level,
  }));
}

// ---------- My matches (GET /api/matches) ----------

export async function listMyMatches(callerUserId: string): Promise<MyMatchDTO[]> {
  const matches = await listMatchesForUser(callerUserId);
  if (matches.length === 0) return [];
  const opponentIds = new Set<string>();
  for (const m of matches) {
    opponentIds.add(m.player_a_id === callerUserId ? m.player_b_id : m.player_a_id);
  }
  const names = await getDisplayNamesFor(Array.from(opponentIds));
  return matches.map<MyMatchDTO>((m) => {
    const opponentId = m.player_a_id === callerUserId ? m.player_b_id : m.player_a_id;
    const enteredByMe = m.entered_by_id === callerUserId;
    return {
      ...m,
      opponent_id: opponentId,
      opponent_display_name: names.get(opponentId) ?? opponentId,
      entered_by_me: enteredByMe,
      // Counterparty approves; only PENDING matches can be approved/rejected.
      needs_my_approval: m.state === "PENDING" && !enteredByMe,
    };
  });
}
