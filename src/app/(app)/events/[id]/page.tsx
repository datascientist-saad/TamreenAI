import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Flag, Target, Trophy, Utensils } from "lucide-react";
import { PageFrame } from "@/components/page";
import { PersonalEventForm } from "@/features/events/forms";
import { PostEventCheckInForm } from "@/features/events/post-event-checkin";
import { categoryForEventType, formatDistanceKm } from "@/services/events/catalog";
import { evaluateEventCompatibility } from "@/services/events/compatibility";
import { toPlanningEvents } from "@/services/events/multi-event";
import { priorityDisplayLabel } from "@/services/events/priority";
import { daysUntil, formatClock, formatPace, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!event || (event.owner_user_id !== user.id && !event.is_public)) notFound();

  const [
    { data: registration },
    { data: prep },
    { data: linked },
    { data: phases },
    { data: recovery },
    { data: adaptations },
    { data: allEvents },
  ] = await Promise.all([
    supabase.from("event_registrations").select("id, status").eq("event_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("event_preparation").select("template_slug, phase_plan, readiness_evidence, notes, current_capabilities, fueling_practice").eq("event_id", id).eq("user_id", user.id).maybeSingle(),
    supabase
      .from("session_event_links")
      .select("contribution, workouts(id, title, scheduled_date, sport, status, duration_min)")
      .eq("event_id", id)
      .eq("user_id", user.id)
      .limit(12),
    supabase
      .from("event_training_phases")
      .select("phase, start_date, end_date, objectives, sort_order")
      .eq("event_id", id)
      .eq("user_id", user.id)
      .order("sort_order"),
    supabase
      .from("event_recovery")
      .select("status, recovery_days, start_date, end_date, recommendations, medical_guidance, restrictions")
      .eq("event_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("training_adaptations")
      .select("adaptation_type, explanation, expected_impact, approval_status, original_snapshot, proposed_workout")
      .eq("event_id", id)
      .eq("user_id", user.id)
      .in("approval_status", ["pending", "applied"])
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("events")
      .select("id, name, starts_on, distance_m, swim_m, bike_m, run_m, goal_time_seconds, priority, status, discipline, event_type, course")
      .eq("owner_user_id", user.id)
      .is("deleted_at", null)
      .neq("status", "cancelled"),
  ]);

  const { data: result } = registration
    ? await supabase.from("event_results").select("*").eq("registration_id", registration.id).maybeSingle()
    : { data: null };

  const days = daysUntil(event.starts_on, today);
  const datedPhases = phases ?? [];
  const phasePlan = datedPhases.length
    ? datedPhases.map((phase) => ({
      phase: phase.phase,
      focus: phase.objectives,
      startDate: phase.start_date,
      endDate: phase.end_date,
    }))
    : Array.isArray(prep?.phase_plan)
      ? prep.phase_plan as Array<{ phase: string; focus: string; weeksHint?: number; startDate?: string; endDate?: string }>
      : [];
  const currentPhase = datedPhases.find((phase) => phase.start_date <= today && phase.end_date >= today)
    ?? phasePlan.find((phase) => phase.startDate && phase.endDate && phase.startDate <= today && phase.endDate >= today)
    ?? null;
  const evidence = Array.isArray(prep?.readiness_evidence) ? prep.readiness_evidence as Array<{ label: string; status: string; detail: string }> : [];
  const fueling = prep?.fueling_practice && typeof prep.fueling_practice === "object"
    ? prep.fueling_practice as {
      sections?: Array<{ id: string; title: string; bullets: string[] }>;
      carbLoadingRecommended?: boolean;
      limitations?: string[];
    }
    : null;
  const upcoming = (linked ?? [])
    .map((row) => {
      const workout = Array.isArray(row.workouts) ? row.workouts[0] : row.workouts;
      return workout && typeof workout === "object" ? { ...workout, contribution: row.contribution } : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .filter((row) => String(row.scheduled_date) >= today)
    .slice(0, 6);

  const planning = toPlanningEvents(allEvents ?? [], today);
  const compatibility = evaluateEventCompatibility(planning);
  const priority = (event.priority as "primary" | "secondary" | "practice") || "primary";
  const analysis = result?.analysis && typeof result.analysis === "object"
    ? result.analysis as {
      summary?: string;
      comparisons?: Array<{ label: string; detail: string; kind?: string }>;
      trainingUpdates?: Array<{ domain: string; change: string; estimate?: boolean }>;
    }
    : null;

  return (
    <PageFrame
      title={event.name}
      lede={`${event.event_type} · Priority ${priorityDisplayLabel(priority)} · ${event.status ?? "active"}`}
      compact
      actions={<Link className="btn btn-ghost btn-sm" href="/events">All events</Link>}
    >
      <section className="grid grid-cols-3 gap-2">
        <div className="app-card p-3">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted"><CalendarDays size={12} strokeWidth={1.75} aria-hidden /> Days</p>
          <p className="metric mt-1 text-2xl font-bold">{days >= 0 ? days : "—"}</p>
          <p className="caption">{event.starts_on}{event.ends_on && event.ends_on !== event.starts_on ? ` → ${event.ends_on}` : ""}</p>
        </div>
        <div className="app-card p-3">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted"><Target size={12} strokeWidth={1.75} aria-hidden /> Goal</p>
          <p className="metric mt-1 text-2xl font-bold">{event.goal_time_seconds ? formatClock(event.goal_time_seconds) : "—"}</p>
          <p className="caption">{event.location || "No location"}</p>
        </div>
        <div className="app-card p-3">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted"><Trophy size={12} strokeWidth={1.75} aria-hidden /> Distance</p>
          <p className="mt-2 text-sm font-semibold leading-snug">
            {event.swim_m || event.bike_m || event.run_m
              ? `${formatDistanceKm(event.swim_m)} / ${formatDistanceKm(event.bike_m)} / ${formatDistanceKm(event.run_m)}`
              : formatDistanceKm(event.distance_m)}
          </p>
        </div>
      </section>

      <section className="app-card grid gap-2 p-4">
        <p className="flex items-center gap-2 text-sm font-bold"><Flag size={14} strokeWidth={1.75} aria-hidden /> Preparation status</p>
        <p className="text-sm">
          Current phase: <span className="font-semibold capitalize">{(currentPhase && "phase" in currentPhase ? currentPhase.phase : (currentPhase as { phase?: string } | null)?.phase) || "—"}</span>
        </p>
        <p className="text-sm text-muted">
          Compatibility across events: <span className="font-semibold text-ink">{compatibility.status}</span>
          {" · "}{compatibility.summary}
        </p>
        {compatibility.findings.slice(0, 2).map((finding) => (
          <p key={finding.title} className="rounded-xl bg-paper px-3 py-2 text-sm">
            <span className="font-semibold">{finding.title}</span>
            <span className="block text-muted">{finding.detail}</span>
          </p>
        ))}
      </section>

      {phasePlan.length ? (
        <section className="app-card grid gap-2 p-4">
          <h2 className="font-bold">Training phases</h2>
          <ul className="grid gap-2">
            {phasePlan.map((phase) => (
              <li key={`${phase.phase}-${phase.focus}-${phase.startDate ?? ""}`} className="rounded-xl bg-paper px-3 py-2 text-sm">
                <span className="font-semibold capitalize">{phase.phase}</span>
                {"weeksHint" in phase && phase.weeksHint ? <span className="text-muted"> · ~{phase.weeksHint}w</span> : null}
                {phase.startDate && phase.endDate ? <span className="text-muted"> · {phase.startDate} → {phase.endDate}</span> : null}
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

      {(adaptations ?? []).length ? (
        <section className="app-card grid gap-2 p-4">
          <h2 className="font-bold">Training adjustments</h2>
          <ul className="grid gap-2">
            {(adaptations ?? []).map((row, index) => {
              const original = row.original_snapshot as { title?: string; durationMin?: number } | null;
              const proposed = row.proposed_workout as { title?: string; durationMin?: number } | null;
              return (
                <li key={`${row.adaptation_type}-${index}`} className="rounded-xl bg-paper px-3 py-2 text-sm">
                  <span className="font-semibold capitalize">{row.adaptation_type.replaceAll("_", " ")}</span>
                  <span className="text-muted"> · {row.approval_status}</span>
                  {original?.title || proposed?.title ? (
                    <span className="mt-1 block">
                      {original?.title ? `Original: ${original.title}${original.durationMin ? ` (${original.durationMin} min)` : ""}` : "—"}
                      {" → "}
                      {proposed?.title ? `Updated: ${proposed.title}${proposed.durationMin ? ` (${proposed.durationMin} min)` : ""}` : "Removed"}
                    </span>
                  ) : null}
                  <span className="block text-muted">{row.explanation}</span>
                </li>
              );
            })}
          </ul>
          <Link className="btn btn-ghost btn-sm" href="/home">Review on Home</Link>
        </section>
      ) : null}

      {fueling?.sections?.length ? (
        <section className="app-card grid gap-3 p-4">
          <h2 className="flex items-center gap-2 font-bold"><Utensils size={16} strokeWidth={1.75} aria-hidden /> Event nutrition</h2>
          {fueling.carbLoadingRecommended ? (
            <p className="text-sm text-muted">Carb loading is justified for this event in the final days — use familiar foods only.</p>
          ) : (
            <p className="text-sm text-muted">No carb-loading protocol — keep carbohydrate availability matched to training.</p>
          )}
          <div className="grid gap-2">
            {fueling.sections.map((section) => (
              <details key={section.id} className="rounded-xl bg-paper px-3 py-2 text-sm">
                <summary className="cursor-pointer font-semibold">{section.title}</summary>
                <ul className="mt-2 grid gap-1 text-muted">
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              </details>
            ))}
          </div>
          <Link className="btn btn-ghost btn-sm" href="/nutrition">Open Nutrition</Link>
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

      {recovery ? (
        <section className="app-card grid gap-2 p-4">
          <h2 className="font-bold">Post-event recovery</h2>
          <p className="text-sm">{recovery.recovery_days} days · {recovery.start_date} → {recovery.end_date} · {recovery.status}</p>
          {recovery.medical_guidance ? <p className="text-sm text-danger">{recovery.medical_guidance}</p> : null}
          <ul className="grid gap-1 text-sm text-muted">
            {(Array.isArray(recovery.recommendations) ? recovery.recommendations as Array<{ title: string; detail: string }> : []).map((item) => (
              <li key={item.title}><span className="font-semibold text-ink">{item.title}.</span> {item.detail}</li>
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
            <div><dt className="text-muted">Status</dt><dd className="metric">{result.completion_status ?? "finished"}</dd></div>
            <div><dt className="text-muted">Consistency</dt><dd className="metric">{result.consistency_score ?? "—"}</dd></div>
            <div><dt className="text-muted">Ranking</dt><dd className="metric">{result.ranking ? `${result.ranking}${result.field_size ? ` / ${result.field_size}` : ""}` : "No ranking stored"}</dd></div>
          </dl>
          <p className="mt-3 text-sm">{analysis?.summary ?? result.ai_insight}</p>
          {(analysis?.comparisons ?? []).map((item) => (
            <p key={item.label} className="mt-2 text-sm text-muted"><span className="font-semibold text-ink">{item.label}:</span> {item.detail}</p>
          ))}
          {(analysis?.trainingUpdates ?? []).slice(0, 3).map((item) => (
            <p key={item.change} className="mt-2 text-sm text-muted">
              <span className="font-semibold text-ink">{item.domain}{item.estimate ? " (estimate)" : ""}:</span> {item.change}
            </p>
          ))}
          <p className="mt-2 text-sm text-muted">{result.technique_note}</p>
          {result.data_origin === "demo" ? <p className="mt-2 text-xs font-bold">Demo result. Not a race-day measurement.</p> : null}
          <Link className="btn btn-primary mt-4" href="/plan">Train for your next event with Tamreen</Link>
        </article>
      ) : event.status !== "cancelled" && event.starts_on <= today ? (
        <PostEventCheckInForm eventId={event.id} eventName={event.name} />
      ) : (
        <p className="text-sm text-muted">No result is stored yet. After the event, complete the post-event check-in.</p>
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
