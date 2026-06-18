// Pure season-standings derivation (req §8). Inputs: the set of CONFIRMED
// OFFICIAL matches in a tournament and a display_name map. Outputs: ordered
// per-player aggregates. No I/O, no React, no Prisma.
//
// Per req §8 / arch §8.5: standings are *derived* from match data; we do not
// store aggregates or materialise tables. Callers fetch matches via the DAL
// and pipe them through this module on every read.

import type { SetScore } from "@/domain/scoring";

export type StandingMatch = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  winner_id: string;
  sets: SetScore[];
  // `outcome` is unused for counting (req §6.5 — all three count identically)
  // but kept so callers can pass the DTO through unmodified.
};

export type StandingRow = {
  user_id: string;
  display_name: string;
  played: number;
  wins: number;
  losses: number;
  sets_for: number;
  sets_against: number;
  games_for: number;
  games_against: number;
};

function emptyRow(user_id: string, display_name: string): StandingRow {
  return {
    user_id,
    display_name,
    played: 0,
    wins: 0,
    losses: 0,
    sets_for: 0,
    sets_against: 0,
    games_for: 0,
    games_against: 0,
  };
}

function tallySet(s: SetScore, isA: boolean): { setFor: number; setAgainst: number; gamesFor: number; gamesAgainst: number } {
  const my = isA ? s.a : s.b;
  const their = isA ? s.b : s.a;
  return {
    setFor: my > their ? 1 : 0,
    setAgainst: their > my ? 1 : 0,
    gamesFor: my,
    gamesAgainst: their,
  };
}

// Build raw per-user totals. Display names come from the caller's user map;
// users present in the map but with no matches are omitted (req §10
// expectation: scoreboard lists ranked players, not the entire user table).
export function aggregateStandings(
  matches: ReadonlyArray<StandingMatch>,
  displayNames: ReadonlyMap<string, string>,
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  function rowFor(userId: string): StandingRow {
    let r = rows.get(userId);
    if (!r) {
      r = emptyRow(userId, displayNames.get(userId) ?? userId);
      rows.set(userId, r);
    }
    return r;
  }

  for (const m of matches) {
    const a = rowFor(m.player_a_id);
    const b = rowFor(m.player_b_id);
    a.played++;
    b.played++;
    if (m.winner_id === m.player_a_id) {
      a.wins++;
      b.losses++;
    } else if (m.winner_id === m.player_b_id) {
      b.wins++;
      a.losses++;
    }
    for (const s of m.sets) {
      const aT = tallySet(s, true);
      const bT = tallySet(s, false);
      a.sets_for += aT.setFor;
      a.sets_against += aT.setAgainst;
      a.games_for += aT.gamesFor;
      a.games_against += aT.gamesAgainst;
      b.sets_for += bT.setFor;
      b.sets_against += bT.setAgainst;
      b.games_for += bT.gamesFor;
      b.games_against += bT.gamesAgainst;
    }
  }

  return Array.from(rows.values());
}

// req §8 — head-to-head only breaks an exact two-player tie where the two
// met. Returns the winner_id if a single head-to-head result decides it,
// otherwise null (3+-way ties skip this step).
function twoWayHeadToHeadWinner(
  matches: ReadonlyArray<StandingMatch>,
  aId: string,
  bId: string,
): string | null {
  let aWins = 0;
  let bWins = 0;
  for (const m of matches) {
    const between =
      (m.player_a_id === aId && m.player_b_id === bId) ||
      (m.player_a_id === bId && m.player_b_id === aId);
    if (!between) continue;
    if (m.winner_id === aId) aWins++;
    else if (m.winner_id === bId) bWins++;
  }
  if (aWins > bWins) return aId;
  if (bWins > aWins) return bId;
  return null;
}

// req §8 — rank order:
//  1. wins (points)
//  2. head-to-head (only for an exact 2-player tie that met)
//  3. set difference
//  4. game difference
//  5. fewer losses
//  6. display_name alphabetical (deterministic)
export function rankStandings(
  rows: ReadonlyArray<StandingRow>,
  matches: ReadonlyArray<StandingMatch>,
): StandingRow[] {
  // Group rows by win count to detect ties first.
  const byWins = new Map<number, StandingRow[]>();
  for (const r of rows) {
    const arr = byWins.get(r.wins) ?? [];
    arr.push(r);
    byWins.set(r.wins, arr);
  }

  // For each tied group, pre-resolve 2-way h2h order if applicable;
  // otherwise fall through to the next tiebreaks.
  function sortGroup(group: StandingRow[]): StandingRow[] {
    if (group.length === 2) {
      const [x, y] = group as [StandingRow, StandingRow];
      const w = twoWayHeadToHeadWinner(matches, x.user_id, y.user_id);
      if (w === x.user_id) return [x, y];
      if (w === y.user_id) return [y, x];
      // No decisive h2h between two tied players — fall through.
    }
    return [...group].sort((p, q) => fallThroughCompare(p, q));
  }

  function fallThroughCompare(p: StandingRow, q: StandingRow): number {
    const setDiff = (q.sets_for - q.sets_against) - (p.sets_for - p.sets_against);
    if (setDiff !== 0) return setDiff;
    const gameDiff = (q.games_for - q.games_against) - (p.games_for - p.games_against);
    if (gameDiff !== 0) return gameDiff;
    if (p.losses !== q.losses) return p.losses - q.losses;
    return p.display_name.localeCompare(q.display_name);
  }

  // Descending wins, ties resolved within each group.
  const winCountsDesc = Array.from(byWins.keys()).sort((a, b) => b - a);
  const out: StandingRow[] = [];
  for (const wc of winCountsDesc) {
    const group = byWins.get(wc)!;
    out.push(...sortGroup(group));
  }
  return out;
}

// Public entry point.
export function deriveSeasonStandings(
  matches: ReadonlyArray<StandingMatch>,
  displayNames: ReadonlyMap<string, string>,
): StandingRow[] {
  return rankStandings(aggregateStandings(matches, displayNames), matches);
}
