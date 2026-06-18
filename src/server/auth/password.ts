import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { policy } from "@/server/config";
import { isBreachedPassword } from "./breached-passwords";

// security.md AUTH-1 / AUTH-2 / SEC-4.
// `Algorithm` from @node-rs/argon2 is a const enum (`Argon2id = 2`); we use
// the numeric literal because tsconfig has `isolatedModules: true`.
const ARGON2ID = 2 as const;
const argonOpts = {
  algorithm: ARGON2ID,
  memoryCost: policy.argon2.memoryCostKiB,
  timeCost: policy.argon2.timeCost,
  parallelism: policy.argon2.parallelism,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, argonOpts);
}

export async function verifyPassword(stored: string, given: string): Promise<boolean> {
  try {
    return await verify(stored, given);
  } catch {
    return false;
  }
}

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

// Server-side policy check; client validation is UX only (security.md IN-1).
export function checkPasswordPolicy(password: string): PasswordCheck {
  if (typeof password !== "string") return { ok: false, reason: "Password is required." };
  if (password.length < 12) return { ok: false, reason: "Password must be at least 12 characters." };
  if (password.length > 256) return { ok: false, reason: "Password is too long." };
  if (isBreachedPassword(password)) {
    return { ok: false, reason: "This password appears in known breach lists. Choose a different one." };
  }
  return { ok: true };
}
