"use client";
import { useState } from "react";
import { apiPost } from "@/app/_lib/api";

type MfaResponse = { ok?: boolean; error?: string };

export default function MfaPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await apiPost<MfaResponse>("/api/auth/mfa/verify", { code });
    setBusy(false);
    if (r.status >= 400) {
      setError(r.data.error ?? "Verification failed");
      return;
    }
    window.location.href = "/profile";
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-xl font-semibold">Two-factor code</h1>
      <p className="mt-2 text-sm text-gray-600">Enter the 6-digit code from your authenticator.</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className="w-full border p-2 rounded text-center text-lg tracking-widest"
        />
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <button type="submit" disabled={busy} className="w-full rounded bg-black text-white p-2">
          {busy ? "Verifying…" : "Verify"}
        </button>
      </form>
    </main>
  );
}
