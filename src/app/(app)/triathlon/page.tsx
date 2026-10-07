import Link from "next/link";
import { PageFrame } from "@/components/page";
import { todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export default async function TriathlonPage() {
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const from = shift(today, -6);
  const [{ data: done }, { data: planned }, { data: scores }, { data: event }] = await Promise.all([
    supabase.from("completed_workouts").select("sport, duration_min, load").eq("user_id", user.id).gte("started_at", `${from}T00:00:00Z`),
    supabase.from("workouts").select("sport, duration_min").eq("user_id", user.id).eq("status", "planned").gte("scheduled_date", from).lte("scheduled_date", today).is("deleted_at", null),
    supabase.from("performance_scores").select("dimension, score, explanation").eq("user_id", user.id).order("scored_on", { ascending: false }).limit(20),
    supabase.from("events").select("id, name, event_type, starts_on").eq("owner_user_id", user.id).is("deleted_at", null).order("starts_on").limit(1).maybeSingle(),
  ]);
  const sports = ["swimming", "cycling", "running", "strength"] as const;
  const latest = new Map<string, { score: number | null; explanation: string }>();
  for (const score of scores ?? []) {
    if (!latest.has(score.dimension)) latest.set(score.dimension, score);
  }
  const parts = ["swimming", "cycling", "running", "consistency", "recovery"].map((dimension) => latest.get(dimension)).filter((score): score is { score: number | null; explanation: string } => Boolean(score && score.score != null));
  const readiness = parts.length >= 2 ? Math.round(parts.reduce((sum, part) => sum + Number(part.score), 0) / parts.length) : null;

  return (
    <PageFrame eyebrow="Triathlon" title="Swim, bike, run, strength" lede="Weekly volume is the sum of saved sessions. Readiness averages only the dimensions that already have a score.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {sports.map((sport) => {
          const minutes = (done ?? []).filter((row) => row.sport === sport).reduce((sum, row) => sum + Number(row.duration_min ?? 0), 0);
          const upcoming = (planned ?? []).filter((row) => row.sport === sport).reduce((sum, row) => sum + Number(row.duration_min ?? 0), 0);
          return (
            <article key={sport} className="app-card p-4">
              <p className={`chip sport-${sport}`}>{sport}</p>
              <p className="metric mt-2 text-3xl font-bold">{minutes}</p>
              <p className="text-xs text-muted">minutes logged in 7 days · {upcoming} min still planned</p>
            </article>
          );
        })}
      </div>
      <article className="app-card p-5">
        <p className="eyebrow">Triathlon readiness</p>
        <p className="metric text-6xl font-bold">{readiness ?? "—"}</p>
        <p className="text-sm text-muted">{readiness == null ? "At least two of swim, bike, run, consistency, and recovery need a stored score." : `Average of ${parts.length} stored dimensions. Missing sports are excluded.`}</p>
        <ul className="mt-3 grid gap-2">
          {["swimming", "cycling", "running", "consistency", "recovery"].map((dimension) => (
            <li key={dimension} className="flex justify-between text-sm">
              <span className="capitalize">{dimension}</span>
              <span className="metric">{latest.get(dimension)?.score ?? "—"}</span>
            </li>
          ))}
        </ul>
      </article>
      {event ? <Link className="btn btn-primary" href={`/events/${event.id}`}>{event.name}</Link> : <Link className="btn btn-ghost" href="/events">Add a race</Link>}
      <p className="text-sm text-muted">Brick sessions, transition practice, and taper show up in the plan when the event is a sprint, Olympic, 70.3, or Ironman goal.</p>
    </PageFrame>
  );
}

function shift(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
