import { getCareerScoreboard, getSeasonScoreboard } from "@/application/scoreboard";

// Server Component, public (guest) — reads the DAL → domain directly. DTOs
// only; no PII in props or render. req §10.
type SearchParams = Promise<{ view?: string }>;

export default async function ScoreboardPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const view = sp.view === "career" ? "career" : "season";

  if (view === "season") {
    const board = await getSeasonScoreboard();
    return (
      <main className="mx-auto max-w-4xl p-8 space-y-4">
        <Tabs current={view} />
        <h1 className="text-xl font-semibold">
          {board.tournament_name ? `Season — ${board.tournament_name}` : "Season"}
        </h1>
        {!board.tournament_id ? (
          <p className="text-sm text-gray-600">No tournament is currently in season.</p>
        ) : board.rows.length === 0 ? (
          <p className="text-sm text-gray-600">No confirmed matches yet.</p>
        ) : (
          <table className="w-full text-sm border rounded">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2 w-12">#</th>
                <th className="p-2">Player</th>
                <th className="p-2 w-16">W</th>
                <th className="p-2 w-16">L</th>
                <th className="p-2 w-20">Sets</th>
                <th className="p-2 w-24">Games</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {board.rows.map((r) => (
                <tr key={r.user_id}>
                  <td className="p-2 text-gray-500">{r.rank}</td>
                  <td className="p-2 font-medium">{r.display_name}</td>
                  <td className="p-2">{r.wins}</td>
                  <td className="p-2">{r.losses}</td>
                  <td className="p-2">{r.sets_for}-{r.sets_against}</td>
                  <td className="p-2">{r.games_for}-{r.games_against}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    );
  }

  const board = await getCareerScoreboard();
  return (
    <main className="mx-auto max-w-4xl p-8 space-y-4">
      <Tabs current={view} />
      <h1 className="text-xl font-semibold">Career</h1>
      <p className="text-xs text-gray-600">
        Ranked players have at least {board.threshold} career matches.
      </p>
      {board.ranked.length === 0 ? (
        <p className="text-sm text-gray-600">No qualifying players yet.</p>
      ) : (
        <table className="w-full text-sm border rounded">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2 w-12">#</th>
              <th className="p-2">Player</th>
              <th className="p-2 w-20">W-L</th>
              <th className="p-2 w-20">Played</th>
              <th className="p-2 w-20">Win %</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {board.ranked.map((r) => (
              <tr key={r.user_id}>
                <td className="p-2 text-gray-500">{r.rank}</td>
                <td className="p-2 font-medium">{r.display_name}</td>
                <td className="p-2">{r.wins}-{r.losses}</td>
                <td className="p-2">{r.played}</td>
                <td className="p-2">{(r.win_pct * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {board.unranked.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Unranked (below threshold)</h2>
          <ul className="text-sm border rounded divide-y">
            {board.unranked.map((r) => (
              <li key={r.user_id} className="p-2 flex justify-between">
                <span>{r.display_name}</span>
                <span className="text-gray-600">{r.wins}-{r.losses} · {r.played} played</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Tabs({ current }: { current: "season" | "career" }) {
  const base = "px-3 py-1 rounded text-sm";
  const on = "bg-gray-900 text-white";
  const off = "bg-gray-100 text-gray-700";
  return (
    <nav className="flex gap-2">
      <a href="/scoreboard?view=season" className={`${base} ${current === "season" ? on : off}`}>Season</a>
      <a href="/scoreboard?view=career" className={`${base} ${current === "career" ? on : off}`}>Career</a>
    </nav>
  );
}
