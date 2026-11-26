import Link from "next/link";
import { notFound } from "next/navigation";
import { RacePrepScreen } from "@/features/events/race-prep-screen";
import { formatDistanceKm } from "@/services/events/catalog";
import { detectScheduleOverlaps, localDateFromStart } from "@/services/events/policy";
import { buildRacePrepSnapshot, prepWindowOpen, type ChecklistItem, type FuelSlot, type TimelineItem } from "@/services/events/race-prep";
import { daysUntil, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export default async function RacePrepPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");

  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!event || (event.owner_user_id !== user.id && !event.is_public)) notFound();

  const [
    { data: prep },
    { data: registration },
    { data: allEvents },
    { data: prefs },
    { data: adaptations },
  ] = await Promise.all([
    supabase
      .from("event_preparation")
      .select("checklist, race_day_plan, fueling_plan, fueling_practice, schedule_notes, offline_pending")
      .eq("event_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("event_registrations").select("id").eq("event_id", id).eq("user_id", user.id).maybeSingle(),
    supabase
      .from("events")
      .select("id, name, starts_on, starts_at, ends_on, timezone, priority, status, discipline, event_type, distance_m, swim_m, bike_m, run_m, template_slug")
      .eq("owner_user_id", user.id)
      .is("deleted_at", null)
      .neq("status", "cancelled"),
    supabase.from("athlete_preferences").select("dietary_pattern, allergies").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("training_adaptations")
      .select("explanation, adaptation_type, approval_status")
      .eq("event_id", id)
      .eq("user_id", user.id)
      .in("approval_status", ["pending", "applied"])
      .limit(12),
  ]);

  const { data: result } = registration
    ? await supabase.from("event_results").select("id").eq("registration_id", registration.id).maybeSingle()
    : { data: null };
  const { data: recovery } = await supabase
    .from("event_recovery")
    .select("id, status, athlete_feedback")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const localStartsOn = localDateFromStart(event.starts_at, event.starts_on, event.timezone || athlete?.timezone);
  const policyEvents = (allEvents ?? [])
    .filter((row) => (row.status ?? "active") === "active")
    .map((row) => ({
      id: row.id,
      name: row.name,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      localStartsOn: localDateFromStart(row.starts_at, row.starts_on, row.timezone || athlete?.timezone),
      priority: (row.priority as "primary" | "secondary" | "practice") || "primary",
      discipline: row.discipline || row.event_type || "other",
      distanceM: row.distance_m == null ? null : Number(row.distance_m),
      swimM: row.swim_m == null ? null : Number(row.swim_m),
      bikeM: row.bike_m == null ? null : Number(row.bike_m),
      runM: row.run_m == null ? null : Number(row.run_m),
      templateSlug: row.template_slug,
      timezone: row.timezone,
    }));

  const raceDayPlan = prep?.race_day_plan && typeof prep.race_day_plan === "object"
    ? prep.race_day_plan as { timeline?: TimelineItem[] }
    : {};
  const fuelingPlan = prep?.fueling_plan && typeof prep.fueling_plan === "object"
    ? prep.fueling_plan as { slots?: FuelSlot[] }
    : {};
  const scheduleNotes = Array.isArray(prep?.schedule_notes)
    ? (prep?.schedule_notes as string[])
    : (adaptations ?? []).slice(0, 6).map((row) => row.explanation);

  const expectedHours = event.goal_time_seconds
    ? Number(event.goal_time_seconds) / 3600
    : event.estimated_duration_min
      ? Number(event.estimated_duration_min) / 60
      : null;

  const snapshot = buildRacePrepSnapshot({
    event: {
      id: event.id,
      name: event.name,
      startsOn: event.starts_on,
      endsOn: event.ends_on,
      localStartsOn,
      priority: (event.priority as "primary" | "secondary" | "practice") || "primary",
      discipline: event.discipline || event.event_type || "other",
      distanceM: event.distance_m == null ? null : Number(event.distance_m),
      swimM: event.swim_m == null ? null : Number(event.swim_m),
      bikeM: event.bike_m == null ? null : Number(event.bike_m),
      runM: event.run_m == null ? null : Number(event.run_m),
      templateSlug: event.template_slug,
      timezone: event.timezone || athlete?.timezone || "Asia/Qatar",
      startsAt: event.starts_at,
      checkInClosesAt: event.check_in_closes_at,
      travelMinutes: event.travel_minutes,
      arrivalBufferMin: event.arrival_buffer_min,
      estimatedDurationMin: event.estimated_duration_min,
      location: event.location,
    },
    today,
    checklist: Array.isArray(prep?.checklist) ? prep?.checklist as ChecklistItem[] : null,
    timeline: raceDayPlan.timeline ?? null,
    fuel: fuelingPlan.slots ?? null,
    hasResult: Boolean(result),
    hasRecoveryCheckIn: Boolean(recovery && (recovery.status === "active" || recovery.status === "completed" || (recovery.athlete_feedback && Object.keys(recovery.athlete_feedback as object).length))),
    scheduleNotes: scheduleNotes.length
      ? scheduleNotes
      : undefined,
    dietaryPattern: prefs?.dietary_pattern,
    allergies: prefs?.allergies,
    expectedHours,
  });

  const overlaps = detectScheduleOverlaps(policyEvents)
    .filter((item) => item.eventIds.includes(id))
    .map((item) => ({ title: item.title, detail: item.detail, eventIds: item.eventIds }));

  const backHref = from && from.startsWith("/") ? from : "/events";
  const backLabel = from?.startsWith("/plan")
    ? "Back to Plan"
    : from?.startsWith("/home")
      ? "Back to Today"
      : from?.startsWith("/events/")
        ? "Back to event"
        : "Back to Events";

  const windowOpen = prepWindowOpen({
    today,
    eventDate: localStartsOn,
    priority: snapshot.eventId ? ((event.priority as "primary" | "secondary" | "practice") || "primary") : "primary",
    discipline: event.discipline || event.event_type || "other",
    distanceM: event.distance_m == null ? null : Number(event.distance_m),
    templateSlug: event.template_slug,
  });

  if (!windowOpen && daysUntil(localStartsOn, today) > 21) {
    return (
      <main className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
        <p className="text-sm text-muted">Race Prep opens closer to the event (taper window).</p>
        <Link className="btn btn-primary w-fit" href={`/events/${id}`}>Open event</Link>
      </main>
    );
  }

  const distanceLabel = event.swim_m || event.bike_m || event.run_m
    ? `${formatDistanceKm(event.swim_m)} / ${formatDistanceKm(event.bike_m)} / ${formatDistanceKm(event.run_m)}`
    : formatDistanceKm(event.distance_m);

  return (
    <RacePrepScreen
      snapshot={snapshot}
      backHref={backHref}
      backLabel={backLabel}
      hasResult={Boolean(result)}
      overlaps={overlaps}
      details={{
        distanceLabel,
        location: event.location,
        waveLabel: event.wave_label,
        bibPickup: event.bib_pickup || null,
        checkInLabel: event.check_in_closes_at
          ? new Date(event.check_in_closes_at).toLocaleString("en-GB", {
            timeZone: event.timezone || athlete?.timezone || "Asia/Qatar",
            dateStyle: "medium",
            timeStyle: "short",
          })
          : null,
        travelMinutes: event.travel_minutes,
        affectedWeekHref: `/plan?view=week`,
      }}
    />
  );
}
