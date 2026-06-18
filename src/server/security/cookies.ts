import "server-only";
import { policy } from "@/server/config";

// Central cookie config (security.md SESS-2). Anything that sets the session
// cookie goes through here so HttpOnly/Secure/SameSite/Path stay correct.
export type CookieOpts = {
  httpOnly?: boolean;
  maxAgeSeconds?: number;
  expires?: Date;
};

export function buildSetCookie(name: string, value: string, opts: CookieOpts = {}): string {
  const { httpOnly = true, maxAgeSeconds, expires } = opts;
  const parts: string[] = [`${name}=${value}`, `Path=${policy.cookie.path}`, `SameSite=Lax`];
  if (httpOnly) parts.push("HttpOnly");
  if (policy.cookie.secure) parts.push("Secure");
  if (typeof maxAgeSeconds === "number") parts.push(`Max-Age=${maxAgeSeconds}`);
  if (expires) parts.push(`Expires=${expires.toUTCString()}`);
  return parts.join("; ");
}

export function clearCookie(name: string): string {
  return buildSetCookie(name, "", { maxAgeSeconds: 0 });
}
