import "server-only";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { policy } from "@/server/config";
import { csrfMatches, CSRF_HEADER } from "./csrf";

// API-1/3/4/6: method allowlist, CSRF, body-size, generic JSON errors.
// HTML CSP/headers belong in middleware (#7); this is the API-side helper.
const apiHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Type": "application/json",
};

export function json<T>(body: T, init: ResponseInit = {}): NextResponse {
  return new NextResponse(JSON.stringify(body), {
    ...init,
    headers: { ...apiHeaders, ...(init.headers ?? {}) },
  });
}

export function errorJson(status: number, message: string): NextResponse {
  return json({ error: message }, { status });
}

export function methodNotAllowed(allowed: string[]): NextResponse {
  return json({ error: "Method Not Allowed" }, { status: 405, headers: { Allow: allowed.join(", ") } });
}

// Validates content-type + size and CSRF. Returns null on success, or a 4xx
// response to return immediately.
export async function guardMutation(req: NextRequest): Promise<NextResponse | null> {
  const ct = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!ct.startsWith("application/json")) {
    return errorJson(415, "Content-Type must be application/json");
  }
  const len = req.headers.get("content-length");
  if (len && Number(len) > policy.maxJsonBodyBytes) {
    return errorJson(413, "Request body too large");
  }
  const csrfCookie = req.cookies.get(policy.cookie.csrfName)?.value;
  const csrfHeader = req.headers.get(CSRF_HEADER);
  if (!csrfMatches(csrfCookie, csrfHeader)) {
    return errorJson(403, "CSRF token missing or invalid");
  }
  return null;
}

// Reads and length-caps the JSON body. Returns the parsed value on success or
// a 4xx response on failure.
export async function readJson<T>(req: NextRequest): Promise<{ body: T } | { res: NextResponse }> {
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { res: errorJson(400, "Could not read request body") };
  }
  if (Buffer.byteLength(raw, "utf8") > policy.maxJsonBodyBytes) {
    return { res: errorJson(413, "Request body too large") };
  }
  try {
    const body = JSON.parse(raw) as T;
    return { body };
  } catch {
    return { res: errorJson(400, "Invalid JSON") };
  }
}
