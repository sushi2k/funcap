import { listTournaments } from "@/server/dal/tournaments";

// Server Component — reads the DAL directly (DTOs only). Guest-accessible.
export default async function TournamentsPage() {
  const tournaments = await listTournaments();

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-4">
      <h1 className="text-xl font-semibold">Tournaments</h1>
      {tournaments.length === 0 ? (
        <p className="text-sm text-gray-600">No tournaments yet.</p>
      ) : (
        <ul className="divide-y border rounded">
          {tournaments.map((t) => (
            <li key={t.id} className="p-3 flex justify-between items-baseline gap-4">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-gray-600">
                  {new Date(t.starts_at).toLocaleDateString()} – {new Date(t.ends_at).toLocaleDateString()}
                  {" · "}closes {new Date(t.closing_ends_at).toLocaleDateString()}
                </div>
              </div>
              <span className="text-xs font-mono px-2 py-1 rounded bg-gray-100">{t.state}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
