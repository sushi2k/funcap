import { describe, expect, it } from "vitest";
import { rankSuggestions, type Candidate, type Caller } from "@/domain/matchmaking";

const caller: Caller = { id: "me", self_level: 5, career_wins: 5, career_played: 10 };

const c = (id: string, level: number | null, wins: number, played: number): Candidate => ({
  id,
  display_name: id,
  self_level: level,
  career_wins: wins,
  career_played: played,
});

describe("rankSuggestions (req §4)", () => {
  it("ranks by self_level proximity first", () => {
    const out = rankSuggestions(caller, [c("far", 9, 5, 10), c("near", 5, 0, 10), c("mid", 7, 5, 10)]);
    expect(out.map((o) => o.id)).toEqual(["near", "mid", "far"]);
  });

  it("breaks level ties with win-% proximity", () => {
    // Caller win% = 0.5. Two candidates at the same level — sort by win-%
    // proximity to 0.5.
    const out = rankSuggestions(caller, [
      c("far_pct", 5, 10, 10), // 1.0
      c("near_pct", 5, 5, 10), // 0.5
    ]);
    expect(out.map((o) => o.id)).toEqual(["near_pct", "far_pct"]);
  });

  it("ranks level-defined candidates above level-undefined when the caller has a level", () => {
    const out = rankSuggestions(caller, [
      c("no_level_close", null, 5, 10),
      c("level_far", 9, 5, 10),
    ]);
    expect(out.map((o) => o.id)).toEqual(["level_far", "no_level_close"]);
  });

  it("falls back to pure win-% proximity when the caller has no level", () => {
    const callerNoLevel: Caller = { id: "me", self_level: null, career_wins: 5, career_played: 10 };
    const out = rankSuggestions(callerNoLevel, [
      c("far_pct", 5, 10, 10),
      c("near_pct", 9, 5, 10),
    ]);
    expect(out.map((o) => o.id)).toEqual(["near_pct", "far_pct"]);
  });

  it("uses display_name as final deterministic tiebreak", () => {
    const out = rankSuggestions(caller, [
      c("b", 5, 5, 10),
      c("a", 5, 5, 10),
    ]);
    expect(out.map((o) => o.id)).toEqual(["a", "b"]);
  });
});
