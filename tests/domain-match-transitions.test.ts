import { describe, expect, it } from "vitest";
import {
  classifyActor,
  canApprove,
  canEdit,
  canReject,
  canWithdraw,
  normalisePair,
  type MatchSnapshot,
} from "@/domain/match/transitions";

const ENT = "ent-id";
const OPP = "opp-id";
const STR = "stranger-id";

function snap(state: MatchSnapshot["state"]): MatchSnapshot {
  return { state, entered_by_id: ENT, player_a_id: ENT, player_b_id: OPP };
}

describe("classifyActor", () => {
  it("identifies the entrant", () => {
    expect(classifyActor(snap("PENDING"), ENT, false)).toBe("ENTRANT");
  });
  it("identifies the counterparty", () => {
    expect(classifyActor(snap("PENDING"), OPP, false)).toBe("COUNTERPARTY");
  });
  it("identifies a stranger as OTHER", () => {
    expect(classifyActor(snap("PENDING"), STR, false)).toBe("OTHER");
  });
  it("classifies any caller as ADMIN if isAdmin", () => {
    expect(classifyActor(snap("PENDING"), STR, true)).toBe("ADMIN");
  });
});

describe("canApprove (PENDING → CONFIRMED, counterparty only)", () => {
  it("allows the counterparty to approve a PENDING match", () => {
    expect(canApprove(snap("PENDING"), "COUNTERPARTY")).toEqual({ ok: true, next: "CONFIRMED" });
  });
  it("forbids the entrant from approving their own entry", () => {
    expect(canApprove(snap("PENDING"), "ENTRANT")).toEqual({ ok: false, reason: "FORBIDDEN" });
  });
  it("forbids strangers", () => {
    expect(canApprove(snap("PENDING"), "OTHER")).toEqual({ ok: false, reason: "FORBIDDEN" });
  });
  it("rejects approval of a non-PENDING match (CONFIRMED → ALREADY_LOCKED)", () => {
    expect(canApprove(snap("CONFIRMED"), "COUNTERPARTY")).toEqual({ ok: false, reason: "ALREADY_LOCKED" });
  });
  it("rejects approval of a DISPUTED match", () => {
    expect(canApprove(snap("DISPUTED"), "COUNTERPARTY")).toEqual({ ok: false, reason: "WRONG_STATE" });
  });
  it("rejects approval of a VOIDED match", () => {
    expect(canApprove(snap("VOIDED"), "COUNTERPARTY")).toEqual({ ok: false, reason: "WRONG_STATE" });
  });
});

describe("canReject (PENDING → DISPUTED, counterparty only)", () => {
  it("allows counterparty to reject a PENDING match", () => {
    expect(canReject(snap("PENDING"), "COUNTERPARTY")).toEqual({ ok: true, next: "DISPUTED" });
  });
  it("forbids the entrant", () => {
    expect(canReject(snap("PENDING"), "ENTRANT")).toEqual({ ok: false, reason: "FORBIDDEN" });
  });
  it("rejects DISPUTED re-rejection", () => {
    expect(canReject(snap("DISPUTED"), "COUNTERPARTY")).toEqual({ ok: false, reason: "WRONG_STATE" });
  });
  it("rejects CONFIRMED → ALREADY_LOCKED", () => {
    expect(canReject(snap("CONFIRMED"), "COUNTERPARTY")).toEqual({ ok: false, reason: "ALREADY_LOCKED" });
  });
});

describe("canWithdraw (PENDING → VOIDED, entrant only)", () => {
  it("allows the entrant", () => {
    expect(canWithdraw(snap("PENDING"), "ENTRANT")).toEqual({ ok: true, next: "VOIDED" });
  });
  it("forbids the counterparty", () => {
    expect(canWithdraw(snap("PENDING"), "COUNTERPARTY")).toEqual({ ok: false, reason: "FORBIDDEN" });
  });
  it("rejects withdraw of an already VOIDED match", () => {
    expect(canWithdraw(snap("VOIDED"), "ENTRANT")).toEqual({ ok: false, reason: "WRONG_STATE" });
  });
  it("rejects withdraw of a CONFIRMED match", () => {
    expect(canWithdraw(snap("CONFIRMED"), "ENTRANT")).toEqual({ ok: false, reason: "ALREADY_LOCKED" });
  });
});

describe("canEdit (PENDING stays PENDING, entrant only)", () => {
  it("allows the entrant to edit a PENDING match", () => {
    expect(canEdit(snap("PENDING"), "ENTRANT")).toEqual({ ok: true, next: "PENDING" });
  });
  it("forbids the counterparty", () => {
    expect(canEdit(snap("PENDING"), "COUNTERPARTY")).toEqual({ ok: false, reason: "FORBIDDEN" });
  });
  it("rejects edit of a CONFIRMED (locked) match", () => {
    expect(canEdit(snap("CONFIRMED"), "ENTRANT")).toEqual({ ok: false, reason: "ALREADY_LOCKED" });
  });
});

describe("normalisePair (req §6.2)", () => {
  it("returns players sorted lexicographically", () => {
    expect(normalisePair("b", "a")).toEqual({ low: "a", high: "b" });
    expect(normalisePair("a", "b")).toEqual({ low: "a", high: "b" });
  });
  it("throws when players are the same", () => {
    expect(() => normalisePair("a", "a")).toThrow();
  });
});
