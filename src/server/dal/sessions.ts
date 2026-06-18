import "server-only";
import { prisma } from "./prisma";
import { newOpaqueId } from "@/server/security/random";
import { policy } from "@/server/config";

export type SessionRecord = {
  id: string;
  userId: string;
  role: "PLAYER" | "ADMIN";
  createdAtMs: number;
  expiresAtMs: number;
  lastSeenAtMs: number;
  mfaVerifiedAtMs: number | null;
};

function rolePolicy(role: "PLAYER" | "ADMIN"): { idleMs: number; absoluteMs: number } {
  return role === "ADMIN" ? policy.session.admin : policy.session.player;
}

export async function createSession(
  userId: string,
  role: "PLAYER" | "ADMIN",
  now: number = Date.now(),
  meta: { userAgent?: string; ip?: string } = {},
): Promise<SessionRecord> {
  const { absoluteMs } = rolePolicy(role);
  const id = newOpaqueId(32);
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + absoluteMs).toISOString();
  await prisma.session.create({
    data: {
      id,
      user_id: userId,
      created_at: createdAt,
      expires_at: expiresAt,
      last_seen_at: createdAt,
      ...(meta.userAgent !== undefined ? { user_agent: meta.userAgent } : {}),
      ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
    },
  });
  return {
    id,
    userId,
    role,
    createdAtMs: now,
    expiresAtMs: now + absoluteMs,
    lastSeenAtMs: now,
    mfaVerifiedAtMs: null,
  };
}

// Looks up by cookie id, applies idle + absolute timeouts, returns null and
// deletes the row when expired. On success, updates last_seen_at (idle touch).
export async function findActiveSession(id: string, now: number = Date.now()): Promise<SessionRecord | null> {
  const row = await prisma.session.findUnique({
    where: { id },
    select: {
      id: true,
      user_id: true,
      created_at: true,
      expires_at: true,
      last_seen_at: true,
      mfa_verified_at: true,
      user: { select: { role: true, status: true } },
    },
  });
  if (!row) return null;
  if (row.user.status !== "ACTIVE") {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  const role = row.user.role as "PLAYER" | "ADMIN";
  const absoluteMs = new Date(row.expires_at).getTime();
  if (absoluteMs <= now) {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  const lastSeen = new Date(row.last_seen_at).getTime();
  const { idleMs } = rolePolicy(role);
  if (now - lastSeen > idleMs) {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  await prisma.session.update({
    where: { id },
    data: { last_seen_at: new Date(now).toISOString() },
  });
  return {
    id: row.id,
    userId: row.user_id,
    role,
    createdAtMs: new Date(row.created_at).getTime(),
    expiresAtMs: absoluteMs,
    lastSeenAtMs: now,
    mfaVerifiedAtMs: row.mfa_verified_at ? new Date(row.mfa_verified_at).getTime() : null,
  };
}

export async function deleteSession(id: string): Promise<void> {
  await prisma.session.delete({ where: { id } }).catch(() => {});
}

// Rotate on privilege change (SESS-3). Delete old; create a fresh id.
export async function rotateSession(
  oldId: string,
  userId: string,
  role: "PLAYER" | "ADMIN",
  now: number = Date.now(),
  meta: { userAgent?: string; ip?: string } = {},
): Promise<SessionRecord> {
  await deleteSession(oldId);
  return createSession(userId, role, now, meta);
}

export async function markMfaVerified(id: string, now: number = Date.now()): Promise<void> {
  await prisma.session.update({
    where: { id },
    data: { mfa_verified_at: new Date(now).toISOString() },
  });
}
