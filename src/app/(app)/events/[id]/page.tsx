import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/page";
import { daysUntil, formatClock, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!event || (event.owner_user_id !== user.id && !event.is_public)) notFound();
  const { data: registration } = await supabase.from("event_registrations").select("id, status").eq("event_id", id).eq("user_id", user.id).maybeSingle();
  const { data: result } = registration
    ? await supabase.from("event_results").select("*").eq("registration_id", registration.id).maybeSingle()
    : { data: null };
  const days = daysUntil(event.starts_on, today);
  return (
    <PageFrame eyebrow={event.event_type} title={event.name} lede={event.description || "This event anchors the training block."}>
      <p className="metric text-4xl font-bold">{days >= 0 ? `${days} days remaining` : "Completed"}</p>
      <p className="text-sm text-muted">{event.location} · {event.starts_on}{event.distance_m ? ` · ${event.distance_m} m` : ""}</p>
      {result ? (
        <article className="app-card p-5">
          <p className="eyebrow">Post-event report</p>
          <p className="metric mt-2 text-5xl font-bold">{result.finish_time_seconds ? formatClock(result.finish_time_seconds) : "—"}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted">Pace</dt><dd className="metric">{result.pace_sec_per_km ? `${Math.round(Number(result.pace_sec_per_km))} sec/km` : "—"}</dd></div>
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
      <Link className="btn btn-ghost" href="/plan">Open the plan tied to this date</Link>
    </PageFrame>
  );
}
