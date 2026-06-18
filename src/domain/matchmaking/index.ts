// Pure matchmaking ranking (req §4). Caller provides a candidate pool
// already filtered for ACTIVE status, current user, and (for OFFICIAL
// suggestions) opponents the caller has played an OFFICIAL match against
// in the current tournament. This module only ranks.

export type Candidate = {
  id: string;
  display_name: string;
  self_level: number | null; // 1..10, optional
  career_wins: number;
  career_played: number;
};

export type Caller = {
  id: string;
  self_level: number | null;
  career_wins: number;
  career_played: number;
};

function winPct(wins: number, played: number): number {
  if (played <= 0) return 0;
  return wins / played;
}

// Rank order:
//  1. self_level proximity (|c.self_level − caller.self_level|), ascending.
//  2. career win-% proximity, ascending.
//  3. display_name alphabetical, deterministic tiebreak.
// If caller has no self_level, level proximity falls back to win-% proximity.
// Candidates with no self_level rank after those with a defined level when
// the caller has one (req §4 — "fall back to win-%-based proximity").
export function rankSuggestions(caller: Caller, candidates: ReadonlyArray<Candidate>): Candidate[] {
  const callerPct = winPct(caller.career_wins, caller.career_played);
  const callerLevel = caller.self_level;

  function score(c: Candidate): { levelGroup: number; levelDist: number; pctDist: number } {
    const cPct = winPct(c.career_wins, c.career_played);
    if (callerLevel != null && c.self_level != null) {
      return {
        levelGroup: 0,
        levelDist: Math.abs(c.self_level - callerLevel),
        pctDist: Math.abs(cPct - callerPct),
      };
    }
    if (callerLevel != null && c.self_level == null) {
      // Candidate has no level — rank after level-defined candidates.
      return { levelGroup: 1, levelDist: 0, pctDist: Math.abs(cPct - callerPct) };
    }
    // Caller has no level: pure win-% proximity for everyone.
    return { levelGroup: 0, levelDist: 0, pctDist: Math.abs(cPct - callerPct) };
  }

  return [...candidates].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa.levelGroup !== sb.levelGroup) return sa.levelGroup - sb.levelGroup;
    if (sa.levelDist !== sb.levelDist) return sa.levelDist - sb.levelDist;
    if (sa.pctDist !== sb.pctDist) return sa.pctDist - sb.pctDist;
    return a.display_name.localeCompare(b.display_name);
  });
}
