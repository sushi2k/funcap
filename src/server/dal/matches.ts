import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  classifyActor,
  canApprove,
  canReject,
  canWithdraw,
  canEdit,
  normalisePair,
  type MatchSnapshot,
  type MatchState,
  type MatchType,
  type TransitionRejection,
} from "@/domain/match/transitions";
import type { MatchOutcome, SetScore } from "@/domain/scoring";
import type { MatchDTO } from "@/shared/dto/match";

// ---------- Row → DTO ----------

const selectRow = {
  id: true,
  tournament_id: true,
  type: true,
  state: true,
  player_a_id: true,
  player_b_id: true,
  entered_by_id: true,
  winner_id: true,
  outcome: true,
  sets: true,
  played_at: true,
  entered_at: true,
  resolved_at: true,
} as const;

type Row = {
  id: string;
  tournament_id: string;
  type: string;
  state: string;
  player_a_id: string;
  player_b_id: string;
  entered_by_id: string;
  winner_id: string | null;
  outcome: string | null;
  sets: string | null;
  played_at: string;
  entered_at: string;
  resolved_at: string | null;
};

function parseSets(raw: string | null): SetScore[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed as SetScore[];
}

function toDto(row: Row): MatchDTO {
  return {
    id: row.id,
    tournament_id: row.tournament_id,
    type: row.type as MatchType,
    state: row.state as MatchState,
    player_a_id: row.player_a_id,
    player_b_id: row.player_b_id,
    entered_by_id: row.entered_by_id,
    winner_id: row.winner_id,
    outcome: (row.outcome as MatchOutcome | null) ?? null,
    sets: parseSets(row.sets),
    played_at: row.played_at,
    entered_at: row.entered_at,
    resolved_at: row.resolved_at,
  };
}

// ---------- Public reads ----------

export async function getMatchById(id: string): Promise<MatchDTO | null> {
  const row = await prisma.match.findUnique({ where: { id }, select: selectRow });
  return row ? toDto(row) : null;
}

// "My matches" — every match in which the caller is a participant. Ordered
// recent-first. Authorization (only the caller) is the *purpose* of the
// query: the WHERE clause is keyed to the session identity.
export async function listMatchesForUser(callerUserId: string): Promise<MatchDTO[]> {
  const rows = await prisma.match.findMany({
    where: { OR: [{ player_a_id: callerUserId }, { player_b_id: callerUserId }] },
    select: selectRow,
    orderBy: { entered_at: "desc" },
  });
  return rows.map(toDto);
}

// Identifies opponents the caller has played an OFFICIAL non-VOIDED match
// against in the given tournament (req §4 — exclusion set for OFFICIAL
// suggestions). Returns user-ids only; no PII.
export async function listOfficialOpponentsInTournament(
  callerUserId: string,
  tournamentId: string,
): Promise<string[]> {
  const rows = await prisma.match.findMany({
    where: {
      tournament_id: tournamentId,
      type: "OFFICIAL",
      state: { not: "VOIDED" },
      OR: [{ player_a_id: callerUserId }, { player_b_id: callerUserId }],
    },
    select: { player_a_id: true, player_b_id: true },
  });
  const others = new Set<string>();
  for (const r of rows) {
    if (r.player_a_id !== callerUserId) others.add(r.player_a_id);
    if (r.player_b_id !== callerUserId) others.add(r.player_b_id);
  }
  return Array.from(others);
}

// Career stats for matchmaking ranking — derived per req §9.
// Only CONFIRMED OFFICIAL matches count.
export type CareerStats = { wins: number; played: number };

export async function getCareerStats(userId: string): Promise<CareerStats> {
  const [played, wins] = await Promise.all([
    prisma.match.count({
      where: {
        type: "OFFICIAL",
        state: "CONFIRMED",
        OR: [{ player_a_id: userId }, { player_b_id: userId }],
      },
    }),
    prisma.match.count({
      where: { type: "OFFICIAL", state: "CONFIRMED", winner_id: userId },
    }),
  ]);
  return { wins, played };
}

export async function getCareerStatsMany(
  userIds: ReadonlyArray<string>,
): Promise<Map<string, CareerStats>> {
  if (userIds.length === 0) return new Map();
  const out = new Map<string, CareerStats>();
  await Promise.all(
    userIds.map(async (id) => {
      out.set(id, await getCareerStats(id));
    }),
  );
  return out;
}

// ---------- Create (POST /matches) ----------
//
// IDOR (DAL-2): `enteredByUserId` is the session identity; client-supplied
// opponent_id is verified to belong to an ACTIVE user. The pair is normalised
// here so the partial unique index (§6.2) catches duplicates atomically.

export type CreateMatchInput = {
  tournamentId: string;
  type: MatchType;
  enteredByUserId: string;
  opponentId: string;
  outcome: MatchOutcome;
  sets: SetScore[];
  winnerId: string;            // server-derived from scoring.validateMatchResult
  retiredById: string | null;
  playedAt: string;
  enteredAt: string;
};

export type CreateMatchResult =
  | { ok: true; match: MatchDTO }
  | { ok: false; reason: "OPPONENT_NOT_FOUND" | "PAIRING_CONFLICT" | "SELF_OPPONENT" };

