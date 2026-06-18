// Pure match-state-machine guards (req §6.4). Services consult these before
// persisting; out-of-order transitions are rejected here so the domain — not
// the route handler — is the authority (security.md API-2).
//
// This module knows nothing about HTTP, Prisma, or React. Callers pass plain
// data; the result tells them what's legal.

export const MATCH_STATES = ["PENDING", "CONFIRMED", "DISPUTED", "VOIDED"] as const;
export type MatchState = (typeof MATCH_STATES)[number];

export const MATCH_TYPES = ["OFFICIAL", "FRIENDLY"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export type ActorRole = "ENTRANT" | "COUNTERPARTY" | "ADMIN" | "OTHER";

export type MatchSnapshot = {
  state: MatchState;
  entered_by_id: string;
  player_a_id: string;
  player_b_id: string;
};

// Classify the actor against the match — pure helper for services.
// "OTHER" covers the not-a-participant-and-not-an-admin case.
export function classifyActor(m: MatchSnapshot, actorUserId: string, isAdmin: boolean): ActorRole {
  if (isAdmin) return "ADMIN";
  if (actorUserId === m.entered_by_id) return "ENTRANT";
  if (actorUserId === m.player_a_id || actorUserId === m.player_b_id) return "COUNTERPARTY";
  return "OTHER";
}

export type TransitionDecision =
  | { ok: true; next: MatchState }
  | { ok: false; reason: TransitionRejection };

export type TransitionRejection =
  | "FORBIDDEN"            // actor lacks the role for this transition
  | "WRONG_STATE"          // current state doesn't permit this transition
  | "ALREADY_LOCKED";      // shorthand for CONFIRMED protections

// Allowed transitions (player-driven). Admin transitions (resolve/amend/void
// from non-PENDING) belong to issue #6 and are not exposed here.
//
// PENDING → CONFIRMED   — counterparty approves (locks)
// PENDING → DISPUTED    — counterparty rejects (reason)
// PENDING → VOIDED      — entrant withdraws
// PENDING → PENDING     — entrant edits (caller treats as PATCH; state unchanged)
//
// CONFIRMED is locked: only an admin may amend/void (deferred to #6).
// DISPUTED can be resolved/voided by an admin (deferred to #6).
// VOIDED is terminal.

export function canApprove(m: MatchSnapshot, actor: ActorRole): TransitionDecision {
  if (m.state !== "PENDING") {
    return { ok: false, reason: m.state === "CONFIRMED" ? "ALREADY_LOCKED" : "WRONG_STATE" };
  }
  if (actor !== "COUNTERPARTY") return { ok: false, reason: "FORBIDDEN" };
  return { ok: true, next: "CONFIRMED" };
}

export function canReject(m: MatchSnapshot, actor: ActorRole): TransitionDecision {
  if (m.state !== "PENDING") {
    return { ok: false, reason: m.state === "CONFIRMED" ? "ALREADY_LOCKED" : "WRONG_STATE" };
  }
  if (actor !== "COUNTERPARTY") return { ok: false, reason: "FORBIDDEN" };
  return { ok: true, next: "DISPUTED" };
}

export function canWithdraw(m: MatchSnapshot, actor: ActorRole): TransitionDecision {
  if (m.state !== "PENDING") {
    return { ok: false, reason: m.state === "CONFIRMED" ? "ALREADY_LOCKED" : "WRONG_STATE" };
  }
  if (actor !== "ENTRANT") return { ok: false, reason: "FORBIDDEN" };
  return { ok: true, next: "VOIDED" };
}

export function canEdit(m: MatchSnapshot, actor: ActorRole): TransitionDecision {
  if (m.state !== "PENDING") {
    return { ok: false, reason: m.state === "CONFIRMED" ? "ALREADY_LOCKED" : "WRONG_STATE" };
  }
  if (actor !== "ENTRANT") return { ok: false, reason: "FORBIDDEN" };
  return { ok: true, next: "PENDING" };
}

// Normalised pair for the §6.2 partial unique index. Pure.
export function normalisePair(playerA: string, playerB: string): { low: string; high: string } {
  if (playerA === playerB) throw new Error("players must differ");
  return playerA < playerB
    ? { low: playerA, high: playerB }
    : { low: playerB, high: playerA };
}
