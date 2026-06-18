"use client";
import { useState } from "react";
import { apiPost } from "@/app/_lib/api";

type LoginResponse = { ok?: boolean; mfa_required?: boolean; error?: string };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await apiPost<LoginResponse>("/api/auth/login", { email, password });
    setBusy(false);
    if (r.status >= 400) {
      setError(r.data.error ?? "Login failed");
      return;
    }
    window.location.href = r.data.mfa_required ? "/mfa" : "/profile";
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-xl font-semibold">Log in</h1>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full border p-2 rounded"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full border p-2 rounded"
        />
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <button type="submit" disabled={busy} className="w-full rounded bg-black text-white p-2">
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        No account? <a href="/register" className="underline">Register</a>.
      </p>
    </main>
  );
}
