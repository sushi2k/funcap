import { describe, expect, it } from "vitest";
import { deriveCareerBoard, type CareerMatch } from "@/domain/career";

const NAMES = new Map<string, string>([
  ["a", "Alice"],
  ["b", "Bob"],
  ["c", "Carol"],
]);

function m(pa: string, pb: string, winner: string): CareerMatch {
  return { player_a_id: pa, player_b_id: pb, winner_id: winner };
}

// Build a list where one player has many wins, another has few.
function build(): CareerMatch[] {
  const out: CareerMatch[] = [];
  // Alice: 10-0 (100%)
  for (let i = 0; i < 10; i++) out.push(m("a", "b", "a"));
  // Bob: 0-10 vs Alice. Add 10 more matches Bob vs Carol so Bob has 5-15.
  for (let i = 0; i < 10; i++) out.push(m("b", "c", i < 5 ? "b" : "c"));
  // Carol now has 10 matches (vs Bob).
  return out;
}

describe("career derivation (req §9)", () => {
  it("computes played/wins/losses/win_pct", () => {
    const { ranked } = deriveCareerBoard(build(), NAMES, 1);
    const alice = ranked.find((r) => r.user_id === "a")!;
    expect(alice).toMatchObject({ played: 10, wins: 10, losses: 0, win_pct: 1 });
    const bob = ranked.find((r) => r.user_id === "b")!;
    expect(bob).toMatchObject({ played: 20, wins: 5, losses: 15 });
    expect(bob.win_pct).toBeCloseTo(5 / 20);
  });
});

describe("career ranking (req §10)", () => {
  it("ranks by win_pct desc, then played desc, then display_name", () => {
    const { ranked } = deriveCareerBoard(build(), NAMES, 1);
    expect(ranked.map((r) => r.user_id)).toEqual(["a", "c", "b"]);
  });

  it("excludes players below the configurable threshold", () => {
    const matches = [m("a", "b", "a"), m("a", "b", "a"), m("c", "a", "c")];
    // Alice: 3 played, Bob: 2 played, Carol: 1 played.
    const board = deriveCareerBoard(matches, NAMES, 3);
    expect(board.ranked.map((r) => r.user_id)).toEqual(["a"]);
    expect(board.unranked.map((r) => r.user_id).sort()).toEqual(["b", "c"]);
    expect(board.threshold).toBe(3);
  });

  it("returns 0 win_pct when played = 0 (defensive)", () => {
    const board = deriveCareerBoard([], NAMES, 10);
    expect(board.ranked).toEqual([]);
    expect(board.unranked).toEqual([]);
  });
});
