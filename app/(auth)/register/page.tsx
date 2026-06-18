"use client";
import { useState } from "react";
import { apiPost } from "@/app/_lib/api";

type RegisterResponse = { ok?: boolean; error?: string };

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await apiPost<RegisterResponse>("/api/auth/register", {
      email,
      display_name: displayName,
      password,
    });
    setBusy(false);
    if (r.status >= 400) {
      setError(r.data.error ?? "Registration failed");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main className="mx-auto max-w-sm p-8">
        <h1 className="text-xl font-semibold">Registered</h1>
        <p className="mt-2 text-sm text-gray-600">If your registration is valid, you can now log in.</p>
        <a href="/login" className="mt-4 inline-block underline">Log in</a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-xl font-semibold">Register</h1>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (private)" className="w-full border p-2 rounded" />
        <input type="text" required minLength={2} maxLength={30} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name (public)" className="w-full border p-2 rounded" />
        <input type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 12 characters)" className="w-full border p-2 rounded" />
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <button type="submit" disabled={busy} className="w-full rounded bg-black text-white p-2">
          {busy ? "Registering…" : "Create account"}
        </button>
      </form>
    </main>
  );
}
