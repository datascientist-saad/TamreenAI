import Link from "next/link";
import { Suspense } from "react";
import { AboutDisclosure } from "@/components/about-disclosure";
import { PageFrame } from "@/components/page";
import { ScrollRestore } from "@/components/scroll-restore";
import { EmptyState } from "@/components/states";
import { PlanEditor } from "@/features/plan/editor";
import { PlanProposedChanges } from "@/features/plan/plan-proposals";
import { SelectionSummary } from "@/features/plan/selection-summary";
import { planWindow, toPlanWorkout, type PlanBlock } from "@/features/plan/model";
import { buildPlanHref, weekStartMonday, withReturnTo } from "@/lib/navigation";
import { daysUntil, shiftIsoDate, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export const maxDuration = 60;

const workoutSelect = "id, scheduled_date, sport, title, objective, duration_min, intensity, expected_load, importance, recovery_hours, status, why_text, is_event_session, event_id, structure, workout_exercises(sort_order, set_count, reps, why_text, notes, exercise_library(name, slug, live_supported))";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string; day?: string; tab?: string }>;
}) {
  const { view = "week", week, day, tab = "schedule" } = await searchParams;
  const activeTab = tab === "events" ? "events" : "schedule";
  const { supabase, user } = await requireUser();
  const [{ data: athlete }, { data: plan }, { data: events }, { data: revisions }, { data: insight }] = await Promise.all([
    supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle(),
    supabase.from("training_plans").select("id, name, explanation, start_date, end_date, inputs").eq("user_id", user.id).eq("status", "active").is("deleted_at", null).maybeSingle(),
    supabase
      .from("events")
      .select("id, name, starts_on, priority, event_type, status")
      .eq("owner_user_id", user.id)
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .order("starts_on")
      .limit(12),
    supabase
      .from("plan_revisions")
      .select("id, reason, change_summary, created_at, requires_approval, approved_at, rolled_back_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("ai_recommendations")
      .select("id, title, body, factors, proposed_changes, status")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const currentWeek = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? weekStartMonday(week) : weekStartMonday(today);
  const prevWeek = shiftIsoDate(currentWeek, -7);
  const nextWeek = shiftIsoDate(currentWeek, 7);
  const weekEnd = shiftIsoDate(currentWeek, 6);
  const { data: blocks } = plan
    ? await supabase.from("training_blocks").select("id, phase, name, start_date, end_date, focus").eq("plan_id", plan.id).order("sort_order")
    : { data: [] as PlanBlock[] };
  const currentBlock = (blocks ?? []).find((block) => block.start_date <= today && block.end_date >= today) ?? blocks?.[0];
  const [from, to] = view === "week"
    ? [currentWeek, weekEnd]
    : planWindow(today, currentBlock);
  const { data: workouts } = await supabase
    .from("workouts")
    .select(workoutSelect)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
    .order("scheduled_date");

  const mapped = (workouts ?? []).map(toPlanWorkout);
  const completed = mapped.filter((workout) => workout.status === "completed").length;
  const totalMinutes = mapped.reduce((sum, workout) => sum + (workout.duration_min ?? 0), 0);
  const upcomingEvents = (events ?? []).filter((event) => event.starts_on >= today);
  const primaryEvent = upcomingEvents.find((event) => (event.priority ?? "primary") === "primary") ?? upcomingEvents[0] ?? null;
  const planReturn = buildPlanHref({ week: currentWeek, day: day ?? null, tab: activeTab, view });
  const weekLabel = `${formatWeekDay(currentWeek)} – ${formatWeekDay(weekEnd)}`;

  return (
    <PageFrame
      title={plan?.name ?? "Plan"}
      lede={currentBlock ? `${currentBlock.phase} · ${currentBlock.name}` : "Weekly schedule and events"}
      compact
      width="wide"
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            className={`btn btn-sm ${activeTab === "schedule" ? "btn-primary" : "btn-ghost"}`}
            href={buildPlanHref({ week: currentWeek, tab: "schedule", view })}
            aria-current={activeTab === "schedule" ? "page" : undefined}
          >
            Schedule
          </Link>
          <Link
            className={`btn btn-sm ${activeTab === "events" ? "btn-primary" : "btn-ghost"}`}
            href={buildPlanHref({ week: currentWeek, tab: "events", view })}
            aria-current={activeTab === "events" ? "page" : undefined}
          >
            Events
          </Link>
        </div>
      }
    >
      <Suspense fallback={null}>
        <ScrollRestore />
      </Suspense>
      {activeTab === "events" ? (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title">Events</h2>
            <Link className="btn btn-primary btn-sm" href="/events#add-event">Add event</Link>
          </div>
          {!primaryEvent && upcomingEvents.length === 0 ? (
            <EmptyState
              title="No upcoming events"
              body="Add a race or goal event so taper and race-day sessions have an anchor."
              href="/events#add-event"
              action="Add an event"
            />
          ) : null}
          {primaryEvent ? (
            <p className="text-sm text-muted">
              Plan currently based on <span className="font-semibold text-ink">{primaryEvent.name}</span>
              {" "}({primaryEvent.priority ?? "primary"}).{" "}
              <Link className="font-bold text-maroon" href="/events#add-event">Select a new goal</Link>
            </p>
          ) : null}
          <ul className="grid gap-2">
            {(events ?? []).map((event) => (
              <li key={event.id} className="app-card grid gap-3 p-4">
                <Link
                  className="flex flex-wrap items-baseline justify-between gap-2"
                  href={withReturnTo(`/events/${event.id}`, planReturn)}
                >
                  <span className="min-w-0">
                    <span className="eyebrow">{event.priority ?? "primary"} · {event.event_type}</span>
                    <span className="mt-1 block font-bold break-words">{event.name}</span>
                  </span>
                  <span className="metric text-sm text-muted">
                    {daysUntil(event.starts_on, today)}d · {event.starts_on}
                  </span>
                </Link>
                {event.starts_on >= today ? (
                  <Link
                    className="btn btn-soft btn-sm w-fit"
                    href={`/events/${event.id}/prep?from=${encodeURIComponent(planReturn)}`}
                  >
                    Race Prep
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-2">
            <SummaryTile label="Window" value={from.slice(5)} hint={`→ ${to.slice(5)}`} />
            <SummaryTile label="Done" value={`${completed}/${mapped.length}`} hint="sessions" />
            <SummaryTile label="Volume" value={`${totalMinutes}`} hint="min" />
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <Link className="btn btn-ghost btn-sm min-h-11" href={buildPlanHref({ week: prevWeek, tab: "schedule", view })} aria-label="Previous week">
              Previous
            </Link>
            <Link className="btn btn-ghost btn-sm min-h-11" href={buildPlanHref({ week: weekStartMonday(today), tab: "schedule", view })}>
              Today
            </Link>
            <Link className="btn btn-ghost btn-sm min-h-11" href={buildPlanHref({ week: nextWeek, tab: "schedule", view })} aria-label="Next week">
              Next
            </Link>
            <p className="metric text-sm font-semibold sm:ml-auto">{weekLabel}</p>
          </div>

          {upcomingEvents.length ? (
            <section className="app-card grid gap-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="eyebrow">Upcoming events</p>
                <Link className="text-sm font-bold text-maroon" href={buildPlanHref({ week: currentWeek, tab: "events" })}>Manage</Link>
              </div>
              <ul className="grid gap-2">
                {upcomingEvents.slice(0, 3).map((event) => (
                  <li key={event.id}>
                    <Link
                      className="flex flex-wrap items-baseline justify-between gap-2 text-sm hover:text-maroon"
                      href={withReturnTo(`/events/${event.id}`, planReturn)}
                    >
                      <span className="font-semibold">{event.name}</span>
                      <span className="metric text-muted">{daysUntil(event.starts_on, today)}d · {event.priority ?? "primary"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {insight ? <PlanProposedChanges insight={insight} returnTo={planReturn} /> : null}

          <SelectionSummary inputs={plan?.inputs} />

          {(workouts ?? []).length === 0 ? (
            <EmptyState title="This plan has no sessions yet." body="TamreenAI writes the plan from the sports, goal, and days saved on your profile." href="/onboarding" action="Create your first plan" />
          ) : null}

          <PlanEditor
            today={today}
            weekStart={currentWeek}
            focusDay={day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null}
            initialView={view}
            showRebuild
            blocks={(blocks ?? []) as PlanBlock[]}
            workouts={mapped}
            returnTo={planReturn}
          />
        </>
      )}

      {plan?.explanation ? (
        <AboutDisclosure title="About this plan" summary="Objectives, methodology, progression, and recovery">
          <div className="grid gap-3">
            <p>{plan.explanation}</p>
            {currentBlock?.focus ? (
              <p><span className="font-semibold text-ink">Current phase focus:</span> {currentBlock.focus}</p>
            ) : null}
            {primaryEvent ? (
              <p><span className="font-semibold text-ink">Current goal event:</span> {primaryEvent.name} ({primaryEvent.starts_on})</p>
            ) : (
              <p><span className="font-semibold text-ink">Goal event:</span> None selected. <Link className="font-bold text-maroon" href="/events#add-event">Add an event</Link></p>
            )}
            <p>Long explanations stay here so workouts stay above the fold. Rebuild or optimize from the toolbar when you need a material change.</p>
          </div>
        </AboutDisclosure>
      ) : null}

      {(revisions ?? []).length ? (
        <AboutDisclosure title="Plan version history" summary={`${revisions?.length ?? 0} recent material changes`}>
          <ul className="grid gap-2">
            {(revisions ?? []).map((revision) => (
              <li key={revision.id} className="rounded-xl bg-paper px-3 py-2">
                <p className="font-semibold text-ink">{revision.reason || "Plan change"}</p>
                <p>{revision.change_summary || "No summary stored."}</p>
                <p className="mt-1 text-xs">
                  {new Date(revision.created_at).toLocaleString()}
                  {revision.requires_approval ? " · required approval" : ""}
                  {revision.approved_at ? " · approved" : ""}
                  {revision.rolled_back_at ? " · rolled back" : ""}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs">Restoring an older version is available only when it does not overwrite completed workout history.</p>
        </AboutDisclosure>
      ) : null}
    </PageFrame>
  );
}

function SummaryTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="app-card min-w-0 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="metric mt-1 text-xl font-bold">{value}</p>
      <p className="caption">{hint}</p>
    </div>
  );
}

function formatWeekDay(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
