import "server-only";
import { changePassword as dalChangePassword, getMe as dalGetMe } from "@/server/dal/users";
import { checkPasswordPolicy } from "@/server/auth/password";
import type { MeDTO } from "@/shared/dto/me";

export async function getMe(userId: string): Promise<MeDTO | null> {
  return dalGetMe(userId);
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: "POLICY"; message: string }
  | { ok: false; reason: "WRONG_CURRENT" };

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const pc = checkPasswordPolicy(newPassword);
  if (!pc.ok) return { ok: false, reason: "POLICY", message: pc.reason };
  const r = await dalChangePassword(userId, currentPassword, newPassword);
  return r.ok ? { ok: true } : { ok: false, reason: "WRONG_CURRENT" };
}