export async function createMatch(input: CreateMatchInput): Promise<CreateMatchResult> {
  if (input.enteredByUserId === input.opponentId) {
    return { ok: false, reason: "SELF_OPPONENT" };
  }
  // Verify the opponent is ACTIVE.
  const opponent = await prisma.user.findUnique({
    where: { id: input.opponentId },
    select: { id: true, status: true },
  });
  if (!opponent || opponent.status !== "ACTIVE") {
    return { ok: false, reason: "OPPONENT_NOT_FOUND" };
  }

  const { low, high } = normalisePair(input.enteredByUserId, input.opponentId);

  try {
    const row = await prisma.match.create({
      data: {
        id: randomUUID(),
        tournament_id: input.tournamentId,
        type: input.type,
        player_a_id: input.enteredByUserId,
        player_b_id: input.opponentId,
        pair_low_id: low,
        pair_high_id: high,
        winner_id: input.winnerId,
        outcome: input.outcome,
        sets: JSON.stringify(input.sets),
        state: "PENDING",
        played_at: input.playedAt,
        entered_by_id: input.enteredByUserId,
        entered_at: input.enteredAt,
      },
      select: selectRow,
    });
    return { ok: true, match: toDto(row) };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, reason: "PAIRING_CONFLICT" };
    }
    throw err;
  }
}

// ---------- Edit / withdraw / approve / reject ----------
//
// All four re-check the §6.4 transition in-DAL against the session identity
// (DAL-2). The match is read by id, classified, and the domain decides.

export type AuthzFailure = { ok: false; reason: TransitionRejection | "NOT_FOUND" };

async function loadSnapshot(matchId: string): Promise<(MatchSnapshot & { type: MatchType }) | null> {
  const row = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      state: true,
      type: true,
      entered_by_id: true,
      player_a_id: true,
      player_b_id: true,
    },
  });
  if (!row) return null;
  return {
    state: row.state as MatchState,
    type: row.type as MatchType,
    entered_by_id: row.entered_by_id,
    player_a_id: row.player_a_id,
    player_b_id: row.player_b_id,
  };
}

export type EditMatchInput = {
  matchId: string;
  callerUserId: string;
  outcome: MatchOutcome;
  sets: SetScore[];
  winnerId: string;
};

export type EditMatchResult = { ok: true; match: MatchDTO } | AuthzFailure;

export async function editPendingMatch(input: EditMatchInput): Promise<EditMatchResult> {
  const snap = await loadSnapshot(input.matchId);
  if (!snap) return { ok: false, reason: "NOT_FOUND" };
  const actor = classifyActor(snap, input.callerUserId, /* isAdmin */ false);
  const decision = canEdit(snap, actor);
  if (!decision.ok) return { ok: false, reason: decision.reason };
  const row = await prisma.match.update({
    where: { id: input.matchId },
    data: {
      outcome: input.outcome,
      sets: JSON.stringify(input.sets),
      winner_id: input.winnerId,
    },
    select: selectRow,
  });
  return { ok: true, match: toDto(row) };
}

export type StateChangeInput = {
  matchId: string;
  callerUserId: string;
  nowIso: string;
};

export type StateChangeResult = { ok: true; match: MatchDTO } | AuthzFailure | { ok: false; reason: "PAIRING_CONFLICT" };

export async function withdrawPendingMatch(input: StateChangeInput): Promise<StateChangeResult> {
  const snap = await loadSnapshot(input.matchId);
  if (!snap) return { ok: false, reason: "NOT_FOUND" };
  const actor = classifyActor(snap, input.callerUserId, false);
  const decision = canWithdraw(snap, actor);
  if (!decision.ok) return { ok: false, reason: decision.reason };
  const row = await prisma.match.update({
    where: { id: input.matchId },
    data: { state: "VOIDED", resolved_at: input.nowIso, resolved_by_id: input.callerUserId },
    select: selectRow,
  });
  return { ok: true, match: toDto(row) };
}

export async function approvePendingMatch(input: StateChangeInput): Promise<StateChangeResult> {
  const snap = await loadSnapshot(input.matchId);
  if (!snap) return { ok: false, reason: "NOT_FOUND" };
  const actor = classifyActor(snap, input.callerUserId, false);
  const decision = canApprove(snap, actor);
  if (!decision.ok) return { ok: false, reason: decision.reason };

  // Confirm is atomic — the partial unique index is the canonical check
  // against a concurrent confirmed pairing (arch §8.4). A concurrent insert
  // for the same pairing already collided at creation time; this guard
  // remains for the rare reorder where two PENDING rows raced past the
  // initial check before the unique index existed (e.g. legacy data).
  try {
    const row = await prisma.match.update({
      where: { id: input.matchId },
      data: { state: "CONFIRMED", resolved_at: input.nowIso, resolved_by_id: input.callerUserId },
      select: selectRow,
    });
    return { ok: true, match: toDto(row) };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, reason: "PAIRING_CONFLICT" };
    }
    throw err;
  }
}

export type RejectInput = StateChangeInput & { reason: string };

export async function rejectPendingMatch(input: RejectInput): Promise<StateChangeResult> {
  const snap = await loadSnapshot(input.matchId);
  if (!snap) return { ok: false, reason: "NOT_FOUND" };
  const actor = classifyActor(snap, input.callerUserId, false);
  const decision = canReject(snap, actor);
  if (!decision.ok) return { ok: false, reason: decision.reason };
  const row = await prisma.match.update({
    where: { id: input.matchId },
    data: {
      state: "DISPUTED",
      dispute_reason: input.reason,
      resolved_at: input.nowIso,
      resolved_by_id: input.callerUserId,
    },
    select: selectRow,
  });
  return { ok: true, match: toDto(row) };
}
