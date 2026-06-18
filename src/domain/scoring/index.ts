// Pure tennis scoring (req §7). The single source of truth for "is this a
// legal tennis result?" — reused by score entry and admin amend
// (arch §7 — match validation). No I/O, no React, no Prisma.

import type { MatchFormat } from "@/domain/tournament/state";

export const MATCH_OUTCOMES = ["COMPLETED", "RETIRED", "WALKOVER"] as const;
export type MatchOutcome = (typeof MATCH_OUTCOMES)[number];

// `tb_a`/`tb_b` may be omitted entirely or be undefined — Zod's `.optional()`
// produces the latter, so we permit both with `| undefined`.
export type SetScore = {
  a: number;
  b: number;
  tb_a?: number | undefined;
  tb_b?: number | undefined;
};

// Shape of a proposed result fed to validateMatchResult().
// `winner_id` is *derived* by this module — callers must use the returned id,
// never the client-supplied one (req §7.4 — server-authoritative).
export type ResultInput = {
  format: MatchFormat;
  outcome: MatchOutcome;
  sets: SetScore[];
  player_a_id: string;
  player_b_id: string;
  retired_by_id?: string | null;
  walkover_winner_id?: string | null;
};

export type ResultValidation =
  | { ok: true; winner_id: string }
  | { ok: false; error: string };

// ---------- Set validity (req §7.3) ----------

type SetKind = "STANDARD" | "SUPER_TIEBREAK_DECIDER";

function setKind(format: MatchFormat, setIndex: number, totalSetsInSequence: number): SetKind {
  // setIndex is 0-based. The deciding third set under SUPER_TB is the only set
  // that may be a 10-point match-tiebreak; sets 1 and 2 are standard.
  if (format === "BEST_OF_3_SUPER_TB" && setIndex === 2 && totalSetsInSequence === 3) {
    return "SUPER_TIEBREAK_DECIDER";
  }
  return "STANDARD";
}

// Returns null if valid; otherwise an error string.
export function validateSet(s: SetScore, kind: SetKind): string | null {
  if (!Number.isInteger(s.a) || s.a < 0) return "set score `a` must be a non-negative integer";
  if (!Number.isInteger(s.b) || s.b < 0) return "set score `b` must be a non-negative integer";
  if (s.tb_a !== undefined && (!Number.isInteger(s.tb_a) || s.tb_a < 0))
    return "tiebreak `tb_a` must be a non-negative integer";
  if (s.tb_b !== undefined && (!Number.isInteger(s.tb_b) || s.tb_b < 0))
    return "tiebreak `tb_b` must be a non-negative integer";

  const hi = Math.max(s.a, s.b);
  const lo = Math.min(s.a, s.b);

  if (kind === "SUPER_TIEBREAK_DECIDER") {
    if (hi < 10) return "super-tiebreak winner must reach at least 10";
    if (hi - lo < 2) return "super-tiebreak must be won by 2";
    return null;
  }

  // Standard set: 6–0 … 6–4, 7–5, or 7–6 (with optional tiebreak points).
  if (hi === 6 && lo <= 4 && hi - lo >= 2) return null;
  if (hi === 7 && lo === 5) return null;
  if (hi === 7 && lo === 6) {
    if (s.tb_a === undefined && s.tb_b === undefined) return null; // points optional
    const tbA = s.tb_a ?? 0;
    const tbB = s.tb_b ?? 0;
    const tbHi = Math.max(tbA, tbB);
    const tbLo = Math.min(tbA, tbB);
    // The set winner is whoever scored 7 games. Their tiebreak points must be
    // the higher of the two and ≥ 7 with win-by-2.
    const setWinnerHasHigherTb = (s.a === 7 && tbA > tbB) || (s.b === 7 && tbB > tbA);
    if (!setWinnerHasHigherTb) {
      return "tiebreak points must favour the set winner";
    }
    if (tbHi < 7) return "tiebreak winner must reach at least 7";
    if (tbHi - tbLo < 2) return "tiebreak must be won by 2";
    return null;
  }

  return `invalid set score ${s.a}-${s.b}`;
}

// ---------- Match validity (req §7.4) ----------

function setsWonByPlayer(sets: SetScore[], totalSetsInSequence: number, format: MatchFormat) {
  let a = 0;
  let b = 0;
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i]!;
    const isDecider = setKind(format, i, totalSetsInSequence) === "SUPER_TIEBREAK_DECIDER";
    if (isDecider) {
      // Whichever score is higher wins the decider; standard sets compare
      // games, but the super-tiebreak set score IS its points (≥10, by 2).
      if (s.a > s.b) a++;
      else if (s.b > s.a) b++;
      continue;
    }
    if (s.a > s.b) a++;
    else if (s.b > s.a) b++;
  }
  return { a, b };
}

export function validateMatchResult(input: ResultInput): ResultValidation {
  if (input.player_a_id === input.player_b_id) {
    return { ok: false, error: "player_a and player_b must differ" };
  }

  if (input.outcome === "WALKOVER") {
    if (input.sets.length !== 0) return { ok: false, error: "WALKOVER must have no sets" };
    const w = input.walkover_winner_id;
    if (!w || (w !== input.player_a_id && w !== input.player_b_id)) {
      return { ok: false, error: "WALKOVER requires winner_id to be a participant" };
    }
    return { ok: true, winner_id: w };
  }

  if (input.outcome === "RETIRED") {
    if (!input.retired_by_id) {
      return { ok: false, error: "RETIRED requires retired_by_id" };
    }
    if (input.retired_by_id !== input.player_a_id && input.retired_by_id !== input.player_b_id) {
      return { ok: false, error: "retired_by_id must be a participant" };
    }
    // Completed sets in a retirement must each be valid; an optional final
    // in-progress set may be partial (no validity check). With no clear
    // mid-set marker, we apply the rule conservatively: all sets are
    // validated except the final one when it is not a winning set under §7.3.
    for (let i = 0; i < input.sets.length; i++) {
      const isLast = i === input.sets.length - 1;
      const kind = setKind(input.format, i, input.sets.length);
      const setError = validateSet(input.sets[i]!, kind);
      if (setError && !isLast) return { ok: false, error: setError };
      // For the final set, only enforce non-negative integers (covered above).
    }
    const winner =
      input.retired_by_id === input.player_a_id ? input.player_b_id : input.player_a_id;
    return { ok: true, winner_id: winner };
  }

  // COMPLETED: best-of-3; winner has exactly 2 sets; no set after a 2-0 lead;
  // every set valid; total sets ∈ {2, 3}.
  const total = input.sets.length;
  if (total < 2 || total > 3) {
    return { ok: false, error: "COMPLETED match must have 2 or 3 sets" };
  }
  for (let i = 0; i < input.sets.length; i++) {
    const setError = validateSet(input.sets[i]!, setKind(input.format, i, total));
    if (setError) return { ok: false, error: setError };
  }
  // No set may follow a 2-0 lead.
  if (total === 3) {
    const { a: a2, b: b2 } = setsWonByPlayer(input.sets.slice(0, 2), 2, input.format);
    if (a2 === 2 || b2 === 2) {
      return { ok: false, error: "third set may not follow a 2-0 lead" };
    }
  }
  const { a, b } = setsWonByPlayer(input.sets, total, input.format);
  if (a === 2 && b < 2) return { ok: true, winner_id: input.player_a_id };
  if (b === 2 && a < 2) return { ok: true, winner_id: input.player_b_id };
  return { ok: false, error: "COMPLETED match requires exactly one player to win 2 sets" };
}
