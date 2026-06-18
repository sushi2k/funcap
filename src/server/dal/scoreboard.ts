import "server-only";
import { prisma } from "./prisma";
import type { SetScore } from "@/domain/scoring";
import type { StandingMatch } from "@/domain/standings";
import type { CareerMatch } from "@/domain/career";

// Both queries select the minimum needed for §8 / §9 derivation.
// `email` is *never* read here — even owners read it through a separate /me
// path. DAL-4 demands the scoreboard layer cannot accidentally leak it.

const matchSelect = {
  id: true,
  player_a_id: true,
  player_b_id: true,
  winner_id: true,
  sets: true,
} as const;

function parseSets(raw: string | null): SetScore[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as SetScore[]) : [];
  } catch {
    return [];
  }
}

// ---------- Season (per-tournament) ----------

export async function listConfirmedOfficialInTournament(
  tournamentId: string,
): Promise<StandingMatch[]> {
  const rows = await prisma.match.findMany({
    where: { tournament_id: tournamentId, type: "OFFICIAL", state: "CONFIRMED" },
    select: matchSelect,
  });
  return rows.map((r) => ({
    id: r.id,
    player_a_id: r.player_a_id,
    player_b_id: r.player_b_id,
    winner_id: r.winner_id ?? "",
    sets: parseSets(r.sets),
  }));
}

// ---------- Career (whole series) ----------

export async function listAllConfirmedOfficial(): Promise<CareerMatch[]> {
  const rows = await prisma.match.findMany({
    where: { type: "OFFICIAL", state: "CONFIRMED" },
    select: {
      player_a_id: true,
      player_b_id: true,
      winner_id: true,
    },
  });
  return rows.map((r) => ({
    player_a_id: r.player_a_id,
    player_b_id: r.player_b_id,
    winner_id: r.winner_id ?? "",
  }));
}

// ---------- Display-name map (no email) ----------

export async function getDisplayNamesFor(
  userIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const unique = Array.from(new Set(userIds));
  const rows = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, display_name: true },
  });
  return new Map(rows.map((r) => [r.id, r.display_name]));
}
