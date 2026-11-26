import { CoachBox } from "@/features/ai/coach-box";
import { buildCoachStarters } from "@/features/ai/starters";
import type { CoachContextItem } from "@/features/ai/types";
import { buildPlanHref, sanitizeReturnTo, weekStartMonday } from "@/lib/navigation";
import { todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    context?: string;
    body?: string;
    kind?: string;
    id?: string;
    workoutId?: string;
    eventId?: string;
  }>;
}) {
  const query = await searchParams;
  const returnTo = sanitizeReturnTo(query.from);
  const { supabase, user } = await requireUser();

  const [{ data: athlete }, { data: pending }, { data: events }, { data: workouts }] = await Promise.all([
    supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("ai_recommendations")
      .select("id, title, body, status")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("events")
      .select("id, name, starts_on")
      .eq("owner_user_id", user.id)
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .order("starts_on")
      .limit(8),
    supabase
      .from("workouts")
      .select("id, title, scheduled_date, sport, status")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("scheduled_date")
      .limit(14),
  ]);

  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const week = weekStartMonday(today);
  const weekHref = buildPlanHref({ week, tab: "schedule" });
  const upcomingEvent = (events ?? []).find((event) => event.starts_on >= today) ?? null;
  const todays = (workouts ?? []).filter((row) => row.scheduled_date === today);
  const upcomingWorkouts = (workouts ?? []).filter((row) => row.scheduled_date >= today).slice(0, 5);

  const contextOptions: CoachContextItem[] = [
    {
      kind: "week",
      id: week,
      label: "This week’s plan",
      detail: `Week of ${week}`,
    },
    ...upcomingWorkouts.map((workout) => ({
      kind: "workout" as const,
      id: workout.id,
      label: workout.title,
      detail: `${workout.scheduled_date} · ${workout.sport}`,
    })),
    ...((events ?? [])
      .filter((event) => event.starts_on >= today)
      .slice(0, 3)
      .map((event) => ({
        kind: "event" as const,
        id: event.id,
        label: event.name,
        detail: `Starts ${event.starts_on}`,
      }))),
  ];

  if (pending) {
    contextOptions.unshift({
      kind: "change",
      id: pending.id,
      label: pending.title,
      detail: pending.body.slice(0, 120),
    });
  }

  const initialContext = resolveInitialContext(query, contextOptions, pending, upcomingEvent);

  const starters = buildCoachStarters({
    hasPlanChange: Boolean(pending),
    eventName: upcomingEvent?.name ?? null,
    todayWorkoutTitle: todays[0]?.title ?? null,
  });

  const racePrepHref = upcomingEvent
    ? `/events/${upcomingEvent.id}/prep?from=${encodeURIComponent(returnTo || "/ai")}`
    : null;

  return (
    <main className="px-0 py-0 md:px-4 md:py-4">
      <CoachBox
        returnTo={returnTo}
        starters={starters}
        contextOptions={contextOptions}
        initialContext={initialContext}
        weekHref={weekHref}
        racePrepHref={racePrepHref}
      />
    </main>
  );
}

function resolveInitialContext(
  query: {
    context?: string;
    body?: string;
    kind?: string;
    id?: string;
    workoutId?: string;
    eventId?: string;
  },
  options: CoachContextItem[],
  pending: { id: string; title: string; body: string } | null,
  upcomingEvent: { id: string; name: string; starts_on: string } | null,
): CoachContextItem | null {
  const kind = query.kind?.trim();
  const id = query.id?.trim() || query.workoutId?.trim() || query.eventId?.trim();

  if (kind && id) {
    const match = options.find((item) => item.kind === kind && item.id === id);
    if (match) return match;
  }

  if (query.workoutId) {
    const match = options.find((item) => item.kind === "workout" && item.id === query.workoutId);
    if (match) return match;
  }

  if (query.eventId) {
    const match = options.find((item) => item.kind === "event" && item.id === query.eventId);
    if (match) return match;
  }

  if (query.context?.trim()) {
    const title = query.context.trim();
    if (pending && pending.title === title) {
      return {
        kind: "change",
        id: pending.id,
        label: pending.title,
        detail: query.body?.trim() || pending.body.slice(0, 120),
      };
    }

    const named = options.find((item) => item.label === title);
    if (named) return named;

    if (/change|proposal|moved|adjust/i.test(title) && pending) {
      return {
        kind: "change",
        id: pending.id,
        label: pending.title,
        detail: query.body?.trim() || pending.body.slice(0, 120),
      };
    }

    if (upcomingEvent && title.toLowerCase().includes(upcomingEvent.name.toLowerCase())) {
      return {
        kind: "event",
        id: upcomingEvent.id,
        label: upcomingEvent.name,
        detail: `Starts ${upcomingEvent.starts_on}`,
      };
    }

    return {
      kind:
        kind === "workout" || kind === "event" || kind === "week" || kind === "change"
          ? kind
          : "change",
      id,
      label: title,
      detail: query.body?.trim() || undefined,
    };
  }

  return null;
}
