// Pure career-record derivation (req §9 & §10). Inputs: all CONFIRMED
// OFFICIAL matches in the series and a display_name map. Output: a ranked
// list of qualified players plus a separately-tagged "unranked" group for
// those below the §10 threshold. No I/O.

export type CareerMatch = {
  player_a_id: string;
  player_b_id: string;
  winner_id: string;
};

export type CareerRow = {
  user_id: string;
  display_name: string;
  played: number;
  wins: number;
  losses: number;
  win_pct: number;          // 0..1; defined as 0 when played = 0 (§9)
};

// req §10 — only players with ≥ DEFAULT_CAREER_THRESHOLD career matches are
// ranked. Configurable, but the default is what ships.
export const DEFAULT_CAREER_THRESHOLD = 10;

function rate(wins: number, played: number): number {
  if (played <= 0) return 0;
  return wins / played;
}

export function aggregateCareer(
  matches: ReadonlyArray<CareerMatch>,
  displayNames: ReadonlyMap<string, string>,
): CareerRow[] {
  const rows = new Map<string, CareerRow>();
  function rowFor(userId: string): CareerRow {
    let r = rows.get(userId);
    if (!r) {
      r = { user_id: userId, display_name: displayNames.get(userId) ?? userId, played: 0, wins: 0, losses: 0, win_pct: 0 };
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
  }
  for (const r of rows.values()) r.win_pct = rate(r.wins, r.played);
  return Array.from(rows.values());
}

// req §10 — descending rank order:
//   1. win_pct
//   2. played (more matches = more proven)
//   3. display_name alphabetical (deterministic)
export function rankCareer(rows: ReadonlyArray<CareerRow>): CareerRow[] {
  return [...rows].sort((p, q) => {
    if (q.win_pct !== p.win_pct) return q.win_pct - p.win_pct;
    if (q.played !== p.played) return q.played - p.played;
    return p.display_name.localeCompare(q.display_name);
  });
}

export type CareerBoard = {
  ranked: CareerRow[];
  unranked: CareerRow[];
  threshold: number;
};

// Public entry point (req §10).
export function deriveCareerBoard(
  matches: ReadonlyArray<CareerMatch>,
  displayNames: ReadonlyMap<string, string>,
  threshold: number = DEFAULT_CAREER_THRESHOLD,
): CareerBoard {
  const all = aggregateCareer(matches, displayNames);
  const ranked = rankCareer(all.filter((r) => r.played >= threshold));
  // Unranked: sort by display_name only — they're not ranked, just listed.
  const unranked = all
    .filter((r) => r.played < threshold)
    .sort((p, q) => p.display_name.localeCompare(q.display_name));
  return { ranked, unranked, threshold };
}
