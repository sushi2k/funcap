import { describe, expect, it } from "vitest";
import { deriveSeasonStandings, type StandingMatch } from "@/domain/standings";

const NAMES = new Map<string, string>([
  ["a", "Alice"],
  ["b", "Bob"],
  ["c", "Carol"],
  ["d", "Dave"],
]);

function m(id: string, pa: string, pb: string, winner: string, sets: [number, number][]): StandingMatch {
  return {
    id,
    player_a_id: pa,
    player_b_id: pb,
    winner_id: winner,
    sets: sets.map(([a, b]) => ({ a, b })),
  };
}

describe("standings aggregation (req §8)", () => {
  it("tallies wins, losses, sets, and games", () => {
    const matches = [
      m("1", "a", "b", "a", [[6, 4], [6, 3]]),
      m("2", "a", "c", "c", [[4, 6], [4, 6]]),
    ];
    const out = deriveSeasonStandings(matches, NAMES);
    const a = out.find((r) => r.user_id === "a")!;
    expect(a).toMatchObject({
      played: 2,
      wins: 1,
      losses: 1,
      sets_for: 2,
      sets_against: 2,
      games_for: 6 + 6 + 4 + 4,
      games_against: 4 + 3 + 6 + 6,
    });
  });
});

describe("standings ranking (req §8)", () => {
  it("orders by points (= wins) descending", () => {
    const matches = [
      m("1", "a", "b", "a", [[6, 0], [6, 0]]),
      m("2", "a", "c", "a", [[6, 0], [6, 0]]),
      m("3", "b", "c", "b", [[6, 0], [6, 0]]),
    ];
    const out = deriveSeasonStandings(matches, NAMES);
    expect(out.map((r) => r.user_id)).toEqual(["a", "b", "c"]);
  });

  it("uses head-to-head to break an exact 2-player tie", () => {
    // Dave clearly leads (2 wins). Bob and Carol each have 1 win and met:
    // Bob beat Carol, so Bob outranks Carol despite identical aggregates.
    const matches = [
      m("1", "d", "b", "d", [[6, 0], [6, 0]]),
      m("2", "d", "c", "d", [[6, 0], [6, 0]]),
      m("3", "b", "c", "b", [[6, 4], [6, 4]]),
    ];
    const out = deriveSeasonStandings(matches, NAMES);
    expect(out.map((r) => r.user_id)).toEqual(["d", "b", "c"]);
  });

  it("falls through to set difference for a 3+-way tie", () => {
    // a, b, c each have 1 win; the 3-way head-to-head is circular, so
    // tiebreak by set difference. Build so 'a' wins 2 sets, loses 2 sets;
    // 'b' wins 2-1 (positive); 'c' wins 2-3 (negative).
    const matches = [
      m("1", "a", "b", "a", [[6, 0], [6, 0]]),                    // a +2 / b -2 sets
      m("2", "b", "c", "b", [[6, 0], [4, 6], [6, 0]]),           // b +1 / c -1
      m("3", "c", "a", "c", [[6, 0], [6, 0]]),                   // c +2 / a -2
    ];
    const out = deriveSeasonStandings(matches, NAMES);
    // Set differences: a=0, b=−1, c=+1 → c, a, b.
    expect(out.map((r) => r.user_id)).toEqual(["c", "a", "b"]);
  });

  it("falls through to game difference when sets equal", () => {
    // a vs b (a wins 6-0 6-1), c vs d (c wins 6-2 6-2). a and c both have
    // 1 win and +2 sets; a has the bigger game diff (12-1 vs 12-4).
    const matches = [
      m("1", "a", "b", "a", [[6, 0], [6, 1]]),
      m("2", "c", "d", "c", [[6, 2], [6, 2]]),
    ];
    const out = deriveSeasonStandings(matches, NAMES);
    expect(out.slice(0, 2).map((r) => r.user_id)).toEqual(["a", "c"]);
  });

  it("uses display_name as the deterministic final tiebreak", () => {
    // Alice and Bob play no one else and never met — set/game diff equal.
    // Carol beat Dave 6-0 6-0; Dave/Alice/Bob otherwise empty.
    // Force a tie between Alice and Bob via two near-identical matches.
    const matches = [
      m("1", "a", "c", "a", [[6, 0], [6, 0]]),
      m("2", "b", "d", "b", [[6, 0], [6, 0]]),
    ];
    const out = deriveSeasonStandings(matches, NAMES);
    // Alice & Bob tied on wins, sets, games — Alice first by name.
    expect(out.slice(0, 2).map((r) => r.user_id)).toEqual(["a", "b"]);
  });
});
