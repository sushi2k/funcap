"use client";
import { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost } from "@/app/_lib/api";
import type { MyMatchDTO, SuggestionDTO } from "@/shared/dto/match";

type MatchesResp = { matches?: MyMatchDTO[]; error?: string };
type SuggestionsResp = { suggestions?: SuggestionDTO[]; error?: string };

export default function MatchesPage() {
  const [matches, setMatches] = useState<MyMatchDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  async function refresh() {
    const r = await apiGet<MatchesResp>("/api/matches");
    if (r.status === 401) {
      setNotLoggedIn(true);
      setLoading(false);
      return;
    }
    setMatches(r.data.matches ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  if (loading) return <main className="p-8">Loading…</main>;
  if (notLoggedIn) {
    return (
      <main className="p-8">
        <p>You are not logged in. <a href="/login" className="underline">Log in</a>.</p>
      </main>
    );
  }

  const needsApproval = matches.filter((m) => m.needs_my_approval);
  const myPending = matches.filter((m) => m.entered_by_me && m.state === "PENDING");
  const recent = matches.filter((m) => m.state !== "PENDING").slice(0, 10);

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Matches</h1>
        <a href="/scoreboard" className="text-sm underline">Scoreboard</a>
      </header>

      <NewMatchForm onSubmitted={refresh} />

      <Section title="Awaiting your approval" empty="Nothing waiting for you.">
        {needsApproval.map((m) => (
          <ApprovalCard key={m.id} m={m} onChanged={refresh} />
        ))}
      </Section>

      <Section title="Your pending entries" empty="No pending entries.">
        {myPending.map((m) => (
          <PendingEntryCard key={m.id} m={m} onChanged={refresh} />
        ))}
      </Section>

      <Section title="Recent" empty="No recent matches.">
        {recent.map((m) => (
          <RecentRow key={m.id} m={m} />
        ))}
      </Section>
    </main>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  const has = arr.filter(Boolean).length > 0;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      {has ? <div className="space-y-2">{children}</div> : <p className="text-sm text-gray-600">{empty}</p>}
    </section>
  );
}

function formatSets(m: MyMatchDTO): string {
  if (m.sets.length === 0) return m.outcome === "WALKOVER" ? "Walkover" : "—";
  return m.sets
    .map((s) => {
      const base = `${s.a}-${s.b}`;
      if (s.tb_a != null || s.tb_b != null) return `${base}(${s.tb_a ?? 0}-${s.tb_b ?? 0})`;
      return base;
    })
    .join(", ");
}

function ApprovalCard({ m, onChanged }: { m: MyMatchDTO; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    const r = await apiPost<{ ok?: boolean; error?: string }>(`/api/matches/${m.id}/approve`, {});
    setBusy(false);
    if (r.status >= 400) {
      setError(r.data.error ?? "Could not approve");
      return;
    }
    onChanged();
  }

  async function reject() {
    setBusy(true);
    setError(null);
    const r = await apiPost<{ ok?: boolean; error?: string }>(`/api/matches/${m.id}/reject`, { reason });
    setBusy(false);
    if (r.status >= 400) {
      setError(r.data.error ?? "Could not reject");
      return;
    }
    onChanged();
  }

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex justify-between text-sm">
        <span>
          <b>{m.opponent_display_name}</b> entered: <b>{formatSets(m)}</b>
          {m.winner_id ? <> · Winner: <b>{m.winner_id === m.opponent_id ? m.opponent_display_name : "you"}</b></> : null}
        </span>
        <span className="text-xs text-gray-500">{new Date(m.played_at).toLocaleDateString()}</span>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {showReject ? (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejecting (required)"
            className="w-full border rounded p-2 text-sm"
            rows={2}
            maxLength={500}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reject}
              disabled={busy || reason.trim().length === 0}
              className="rounded bg-red-600 text-white text-sm px-3 py-1 disabled:opacity-50"
            >
              Confirm reject
            </button>
            <button type="button" onClick={() => setShowReject(false)} disabled={busy} className="text-sm underline">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={approve}
            disabled={busy}
            className="rounded bg-black text-white text-sm px-3 py-1 disabled:opacity-50"
          >
            {busy ? "…" : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => setShowReject(true)}
            disabled={busy}
            className="rounded border text-sm px-3 py-1"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function PendingEntryCard({ m, onChanged }: { m: MyMatchDTO; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    if (!confirm("Withdraw this pending match?")) return;
    setBusy(true);
    setError(null);
    const r = await apiDelete<{ ok?: boolean; error?: string }>(`/api/matches/${m.id}`);
    setBusy(false);
    if (r.status >= 400) {
      setError(r.data.error ?? "Could not withdraw");
      return;
    }
    onChanged();
  }

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex justify-between text-sm">
        <span>
          vs <b>{m.opponent_display_name}</b> · {formatSets(m)}
          {" · "}
          <span className="text-xs text-gray-600">{m.type}</span>
        </span>
        <span className="text-xs text-gray-500">{new Date(m.played_at).toLocaleDateString()}</span>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="button"
        onClick={withdraw}
        disabled={busy}
        className="rounded border text-sm px-3 py-1"
      >
        Withdraw
      </button>
    </div>
  );
}

function RecentRow({ m }: { m: MyMatchDTO }) {
  const stateBadge =
    m.state === "CONFIRMED" ? "bg-green-100 text-green-800"
    : m.state === "DISPUTED" ? "bg-amber-100 text-amber-800"
    : m.state === "VOIDED" ? "bg-gray-200 text-gray-700"
    : "bg-gray-100 text-gray-700";
  return (
    <div className="border rounded p-3 text-sm flex justify-between items-center">
      <span>
        vs <b>{m.opponent_display_name}</b> · {formatSets(m)}
      </span>
      <span className={`text-xs px-2 py-1 rounded ${stateBadge}`}>{m.state}</span>
    </div>
  );
}

// ---------- New match form ----------

type Outcome = "COMPLETED" | "RETIRED" | "WALKOVER";

function NewMatchForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [suggestions, setSuggestions] = useState<SuggestionDTO[]>([]);
  const [type, setType] = useState<"OFFICIAL" | "FRIENDLY">("OFFICIAL");
  const [opponentId, setOpponentId] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("COMPLETED");
  const [playedAt, setPlayedAt] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [sets, setSets] = useState<{ a: string; b: string; tb_a: string; tb_b: string }[]>([
    { a: "", b: "", tb_a: "", tb_b: "" },
    { a: "", b: "", tb_a: "", tb_b: "" },
  ]);
  const [retiredBy, setRetiredBy] = useState<"me" | "opponent">("opponent");
  const [walkoverWinner, setWalkoverWinner] = useState<"me" | "opponent">("me");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await apiGet<SuggestionsResp>(`/api/matchmaking/suggestions?type=${type}`);
      setSuggestions(r.data.suggestions ?? []);
      const me = await apiGet<{ me?: { id?: string } }>("/api/me");
      if (me.data.me?.id) setMyUserId(me.data.me.id);
    })();
  }, [type]);

  const selectedOpponent = useMemo(
    () => suggestions.find((s) => s.id === opponentId),
    [suggestions, opponentId],
  );

  function addSet() {
    if (sets.length >= 3) return;
    setSets([...sets, { a: "", b: "", tb_a: "", tb_b: "" }]);
  }
  function removeSet(i: number) {
    if (sets.length <= 1) return;
    setSets(sets.filter((_, idx) => idx !== i));
  }
  function updateSet(i: number, key: "a" | "b" | "tb_a" | "tb_b", value: string) {
    setSets(sets.map((s, idx) => (idx === i ? { ...s, [key]: value.replace(/[^0-9]/g, "") } : s)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!opponentId) {
      setError("Pick an opponent");
      return;
    }
    const cleanSets =
      outcome === "WALKOVER"
        ? []
        : sets.map((s) => {
            const out: { a: number; b: number; tb_a?: number; tb_b?: number } = {
              a: Number(s.a),
              b: Number(s.b),
            };
            if (s.tb_a !== "") out.tb_a = Number(s.tb_a);
            if (s.tb_b !== "") out.tb_b = Number(s.tb_b);
            return out;
          });
    const playedAtIso = new Date(playedAt).toISOString();
    const body: Record<string, unknown> = {
      opponent_id: opponentId,
      type,
      outcome,
      played_at: playedAtIso,
      sets: cleanSets,
    };
    if (outcome === "RETIRED") {
      body.retired_by_id = retiredBy === "me" ? myUserId : opponentId;
    }
    if (outcome === "WALKOVER") {
      body.walkover_winner_id = walkoverWinner === "me" ? myUserId : opponentId;
    }

    setBusy(true);
    const r = await apiPost<{ match?: unknown; error?: string }>("/api/matches", body);
    setBusy(false);
    if (r.status >= 400) {
      setError(r.data.error ?? "Could not enter match");
      return;
    }
    setOpponentId("");
    setSets([
      { a: "", b: "", tb_a: "", tb_b: "" },
      { a: "", b: "", tb_a: "", tb_b: "" },
    ]);
    setOutcome("COMPLETED");
    onSubmitted();
  }

  return (
    <section className="border rounded p-4 space-y-3">
      <h2 className="font-semibold">Enter a match</h2>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-gray-600">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as "OFFICIAL" | "FRIENDLY")} className="w-full border rounded p-2 text-sm">
              <option value="OFFICIAL">Official</option>
              <option value="FRIENDLY">Friendly</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">Opponent</span>
            <select value={opponentId} onChange={(e) => setOpponentId(e.target.value)} className="w-full border rounded p-2 text-sm">
              <option value="">Choose…</option>
              {suggestions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                  {s.self_level != null ? ` · L${s.self_level}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-gray-600">Outcome</span>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)} className="w-full border rounded p-2 text-sm">
              <option value="COMPLETED">Completed</option>
              <option value="RETIRED">Retired</option>
              <option value="WALKOVER">Walkover</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">Played at</span>
            <input
              type="datetime-local"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              className="w-full border rounded p-2 text-sm"
            />
          </label>
        </div>

        {outcome === "RETIRED" ? (
          <label className="block">
            <span className="text-xs text-gray-600">Who retired?</span>
            <select value={retiredBy} onChange={(e) => setRetiredBy(e.target.value as "me" | "opponent")} className="w-full border rounded p-2 text-sm">
              <option value="opponent">{selectedOpponent?.display_name ?? "Opponent"}</option>
              <option value="me">Me</option>
            </select>
          </label>
        ) : null}

        {outcome === "WALKOVER" ? (
          <label className="block">
            <span className="text-xs text-gray-600">Walkover winner</span>
            <select value={walkoverWinner} onChange={(e) => setWalkoverWinner(e.target.value as "me" | "opponent")} className="w-full border rounded p-2 text-sm">
              <option value="me">Me</option>
              <option value="opponent">{selectedOpponent?.display_name ?? "Opponent"}</option>
            </select>
          </label>
        ) : null}

        {outcome !== "WALKOVER" ? (
          <fieldset className="space-y-2">
            <legend className="text-xs text-gray-600">Sets (you–opponent)</legend>
            {sets.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-xs w-12 text-gray-500">Set {i + 1}</span>
                <input
                  inputMode="numeric"
                  pattern="\d*"
                  value={s.a}
                  onChange={(e) => updateSet(i, "a", e.target.value)}
                  className="border rounded p-2 w-14 text-center"
                  placeholder="6"
                />
                <span>-</span>
                <input
                  inputMode="numeric"
                  pattern="\d*"
                  value={s.b}
                  onChange={(e) => updateSet(i, "b", e.target.value)}
                  className="border rounded p-2 w-14 text-center"
                  placeholder="4"
                />
                <span className="text-xs text-gray-500 ml-2">TB</span>
                <input
                  inputMode="numeric"
                  pattern="\d*"
                  value={s.tb_a}
                  onChange={(e) => updateSet(i, "tb_a", e.target.value)}
                  className="border rounded p-2 w-12 text-center"
                  placeholder=""
                />
                <span>-</span>
                <input
                  inputMode="numeric"
                  pattern="\d*"
                  value={s.tb_b}
                  onChange={(e) => updateSet(i, "tb_b", e.target.value)}
                  className="border rounded p-2 w-12 text-center"
                  placeholder=""
                />
                {sets.length > 1 ? (
                  <button type="button" onClick={() => removeSet(i)} className="text-xs text-gray-500 underline ml-2">
                    remove
                  </button>
                ) : null}
              </div>
            ))}
            {sets.length < 3 ? (
              <button type="button" onClick={addSet} className="text-xs underline">
                + add set
              </button>
            ) : null}
          </fieldset>
        ) : null}

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <button type="submit" disabled={busy} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
          {busy ? "Submitting…" : "Submit"}
        </button>
      </form>
    </section>
  );
}
