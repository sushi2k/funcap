import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/server/dal/prisma";
import { createMatch, approvePendingMatch } from "@/server/dal/matches";

// Integration test: the partial unique index from req §6.2 must reject a
// second non-VOIDED OFFICIAL match for the same pairing in the same
// tournament, and the DAL must surface that as PAIRING_CONFLICT (not a raw
// throw). Also exercises the IDOR guard on approve.

const T_ID = randomUUID();
const A_ID = randomUUID();
const B_ID = randomUUID();
const C_ID = randomUUID();
const STARTS = "2026-01-01T00:00:00.000Z";
const ENDS = "2026-04-01T00:00:00.000Z";
const CLOSING = "2026-04-08T00:00:00.000Z";
const PLAYED = "2026-02-15T12:00:00.000Z";

async function seed() {
  await prisma.tournament.create({
    data: {
      id: T_ID,
      name: "T1",
      starts_at: STARTS,
      ends_at: ENDS,
      closing_ends_at: CLOSING,
      match_format: "BEST_OF_3_FULL",
    },
  });
  for (const id of [A_ID, B_ID, C_ID]) {
    await prisma.user.create({
      data: {
        id,
        email: `${id}@x`,
        display_name: `name_${id.slice(0, 6)}`,
        password_hash: "x",
        role: "PLAYER",
        status: "ACTIVE",
        created_at: STARTS,
        updated_at: STARTS,
      },
    });
  }
}

async function cleanup() {
  await prisma.match.deleteMany({ where: { tournament_id: T_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [A_ID, B_ID, C_ID] } } });
  await prisma.tournament.deleteMany({ where: { id: T_ID } });
}

beforeAll(async () => {
  await cleanup();
  await seed();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("Match DAL — pairing uniqueness (req §6.2)", () => {
  it("rejects a second non-VOIDED OFFICIAL match for the same pair via PAIRING_CONFLICT", async () => {
    const r1 = await createMatch({
      tournamentId: T_ID,
      type: "OFFICIAL",
      enteredByUserId: A_ID,
      opponentId: B_ID,
      outcome: "COMPLETED",
      sets: [{ a: 6, b: 4 }, { a: 6, b: 2 }],
      winnerId: A_ID,
      retiredById: null,
      playedAt: PLAYED,
      enteredAt: PLAYED,
    });
    expect(r1.ok).toBe(true);

    const r2 = await createMatch({
      tournamentId: T_ID,
      type: "OFFICIAL",
      enteredByUserId: B_ID,
      opponentId: A_ID,
      outcome: "COMPLETED",
      sets: [{ a: 6, b: 4 }, { a: 6, b: 2 }],
      winnerId: B_ID,
      retiredById: null,
      playedAt: PLAYED,
      enteredAt: PLAYED,
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe("PAIRING_CONFLICT");
  });

  it("permits a FRIENDLY rematch for the same pair (partial index is OFFICIAL-only)", async () => {
    const r = await createMatch({
      tournamentId: T_ID,
      type: "FRIENDLY",
      enteredByUserId: A_ID,
      opponentId: B_ID,
      outcome: "COMPLETED",
      sets: [{ a: 6, b: 1 }, { a: 6, b: 1 }],
      winnerId: A_ID,
      retiredById: null,
      playedAt: PLAYED,
      enteredAt: PLAYED,
    });
    expect(r.ok).toBe(true);
  });
});

describe("Match DAL — IDOR (security.md DAL-2)", () => {
  it("approve refuses an actor who is not the counterparty", async () => {
    const created = await createMatch({
      tournamentId: T_ID,
      type: "FRIENDLY",
      enteredByUserId: A_ID,
      opponentId: C_ID,
      outcome: "COMPLETED",
      sets: [{ a: 6, b: 3 }, { a: 6, b: 3 }],
      winnerId: A_ID,
      retiredById: null,
      playedAt: PLAYED,
      enteredAt: PLAYED,
    });
    if (!created.ok) throw new Error("setup failed");

    const r = await approvePendingMatch({
      matchId: created.match.id,
      callerUserId: B_ID, // stranger
      nowIso: PLAYED,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("FORBIDDEN");

    const r2 = await approvePendingMatch({
      matchId: created.match.id,
      callerUserId: A_ID, // entrant trying to approve own match
      nowIso: PLAYED,
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe("FORBIDDEN");

    const r3 = await approvePendingMatch({
      matchId: created.match.id,
      callerUserId: C_ID, // legitimate counterparty
      nowIso: PLAYED,
    });
    expect(r3.ok).toBe(true);
  });
});
