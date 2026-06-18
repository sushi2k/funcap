import "server-only";
import { policy } from "@/server/config";

export type StepUpInput = { mfa_verified_at: string | null };

// security.md AUTH-4: sensitive admin actions need a recent MFA verification.
// Used by issue #6 (admin amend/void/etc) — exported here so the contract is
// established before any privileged route exists.
export function isStepUpFresh(s: StepUpInput, now: number = Date.now()): boolean {
  if (!s.mfa_verified_at) return false;
  const verifiedMs = new Date(s.mfa_verified_at).getTime();
  if (Number.isNaN(verifiedMs)) return false;
  return now - verifiedMs <= policy.stepUpWindowMs;
}
