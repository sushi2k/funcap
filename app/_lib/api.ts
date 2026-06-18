"use client";

// Reads the double-submit CSRF cookie and posts JSON to the API.
function csrfCookie(): string {
  const m = document.cookie.match(/(?:^|;\s*)funcap_csrf=([^;]+)/);
  return m?.[1] ?? "";
}

export async function apiPost<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfCookie(),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);
  return { status: res.status, data };
}

export async function apiPatch<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(path, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfCookie(),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);
  return { status: res.status, data };
}

export async function apiGet<T>(path: string): Promise<{ status: number; data: T }> {
  const res = await fetch(path, { method: "GET", credentials: "same-origin" });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);
  return { status: res.status, data };
}

export async function apiDelete<T>(path: string): Promise<{ status: number; data: T }> {
  const res = await fetch(path, {
    method: "DELETE",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfCookie(),
    },
    // Some servers reject DELETE without a body. Our guardMutation requires
    // application/json content-type but doesn't require a non-empty body.
    body: "{}",
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);
  return { status: res.status, data };
}
