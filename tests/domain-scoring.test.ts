import { describe, expect, it } from "vitest";
import { validateMatchResult, validateSet, type SetScore } from "@/domain/scoring";

const A = "a-id";
const B = "b-id";

function set(a: number, b: number, tb_a?: number, tb_b?: number): SetScore {
  return tb_a === undefined && tb_b === undefined ? { a, b } : { a, b, tb_a, tb_b };
}

describe("validateSet — STANDARD (req §7.3)", () => {
  it.each([
    [6, 0],
    [6, 1],
    [6, 2],
    [6, 3],
    [6, 4],
    [7, 5],
  ])("accepts %i-%i", (a, b) => {
    expect(validateSet(set(a, b), "STANDARD")).toBeNull();
  });

  it("rejects 6-5 (must reach 7-5 or 7-6)", () => {
    expect(validateSet(set(6, 5), "STANDARD")).not.toBeNull();
  });

  it("rejects 5-6", () => {
    expect(validateSet(set(5, 6), "STANDARD")).not.toBeNull();
  });

  it("rejects 8-6 advantage-set", () => {
    expect(validateSet(set(8, 6), "STANDARD")).not.toBeNull();
  });

  it("accepts 7-6 without tiebreak points", () => {
    expect(validateSet(set(7, 6), "STANDARD")).toBeNull();
  });

  it("accepts 7-6 with valid tiebreak points 7-5", () => {
    expect(validateSet(set(7, 6, 7, 5), "STANDARD")).toBeNull();
  });

  it("rejects tiebreak when winner reached only 5", () => {
    expect(validateSet(set(7, 6, 5, 3), "STANDARD")).not.toBeNull();
  });

  it("rejects tiebreak without win-by-2", () => {
    expect(validateSet(set(7, 6, 7, 6), "STANDARD")).not.toBeNull();
  });

  it("rejects tiebreak whose points favour the set loser", () => {
    expect(validateSet(set(7, 6, 4, 7), "STANDARD")).not.toBeNull();
  });

  it("rejects negative scores", () => {
    expect(validateSet(set(-1, 0), "STANDARD")).not.toBeNull();
  });
});

describe("validateSet — SUPER_TIEBREAK_DECIDER (req §7.3)", () => {
  it("accepts 10-8", () => {
    expect(validateSet(set(10, 8), "SUPER_TIEBREAK_DECIDER")).toBeNull();
  });
  it("accepts 12-10", () => {
    expect(validateSet(set(12, 10), "SUPER_TIEBREAK_DECIDER")).toBeNull();
  });
  it("rejects 9-7 (winner below 10)", () => {
    expect(validateSet(set(9, 7), "SUPER_TIEBREAK_DECIDER")).not.toBeNull();
  });
  it("rejects 10-9 (not win-by-2)", () => {
    expect(validateSet(set(10, 9), "SUPER_TIEBREAK_DECIDER")).not.toBeNull();
  });
});

describe("validateMatchResult — COMPLETED (req §7.4)", () => {
  it("accepts 2-set win", () => {
    const r = validateMatchResult({
      format: "BEST_OF_3_FULL",
      outcome: "COMPLETED",
      sets: [set(6, 4), set(6, 2)],
      player_a_id: A,
      player_b_id: B,
    });
    expect(r.ok && r.winner_id).toBe(A);
  });

  it("accepts 3-set win", () => {
    const r = validateMatchResult({
      format: "BEST_OF_3_FULL",
      outcome: "COMPLETED",
      sets: [set(4, 6), set(7, 5), set(6, 3)],
      player_a_id: A,
      player_b_id: B,
    });
    expect(r.ok && r.winner_id).toBe(A);
  });

  it("rejects a third set after a 2-0 lead", () => {
    const r = validateMatchResult({
      format: "BEST_OF_3_FULL",
      outcome: "COMPLETED",
      sets: [set(6, 0), set(6, 0), set(6, 0)],
      player_a_id: A,
      player_b_id: B,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects fewer than 2 sets", () => {
    const r = validateMatchResult({
      format: "BEST_OF_3_FULL",
      outcome: "COMPLETED",
      sets: [set(6, 0)],
      player_a_id: A,
      player_b_id: B,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects an invalid set inside an otherwise-valid match", () => {
    const r = validateMatchResult({
      format: "BEST_OF_3_FULL",
      outcome: "COMPLETED",
      sets: [set(6, 4), set(8, 6)],
      player_a_id: A,
      player_b_id: B,
    });
    expect(r.ok).toBe(false);
  });

  it("uses 10-pt super-tiebreak for deciding set under SUPER_TB", () => {
    const r = validateMatchResult({
      format: "BEST_OF_3_SUPER_TB",
      outcome: "COMPLETED",
      sets: [set(6, 4), set(3, 6), set(10, 8)],
      player_a_id: A,
      player_b_id: B,
    });
    expect(r.ok && r.winner_id).toBe(A);
  });

  it("rejects a standard third set under SUPER_TB if it's not a super-tiebreak", () => {
    const r = validateMatchResult({
      format: "BEST_OF_3_SUPER_TB",
      outcome: "COMPLETED",
      sets: [set(6, 4), set(3, 6), set(6, 3)],
      player_a_id: A,
      player_b_id: B,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects same player_a == player_b", () => {
    const r = validateMatchResult({
      format: "BEST_OF_3_FULL",
      outcome: "COMPLETED",
      sets: [set(6, 0), set(6, 0)],
      player_a_id: A,
      player_b_id: A,
    });
    expect(r.ok).toBe(false);
  });
});

describe("validateMatchResult — RETIRED (req §7.4)", () => {
  it("accepts a retirement with valid completed sets and partial last set", () => {
    const r = validateMatchResult({
      format: "BEST_OF_3_FULL",
      outcome: "RETIRED",
      sets: [set(6, 2), set(3, 1)],
      player_a_id: A,
      player_b_id: B,
      retired_by_id: B,
    });
    expect(r.ok && r.winner_id).toBe(A);
  });

  it("requires retired_by_id", () => {
    const r = validateMatchResult({
      format: "BEST_OF_3_FULL",
      outcome: "RETIRED",
      sets: [set(6, 2)],
      player_a_id: A,
      player_b_id: B,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects retired_by_id that isn't a participant", () => {
    const r = validateMatchResult({
      format: "BEST_OF_3_FULL",
      outcome: "RETIRED",
      sets: [set(6, 2)],
      player_a_id: A,
      player_b_id: B,
      retired_by_id: "c-id",
    });
    expect(r.ok).toBe(false);
  });
});

describe("validateMatchResult — WALKOVER (req §7.4)", () => {
  it("requires empty sets", () => {
    const r = validateMatchResult({
      format: "BEST_OF_3_FULL",
      outcome: "WALKOVER",
      sets: [set(6, 0)],
      player_a_id: A,
      player_b_id: B,
      walkover_winner_id: A,
    });
    expect(r.ok).toBe(false);
  });

  it("requires walkover_winner_id to be a participant", () => {
    const r = validateMatchResult({
      format: "BEST_OF_3_FULL",
      outcome: "WALKOVER",
      sets: [],
      player_a_id: A,
      player_b_id: B,
      walkover_winner_id: "c-id",
    });
    expect(r.ok).toBe(false);
  });

  it("accepts a walkover and returns the named winner", () => {
    const r = validateMatchResult({
      format: "BEST_OF_3_FULL",
      outcome: "WALKOVER",
      sets: [],
      player_a_id: A,
      player_b_id: B,
      walkover_winner_id: B,
    });
    expect(r.ok && r.winner_id).toBe(B);
  });
});
