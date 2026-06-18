"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/app/_lib/api";
import type { MeDTO } from "@/shared/dto/me";

type MeResponse = { me?: MeDTO; error?: string };
type MfaSetup = { ok?: boolean; secret?: string; uri?: string; qr_data_url?: string; error?: string };

export default function ProfilePage() {
  const [me, setMe] = useState<MeDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
  const [activateCode, setActivateCode] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    (async () => {
      const r = await apiGet<MeResponse>("/api/me");
      setMe(r.data.me ?? null);
      setLoading(false);
    })();
  }, []);

  async function startMfa() {
    const r = await apiPost<MfaSetup>("/api/auth/mfa/setup", {});
    setMfaSetup(r.data);
  }

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    const r = await apiPost<{ ok?: boolean; error?: string }>("/api/auth/mfa/activate", { code: activateCode });
    if (r.status >= 400) {
      setMfaSetup({ ...(mfaSetup ?? {}), error: r.data.error ?? "Activation failed" });
      return;
    }
    setMfaSetup(null);
    setActivateCode("");
    const me2 = await apiGet<MeResponse>("/api/me");
    setMe(me2.data.me ?? null);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwDone(false);
    const r = await apiPatch<{ ok?: boolean; error?: string }>("/api/me", {
      current_password: currentPw,
      new_password: newPw,
    });
    if (r.status >= 400) {
      setPwError(r.data.error ?? "Could not change password");
      return;
    }
    setPwDone(true);
    setCurrentPw("");
    setNewPw("");
  }

  async function logout() {
    await apiPost("/api/auth/logout", {});
    window.location.href = "/login";
  }

  if (loading) return <main className="p-8">Loading…</main>;
  if (!me) {
    return (
      <main className="p-8">
        <p>You are not logged in. <a href="/login" className="underline">Log in</a>.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl p-8 space-y-8">
      <header>
        <h1 className="text-xl font-semibold">{me.display_name}</h1>
        <p className="text-sm text-gray-600">{me.email} — {me.role}</p>
        <button onClick={logout} className="mt-2 text-sm underline">Log out</button>
      </header>

      <section>
        <h2 className="font-semibold">Two-factor auth</h2>
        {me.mfa_enabled ? (
          <p className="text-sm text-green-700">MFA is enabled.</p>
        ) : mfaSetup ? (
          <div className="space-y-3">
            <p className="text-sm">Scan the QR with your authenticator, or use the secret:</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, no next/image needed */}
            {mfaSetup.qr_data_url ? <img src={mfaSetup.qr_data_url} alt="TOTP QR" className="w-40 h-40 border" /> : null}
            <code className="block break-all text-xs bg-gray-100 p-2 rounded">{mfaSetup.secret}</code>
            <form onSubmit={activate} className="flex gap-2">
              <input
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                placeholder="123456"
                value={activateCode}
                onChange={(e) => setActivateCode(e.target.value.replace(/\D/g, ""))}
                className="border p-2 rounded w-32 text-center tracking-widest"
              />
              <button type="submit" className="bg-black text-white px-3 rounded">Activate</button>
            </form>
            {mfaSetup.error ? <div className="text-sm text-red-600">{mfaSetup.error}</div> : null}
          </div>
        ) : (
          <button onClick={startMfa} className="text-sm underline">Set up MFA</button>
        )}
      </section>

      <section>
        <h2 className="font-semibold">Change password</h2>
        <form onSubmit={changePassword} className="mt-2 space-y-2">
          <input type="password" required value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Current password" className="w-full border p-2 rounded" />
          <input type="password" required minLength={12} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password (min 12)" className="w-full border p-2 rounded" />
          {pwError ? <div className="text-sm text-red-600">{pwError}</div> : null}
          {pwDone ? <div className="text-sm text-green-700">Password updated.</div> : null}
          <button type="submit" className="bg-black text-white px-3 py-2 rounded">Change password</button>
        </form>
      </section>
    </main>
  );
}
