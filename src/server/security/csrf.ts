import "server-only";
import { newOpaqueId, constantTimeEqualString } from "./random";

// Double-submit CSRF (security.md API-3). The cookie is readable by JS; the
// client echoes its value in X-CSRF-Token. SameSite=Lax keeps it scoped.
export const CSRF_HEADER = "x-csrf-token";

export function newCsrfToken(): string {
  return newOpaqueId(24);
}

export function csrfMatches(cookieValue: string | undefined, headerValue: string | null | undefined): boolean {
  if (!cookieValue || !headerValue) return false;
  return constantTimeEqualString(cookieValue, headerValue);
}
