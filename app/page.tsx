import { cookies } from "next/headers";

// Lightweight home / nav hub — public, RSC, no PII. Existing players see
// their session reflected via a logout-vs-login affordance; nothing private
// is rendered.
export default async function Home() {
  // Cheap presence check — does *not* validate the session. The real check
  // runs inside each protected route handler / page.
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(cookieStore.get("funcap_session")?.value);

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Funcap</h1>
        <p className="mt-2 text-sm text-gray-600">
          Community tennis — self-reported scores, two-party confirmation, a public scoreboard.
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Browse (no account)</h2>
        <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <NavLink href="/scoreboard" title="Scoreboard" subtitle="Season standings and career win-%." />
          <NavLink href="/tournaments" title="Tournaments" subtitle="Past, current, and upcoming." />
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Your account</h2>
        <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {isLoggedIn ? (
            <>
              <NavLink href="/profile" title="Profile" subtitle="MFA, password, account." />
              <NavLink href="/matches" title="Matches" subtitle="Enter a score, approve a result." />
            </>
          ) : (
            <>
              <NavLink href="/login" title="Log in" subtitle="Existing account." />
              <NavLink href="/register" title="Register" subtitle="Create an account." />
            </>
          )}
        </ul>
      </section>
    </main>
  );
}

function NavLink({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <li>
      <a href={href} className="block border rounded p-3 hover:bg-gray-50">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-gray-600 mt-0.5">{subtitle}</div>
      </a>
    </li>
  );
}

