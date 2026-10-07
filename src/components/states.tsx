import Link from "next/link";

export function SetupScreen() {
  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-6">
      <section className="app-card p-8">
        <p className="eyebrow">Supabase unavailable</p>
        <h1 className="mt-3 text-3xl font-extrabold">Connect the database before training data can load.</h1>
        <p className="mt-3 text-muted">
          Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to the environment, then restart the app.
          The service role key stays on the server and is never required in the browser.
        </p>
      </section>
    </main>
  );
}

export function EmptyState({ title, body, href, action }: { title: string; body: string; href?: string; action?: string }) {
  return (
    <div className="app-card p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 text-muted">{body}</p>
      {href && action ? (
        <Link className="btn btn-primary mt-4" href={href}>{action}</Link>
      ) : null}
    </div>
  );
}

export function SafetyBanner() {
  return (
    <div className="rounded-2xl border border-live/40 bg-live/10 p-4 text-sm">
      <p className="font-bold">Stop training and get professional care.</p>
      <p className="mt-1">
        Chest pain, fainting, severe pain, or breathlessness at rest is outside what Tamreen can guide. Tamreen does not diagnose injuries.
      </p>
    </div>
  );
}

export function DemoBanner() {
  return (
    <p className="rounded-full border border-gold/50 bg-gold/15 px-3 py-1 text-xs font-bold tracking-wide text-ink">
      Demo athlete · seeded history is labeled and is not a live measurement
    </p>
  );
}

export function ExplainList({ factors }: { factors: Array<{ label: string; detail: string }> }) {
  if (!factors.length) return null;
  return (
    <ol className="mt-3 grid gap-2">
      {factors.map((factor) => (
        <li key={factor.label} className="rounded-xl bg-paper px-3 py-2 text-sm">
          <span className="font-bold">{factor.label}. </span>
          <span className="text-muted">{factor.detail}</span>
        </li>
      ))}
    </ol>
  );
}
