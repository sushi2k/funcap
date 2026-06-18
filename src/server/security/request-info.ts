import "server-only";
import type { NextRequest } from "next/server";

export function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

export function userAgent(req: NextRequest): string | null {
  return req.headers.get("user-agent");
}
