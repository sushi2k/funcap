import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Edge-compatible CSRF token generator (Web Crypto only — no node:crypto so
// middleware stays on the default Edge runtime).
function newCsrfToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i] as number);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const CSRF_COOKIE = "funcap_csrf";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Issue the double-submit CSRF cookie on first visit. JS-readable so the
  // client can echo it in X-CSRF-Token (security.md API-3).
  if (!req.cookies.get(CSRF_COOKIE)) {
    res.cookies.set({
      name: CSRF_COOKIE,
      value: newCsrfToken(),
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      // Cookie .secure cannot read process.env here in a typed way, so we
      // approximate via request URL; setting Secure unconditionally on https.
      secure: req.nextUrl.protocol === "https:",
    });
  }

  // Always-on response headers (issue #7 will add a full CSP w/ per-request nonce).
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
