import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import {
  encryptSecret,
  decryptSecret,
  generateTotpSecret,
  verifyTotpCode,
  buildOtpAuthUri,
} from "@/server/auth/totp";
import { policy } from "@/server/config";
import type { PublicUserDTO } from "@/shared/dto/user";
import type { MeDTO } from "@/shared/dto/me";

// Shapes
export type CreateUserInput = {
  email: string;
  display_name: string;
  password: string;
  role: "PLAYER" | "ADMIN";
};

export type LoginCheckResult =
  | { ok: true; userId: string; role: "PLAYER" | "ADMIN"; mfaEnabled: boolean; mustChangePassword: boolean }
  | { ok: false; reason: "INVALID" | "LOCKED" | "INACTIVE"; lockedUntilMs?: number };

const userToMe = (u: {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  self_level: number | null;
  mfa_enabled: boolean;
  must_change_password: boolean;
}): MeDTO => ({
  id: u.id,
  email: u.email,
  display_name: u.display_name,
  role: u.role as "PLAYER" | "ADMIN",
  status: u.status as "ACTIVE" | "LEFT",
  self_level: u.self_level,
  mfa_enabled: u.mfa_enabled,
  must_change_password: u.must_change_password,
});

// ---------- Public read (existing) ----------
export async function findPublicUserByDisplayName(display_name: string): Promise<PublicUserDTO | null> {
  const row = await prisma.user.findUnique({
    where: { display_name },
    select: { id: true, display_name: true, self_level: true },
  });
  if (!row) return null;
  return { id: row.id, display_name: row.display_name, self_level: row.self_level ?? null };
}

// ---------- Existence checks (for register pre-flight) ----------
export async function existsByEmail(email: string): Promise<boolean> {
  return (await prisma.user.count({ where: { email } })) > 0;
}

export async function existsByDisplayName(display_name: string): Promise<boolean> {
  return (await prisma.user.count({ where: { display_name } })) > 0;
}

// ---------- Create ----------
export async function createUser(input: CreateUserInput): Promise<MeDTO> {
  const password_hash = await hashPassword(input.password);
  const nowIso = new Date().toISOString();
  // Admins must have MFA per AUTH-3, but enrollment happens after creation;
  // mfa_enabled stays false here. Promotion to admin without MFA is gated in
  // services/route handlers (issue #6).
  const row = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: input.email,
      display_name: input.display_name,
      password_hash,
      role: input.role,
      status: "ACTIVE",
      mfa_enabled: false,
      created_at: nowIso,
      updated_at: nowIso,
    },
    select: {
      id: true,
      email: true,
      display_name: true,
      role: true,
      status: true,
      self_level: true,
      mfa_enabled: true,
      must_change_password: true,
    },
  });
  return userToMe(row);
}

// ---------- Auth: password check + lockout bookkeeping ----------
// The plaintext password and password_hash never leave this function.
export async function verifyCredentialsByEmail(
  email: string,
  password: string,
  now: number = Date.now(),
): Promise<LoginCheckResult> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      password_hash: true,
      role: true,
      status: true,
      mfa_enabled: true,
      must_change_password: true,
      failed_login_count: true,
      locked_until: true,
    },
  });
  if (!user) {
    return { ok: false, reason: "INVALID" };
  }
  if (user.status !== "ACTIVE") {
    return { ok: false, reason: "INACTIVE" };
  }
  if (user.locked_until) {
    const untilMs = new Date(user.locked_until).getTime();
    if (untilMs > now) {
      return { ok: false, reason: "LOCKED", lockedUntilMs: untilMs };
    }
  }

  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) {
    await registerFailedLogin(user.id, user.failed_login_count + 1, now);
    return { ok: false, reason: "INVALID" };
  }

  if (user.failed_login_count > 0 || user.locked_until) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failed_login_count: 0, locked_until: null },
    });
  }

  return {
    ok: true,
    userId: user.id,
    role: user.role as "PLAYER" | "ADMIN",
    mfaEnabled: user.mfa_enabled,
    mustChangePassword: user.must_change_password,
  };
}

async function registerFailedLogin(userId: string, nextCount: number, now: number): Promise<void> {
  const { threshold, lockMs } = policy.rateLimit.loginLockout;
  if (nextCount >= threshold) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        failed_login_count: 0,
        locked_until: new Date(now + lockMs).toISOString(),
      },
    });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { failed_login_count: nextCount },
    });
  }
}

// ---------- /me read ----------
export async function getMe(userId: string): Promise<MeDTO | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      display_name: true,
      role: true,
      status: true,
      self_level: true,
      mfa_enabled: true,
      must_change_password: true,
    },
  });
  if (!row) return null;
  return userToMe(row);
}

export async function getRoleAndStatus(
  userId: string,
): Promise<{ role: "PLAYER" | "ADMIN"; status: "ACTIVE" | "LEFT"; mfaEnabled: boolean } | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true, mfa_enabled: true },
  });
  if (!row) return null;
  return {
    role: row.role as "PLAYER" | "ADMIN",
    status: row.status as "ACTIVE" | "LEFT",
    mfaEnabled: row.mfa_enabled,
  };
}

// ---------- Password change ----------
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; reason: "WRONG_CURRENT" }> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { password_hash: true },
  });
  if (!row) return { ok: false, reason: "WRONG_CURRENT" };
  if (!(await verifyPassword(row.password_hash, currentPassword))) {
    return { ok: false, reason: "WRONG_CURRENT" };
  }
  const next = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password_hash: next, must_change_password: false, updated_at: new Date().toISOString() },
  });
  return { ok: true };
}

// ---------- TOTP ----------
// Returns the secret and the otpauth URI to display to the user. The secret is
// also stored encrypted on the user row so /mfa/activate can verify the first
// code; once activated, mfa_enabled flips to true.
export async function beginMfaEnrolment(
  userId: string,
  accountLabel: string,
): Promise<{ secret: string; uri: string }> {
  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { totp_secret: encryptSecret(secret), mfa_enabled: false },
  });
  return { secret, uri: buildOtpAuthUri(secret, accountLabel) };
}

export async function activateMfaIfCodeValid(userId: string, code: string): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { totp_secret: true },
  });
  if (!row?.totp_secret) return false;
  const secret = decryptSecret(row.totp_secret);
  if (!verifyTotpCode(secret, code)) return false;
  await prisma.user.update({
    where: { id: userId },
    data: { mfa_enabled: true, updated_at: new Date().toISOString() },
  });
  return true;
}

export async function verifyMfaCodeForUser(userId: string, code: string): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { totp_secret: true, mfa_enabled: true },
  });
  if (!row?.totp_secret || !row.mfa_enabled) return false;
  const secret = decryptSecret(row.totp_secret);
  return verifyTotpCode(secret, code);
}
