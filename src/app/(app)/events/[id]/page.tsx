import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Target, Trophy } from "lucide-react";
import { PageFrame } from "@/components/page";
import { PersonalEventForm } from "@/features/events/forms";
import { categoryForEventType, formatDistanceKm } from "@/services/events/catalog";
import { daysUntil, formatClock, formatPace, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!event || (event.owner_user_id !== user.id && !event.is_public)) notFound();
  const [{ data: registration }, { data: prep }, { data: linked }] = await Promise.all([
    supabase.from("event_registrations").select("id, status").eq("event_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("event_preparation").select("template_slug, phase_plan, readiness_evidence, notes, current_capabilities").eq("event_id", id).eq("user_id", user.id).maybeSingle(),
    supabase
      .from("session_event_links")
      .select("contribution, workouts(id, title, scheduled_date, sport, status, duration_min)")
      .eq("event_id", id)
      .eq("user_id", user.id)
      .limit(12),
  ]);
  const { data: result } = registration
    ? await supabase.from("event_results").select("*").eq("registration_id", registration.id).maybeSingle()
    : { data: null };
  const days = daysUntil(event.starts_on, today);
  const phasePlan = Array.isArray(prep?.phase_plan) ? prep.phase_plan as Array<{ phase: string; focus: string; weeksHint?: number }> : [];
  const evidence = Array.isArray(prep?.readiness_evidence) ? prep.readiness_evidence as Array<{ label: string; status: string; detail: string }> : [];
  const upcoming = (linked ?? [])
    .map((row) => {
      const workout = Array.isArray(row.workouts) ? row.workouts[0] : row.workouts;
      return workout && typeof workout === "object" ? { ...workout, contribution: row.contribution } : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .filter((row) => String(row.scheduled_date) >= today)
    .slice(0, 6);

  return (
    <PageFrame
      eyebrow={event.event_type}
      title={event.name}
      lede={`${event.priority ?? "primary"} event · ${event.status ?? "active"}`}
      actions={<Link className="btn btn-ghost" href="/events">All events</Link>}
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="app-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><CalendarDays size={14} strokeWidth={1.75} aria-hidden /> Countdown</p>
          <p className="metric mt-1 text-3xl font-extrabold">{days >= 0 ? `${days}d` : "Done"}</p>
          <p className="text-sm text-muted">{event.starts_on}</p>
        </div>
        <div className="app-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Target size={14} strokeWidth={1.75} aria-hidden /> Target</p>
          <p className="metric mt-1 text-3xl font-extrabold">{event.goal_time_seconds ? formatClock(event.goal_time_seconds) : "—"}</p>
          <p className="text-sm text-muted">{event.location || "Location not set"}</p>
        </div>
        <div className="app-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Trophy size={14} strokeWidth={1.75} aria-hidden /> Distances</p>
          <p className="mt-2 text-sm">
            {event.swim_m || event.bike_m || event.run_m
              ? `Swim ${formatDistanceKm(event.swim_m)} · Bike ${formatDistanceKm(event.bike_m)} · Run ${formatDistanceKm(event.run_m)}`
              : formatDistanceKm(event.distance_m)}
          </p>
          <p className="mt-1 text-xs text-muted">Progress uses completed linked sessions, not a medical readiness score.</p>
        </div>
      </section>

      {phasePlan.length ? (
        <section className="app-card grid gap-2 p-4">
          <h2 className="font-bold">Preparation phases</h2>
          <ul className="grid gap-2">
            {phasePlan.map((phase) => (
              <li key={`${phase.phase}-${phase.focus}`} className="rounded-xl bg-paper px-3 py-2 text-sm">
                <span className="font-semibold capitalize">{phase.phase}</span>
                {phase.weeksHint ? <span className="text-muted"> · ~{phase.weeksHint}w</span> : null}
                <span className="block text-muted">{phase.focus}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {upcoming.length ? (
        <section className="app-card grid gap-2 p-4">
          <h2 className="font-bold">Upcoming key sessions</h2>
          <ul className="grid gap-2">
            {upcoming.map((workout) => (
              <li key={String(workout.id)} className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
                <Link className="font-semibold text-maroon" href={`/train/${workout.id}`}>{String(workout.title)}</Link>
                <span className="metric text-muted">{String(workout.scheduled_date)} · {String(workout.duration_min ?? "—")} min</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {evidence.length ? (
        <section className="app-card grid gap-2 p-4">
          <h2 className="font-bold">Preparation evidence</h2>
          <ul className="grid gap-2">
            {evidence.map((item) => (
              <li key={item.label} className="rounded-xl bg-paper px-3 py-2 text-sm">
                <span className="font-semibold">{item.label}</span>
                <span className="text-muted"> · {item.status}</span>
                <span className="block text-muted">{item.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result ? (
        <article className="app-card p-5">
          <p className="eyebrow">Post-event report</p>
          <p className="metric mt-2 text-5xl font-bold">{result.finish_time_seconds ? formatClock(result.finish_time_seconds) : "—"}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted">Pace</dt><dd className="metric">{result.pace_sec_per_km ? formatPace(Number(result.pace_sec_per_km), "km") : "—"}</dd></div>
            <div><dt className="text-muted">Consistency</dt><dd className="metric">{result.consistency_score ?? "—"}</dd></div>
            <div><dt className="text-muted">Ranking</dt><dd className="metric">{result.ranking ? `${result.ranking}${result.field_size ? ` / ${result.field_size}` : ""}` : "No ranking stored"}</dd></div>
          </dl>
          <p className="mt-3 text-sm">{result.ai_insight}</p>
          <p className="mt-2 text-sm text-muted">{result.technique_note}</p>
          {result.data_origin === "demo" ? <p className="mt-2 text-xs font-bold">Demo result. Not a race-day measurement.</p> : null}
          <Link className="btn btn-primary mt-4" href="/plan">Train for your next event with Tamreen</Link>
        </article>
      ) : (
        <p className="text-sm text-muted">No result is stored yet. After the event, the organizer or your own log can attach splits.</p>
      )}

      {event.owner_user_id === user.id ? (
        <PersonalEventForm
          initial={{
            id: event.id,
            name: event.name,
            category: categoryForEventType(event.event_type),
            preset: event.template_slug || event.event_type,
            eventType: event.event_type,
            date: event.starts_on,
            location: event.location ?? "",
            priority: (event.priority as "primary" | "secondary" | "practice" | undefined) ?? "primary",
            experienceLevel: event.experience_level ?? "",
            notes: event.athlete_notes || event.description || "",
            status: (event.status as "active" | "completed" | "cancelled" | undefined) ?? "active",
            distanceM: event.distance_m == null ? null : Number(event.distance_m),
            swimM: event.swim_m == null ? null : Number(event.swim_m),
            bikeM: event.bike_m == null ? null : Number(event.bike_m),
            runM: event.run_m == null ? null : Number(event.run_m),
          }}
        />
      ) : null}

      <Link className="btn btn-ghost" href="/plan">Open the integrated plan</Link>
    </PageFrame>
  );
}
