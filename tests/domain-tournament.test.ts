import { describe, expect, it } from "vitest";
import {
  checkNoOverlap,
  computeClosingEndsAt,
  computeEndsAt,
  dueForFinalize,
  tournamentState,
  validatePlayedAt,
  type TournamentFields,
} from "@/domain/tournament/state";

const t: TournamentFields = {
  starts_at: "2026-01-01T00:00:00.000Z",
  ends_at: "2026-04-01T00:00:00.000Z",
  closing_ends_at: "2026-04-08T00:00:00.000Z",
  finalized_at: null,
};
const ms = (iso: string) => Date.parse(iso);

describe("tournament state (req §5.2)", () => {
  it("UPCOMING before starts_at", () => {
    expect(tournamentState(t, ms("2025-12-31T23:59:59.999Z"))).toBe("UPCOMING");
  });
  it("ACTIVE at starts_at", () => {
    expect(tournamentState(t, ms(t.starts_at))).toBe("ACTIVE");
  });
  it("ACTIVE just before ends_at", () => {
    expect(tournamentState(t, ms("2026-03-31T23:59:59.999Z"))).toBe("ACTIVE");
  });
  it("CLOSING at ends_at", () => {
    expect(tournamentState(t, ms(t.ends_at))).toBe("CLOSING");
  });
  it("CLOSING just before closing_ends_at", () => {
    expect(tournamentState(t, ms("2026-04-07T23:59:59.999Z"))).toBe("CLOSING");
  });
  it("FINALIZED at closing_ends_at", () => {
    expect(tournamentState(t, ms(t.closing_ends_at))).toBe("FINALIZED");
  });

  it("derived state is unaffected by finalized_at being set", () => {
    const fin: TournamentFields = { ...t, finalized_at: "2026-04-08T01:00:00.000Z" };
    expect(tournamentState(fin, ms("2026-02-01T00:00:00.000Z"))).toBe("ACTIVE");
  });
});

describe("dueForFinalize (arch §10)", () => {
  it("true when past closing_ends_at and not yet finalized", () => {
    expect(dueForFinalize(t, ms("2026-04-08T00:00:01.000Z"))).toBe(true);
  });
  it("false before closing_ends_at", () => {
    expect(dueForFinalize(t, ms("2026-04-07T23:59:59.999Z"))).toBe(false);
  });
  it("false once finalized_at is set, even past the boundary", () => {
    const done: TournamentFields = { ...t, finalized_at: "2026-04-08T00:00:01.000Z" };
    expect(dueForFinalize(done, ms("2026-04-08T01:00:00.000Z"))).toBe(false);
  });
});

describe("validatePlayedAt (req §5.4)", () => {
  it("accepts a played_at inside the ACTIVE window", () => {
    expect(validatePlayedAt(t, "2026-02-15T12:00:00.000Z")).toBeNull();
  });
  it("accepts the boundary starts_at", () => {
    expect(validatePlayedAt(t, t.starts_at)).toBeNull();
  });
  it("rejects before starts_at", () => {
    expect(validatePlayedAt(t, "2025-12-31T00:00:00.000Z")).toMatch(/before/i);
  });
  it("rejects on ends_at (CLOSING starts here)", () => {
    expect(validatePlayedAt(t, t.ends_at)).toMatch(/on or after/i);
  });
  it("rejects after ends_at", () => {
    expect(validatePlayedAt(t, "2026-05-01T00:00:00.000Z")).toMatch(/on or after/i);
  });
});

describe("computeEndsAt / computeClosingEndsAt (req §5.1)", () => {
  it("ends_at = starts_at + 3 calendar months", () => {
    expect(computeEndsAt("2026-01-15T00:00:00.000Z")).toBe("2026-04-15T00:00:00.000Z");
  });
  it("closing_ends_at = ends_at + 7 days", () => {
    expect(computeClosingEndsAt("2026-04-15T00:00:00.000Z")).toBe("2026-04-22T00:00:00.000Z");
  });
});

describe("checkNoOverlap (req §5.4 series invariant)", () => {
  const a = { starts_at: "2026-01-01T00:00:00.000Z", closing_ends_at: "2026-04-08T00:00:00.000Z" };
  const b = { starts_at: "2026-04-08T00:00:00.000Z", closing_ends_at: "2026-07-15T00:00:00.000Z" };

  it("accepts adjacent windows (touching at the boundary)", () => {
    expect(checkNoOverlap(b, [a])).toBeNull();
  });
  it("rejects an overlapping window", () => {
    const c = { starts_at: "2026-04-07T23:00:00.000Z", closing_ends_at: "2026-07-15T00:00:00.000Z" };
    expect(checkNoOverlap(c, [a])).toMatch(/overlap/);
  });
  it("rejects an inverted/empty window", () => {
    const bad = { starts_at: "2026-04-08T00:00:00.000Z", closing_ends_at: "2026-04-07T00:00:00.000Z" };
    expect(checkNoOverlap(bad, [])).toMatch(/empty|inverted/i);
  });
  it("accepts a window with no existing tournaments", () => {
    expect(checkNoOverlap(a, [])).toBeNull();
  });
});
