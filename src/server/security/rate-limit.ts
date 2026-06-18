import "server-only";

// In-memory sliding-window limiter. Per req §18.11 this is acceptable for the
// local/offline single-instance v1; multi-instance triggers a swap to shared
// storage (security.md §7).
type Hits = number[];
const store = new Map<string, Hits>();

export type RateLimitResult = { ok: true; remaining: number } | { ok: false; retryAfterMs: number };

export function takeToken(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const cutoff = now - windowMs;
  const existing = store.get(key);
  const fresh: Hits = (existing ?? []).filter((t) => t > cutoff);
  if (fresh.length >= limit) {
    const oldest = fresh[0] ?? now;
    return { ok: false, retryAfterMs: Math.max(0, oldest + windowMs - now) };
  }
  fresh.push(now);
  store.set(key, fresh);
  return { ok: true, remaining: Math.max(0, limit - fresh.length) };
}

// Test-only helper.
export function _resetRateLimitStore(): void {
  store.clear();
}
