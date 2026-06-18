import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";

// 32 bytes ~ 256 bits of entropy, base64url (~43 chars).
export function newOpaqueId(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function constantTimeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
