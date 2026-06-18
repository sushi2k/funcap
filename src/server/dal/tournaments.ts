import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import {
  type MatchFormat,
  type TournamentFields,
  type TournamentWindow,
  tournamentState,
  dueForFinalize,
} from "@/domain/tournament/state";
import type { TournamentDTO } from "@/shared/dto/tournament";

type Row = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  closing_ends_at: string;
  match_format: string;
  finalized_at: string | null;
};

function toDto(row: Row, now: number = Date.now()): TournamentDTO {
  const fields: TournamentFields = {
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    closing_ends_at: row.closing_ends_at,
    finalized_at: row.finalized_at,
  };
  return {
    id: row.id,
    name: row.name,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    closing_ends_at: row.closing_ends_at,
    match_format: row.match_format as MatchFormat,
    finalized_at: row.finalized_at,
    state: tournamentState(fields, now),
  };
}

const selectRow = {
  id: true,
  name: true,
  starts_at: true,
  ends_at: true,
  closing_ends_at: true,
  match_format: true,
  finalized_at: true,
} as const;

// ---------- Reads ----------
export async function listTournaments(now: number = Date.now()): Promise<TournamentDTO[]> {
  const rows = await prisma.tournament.findMany({
    select: selectRow,
    orderBy: { starts_at: "desc" },
  });
  return rows.map((r) => toDto(r, now));
}

export async function getTournamentById(
  id: string,
  now: number = Date.now(),
): Promise<TournamentDTO | null> {
  const row = await prisma.tournament.findUnique({ where: { id }, select: selectRow });
  return row ? toDto(row, now) : null;
}

// Window list for the overlap check (consumed by the admin create path,
// which lands in issue #6).
export async function listAllWindows(): Promise<TournamentWindow[]> {
  return prisma.tournament.findMany({
    select: { starts_at: true, closing_ends_at: true },
  });
}

// ---------- Create ----------
export type CreateTournamentInput = {
  name: string;
  starts_at: string;
  ends_at: string;
  closing_ends_at: string;
  match_format: MatchFormat;
};

export async function createTournament(input: CreateTournamentInput): Promise<TournamentDTO> {
  const row = await prisma.tournament.create({
    data: { id: randomUUID(), ...input },
    select: selectRow,
  });
  return toDto(row);
}

// ---------- Finalize (idempotent — arch §10) ----------
//
// Transaction:
//   1) auto-void every still-PENDING/DISPUTED match in the tournament,
//   2) set finalized_at.
// The `finalized_at IS NULL` guard prevents double-finalize on restart.

export type FinalizeResult = { finalizedTournamentIds: string[]; voidedMatchCount: number };

export async function finalizeAllDue(now: number = Date.now()): Promise<FinalizeResult> {
  const candidates = await prisma.tournament.findMany({
    where: { finalized_at: null },
    select: selectRow,
  });
  const due = candidates.filter((c) =>
    dueForFinalize({ ...c, finalized_at: c.finalized_at }, now),
  );

  const finalized: string[] = [];
  let voidedTotal = 0;

  for (const t of due) {
    const result = await prisma.$transaction(async (tx) => {
      // Guard inside the transaction so a parallel run can't double-process.
      const fresh = await tx.tournament.findUnique({
        where: { id: t.id },
        select: { finalized_at: true },
      });
      if (!fresh || fresh.finalized_at) return { voided: 0, finalized: false };

      const voided = await tx.match.updateMany({
        where: {
          tournament_id: t.id,
          state: { in: ["PENDING", "DISPUTED"] },
        },
        data: { state: "VOIDED", resolved_at: new Date(now).toISOString() },
      });

      await tx.tournament.update({
        where: { id: t.id },
        data: { finalized_at: new Date(now).toISOString() },
      });

      // TODO(#4/#6): emit AuditEvent rows for the system-triggered voids and
      // a TOURNAMENT_FINALIZED notification per match participant. Deferred
      // until matches/notifications/audit are wired.
      return { voided: voided.count, finalized: true };
    });
    if (result.finalized) {
      finalized.push(t.id);
      voidedTotal += result.voided;
    }
  }

  return { finalizedTournamentIds: finalized, voidedMatchCount: voidedTotal };
}
