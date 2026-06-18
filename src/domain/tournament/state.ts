// Pure tournament domain (no I/O, no secrets — arch §7).
//
// The tournament's *state* is a function of time (req §5.2); only the
// finalize side-effects are stored (via `finalized_at`). Every read derives
// state on the fly so we never store a mutable status column.

export const MATCH_FORMATS = ["BEST_OF_3_FULL", "BEST_OF_3_SUPER_TB"] as const;
export type MatchFormat = (typeof MATCH_FORMATS)[number];
export const DEFAULT_MATCH_FORMAT: MatchFormat = "BEST_OF_3_FULL";

export type TournamentState = "UPCOMING" | "ACTIVE" | "CLOSING" | "FINALIZED";

export type TournamentFields = {
  starts_at: string;        // ISO-8601
  ends_at: string;          // ISO-8601
  closing_ends_at: string;  // ISO-8601
  finalized_at: string | null;
};

function ms(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`Invalid ISO timestamp: ${iso}`);
  return t;
}

// req §5.2 — derived from time. `finalized_at` is the *evidence* the
// finalize side-effects have run; it does not change the displayed state
// (which is purely time-based) — only `dueForFinalize` cares.
export function tournamentState(t: TournamentFields, now: number = Date.now()): TournamentState {
  const startsAt = ms(t.starts_at);
  const endsAt = ms(t.ends_at);
  const closingEndsAt = ms(t.closing_ends_at);
  if (now < startsAt) return "UPCOMING";
  if (now < endsAt) return "ACTIVE";
  if (now < closingEndsAt) return "CLOSING";
  return "FINALIZED";
}

// True iff the finalize side-effects should run now and haven't yet.
// Idempotency guard for the scheduler (arch §10).
export function dueForFinalize(t: TournamentFields, now: number = Date.now()): boolean {
  if (t.finalized_at) return false;
  return now >= ms(t.closing_ends_at);
}

// req §5.4 — a match's tournament is the one whose ACTIVE window contains
// `played_at`. Returns the reason for rejection if not, or null on success.
export function validatePlayedAt(
  t: TournamentFields,
  playedAtIso: string,
): string | null {
  const played = ms(playedAtIso);
  const startsAt = ms(t.starts_at);
  const endsAt = ms(t.ends_at);
  if (played < startsAt) return "played_at is before the tournament's ACTIVE window";
  if (played >= endsAt) return "played_at is on or after the tournament's ACTIVE window ends";
  return null;
}

// Spec constants from req §5.1 + §17 decision #2.
export const ACTIVE_WINDOW_MS = 3 * 30 * 24 * 60 * 60_000;  // approx — see invariants below
export const CLOSING_WINDOW_MS = 7 * 24 * 60 * 60_000;

// req §5.1 enforces ends_at = starts_at + 3 months (calendar-correct, not
// "90 days"), and closing_ends_at = ends_at + 7 days. Calendar-month math is
// authoritative; we expose computed helpers so admin create can use them.
export function computeEndsAt(startsAtIso: string): string {
  const d = new Date(startsAtIso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ISO timestamp: ${startsAtIso}`);
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + 3);
  return out.toISOString();
}

export function computeClosingEndsAt(endsAtIso: string): string {
  return new Date(ms(endsAtIso) + CLOSING_WINDOW_MS).toISOString();
}

// req §5.4 — sequential, non-overlapping. Returns an error string if the
// proposed [starts_at, closing_ends_at] window overlaps any existing
// tournament's full lifecycle window. Caller passes the existing windows.
export type TournamentWindow = { starts_at: string; closing_ends_at: string };

export function checkNoOverlap(
  proposed: TournamentWindow,
  existing: ReadonlyArray<TournamentWindow>,
): string | null {
  const ps = ms(proposed.starts_at);
  const pe = ms(proposed.closing_ends_at);
  if (ps >= pe) return "Proposed window is empty or inverted";
  for (const e of existing) {
    const es = ms(e.starts_at);
    const ee = ms(e.closing_ends_at);
    if (ps < ee && es < pe) {
      return "Proposed window overlaps an existing tournament";
    }
  }
  return null;
}
