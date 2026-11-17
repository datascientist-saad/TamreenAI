import { AboutDisclosure } from "@/components/about-disclosure";
import { PageFrame } from "@/components/page";
import { EmptyState } from "@/components/states";
import { PlanEditor } from "@/features/plan/editor";
import { SelectionSummary } from "@/features/plan/selection-summary";
import { planWindow, toPlanWorkout, type PlanBlock } from "@/features/plan/model";
import { daysUntil, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export const maxDuration = 60;

const workoutSelect = "id, scheduled_date, sport, title, objective, duration_min, intensity, expected_load, importance, recovery_hours, status, why_text, workout_exercises(sort_order, set_count, reps, why_text, notes, exercise_library(name, slug, live_supported))";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view = "week" } = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: athlete }, { data: plan }, { data: events }, { data: revisions }] = await Promise.all([
    supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle(),
    supabase.from("training_plans").select("id, name, explanation, start_date, end_date, inputs").eq("user_id", user.id).eq("status", "active").is("deleted_at", null).maybeSingle(),
    supabase
      .from("events")
      .select("id, name, starts_on, priority, event_type")
      .eq("owner_user_id", user.id)
      .is("deleted_at", null)
      .gte("starts_on", "1900-01-01")
      .order("starts_on")
      .limit(6),
    supabase
      .from("plan_revisions")
      .select("id, reason, change_summary, created_at, requires_approval, approved_at, rolled_back_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const { data: blocks } = plan
    ? await supabase.from("training_blocks").select("id, phase, name, start_date, end_date, focus").eq("plan_id", plan.id).order("sort_order")
    : { data: [] as PlanBlock[] };
  const currentBlock = (blocks ?? []).find((block) => block.start_date <= today && block.end_date >= today) ?? blocks?.[0];
  const [from, to] = planWindow(today, currentBlock);
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
  const upcomingEvents = (events ?? []).filter((event) => event.starts_on >= today).slice(0, 3);

  return (
    <PageFrame
      eyebrow="Training plan"
      title={plan?.name ?? "No active plan"}
      lede={currentBlock ? `${currentBlock.phase} · ${currentBlock.name}` : undefined}
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Current week" value={from.slice(5)} hint={`to ${to.slice(5)}`} />
        <SummaryTile label="Sessions" value={`${completed}/${mapped.length}`} hint="completed in view" />
        <SummaryTile label="Volume" value={`${totalMinutes}`} hint="minutes scheduled" />
      </section>

      {upcomingEvents.length ? (
        <section className="app-card grid gap-2 p-4">
          <p className="eyebrow">Upcoming events</p>
          <ul className="grid gap-2">
            {upcomingEvents.map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold">{event.name}</span>
                <span className="metric text-muted">{daysUntil(event.starts_on, today)}d · {event.priority ?? "primary"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SelectionSummary inputs={plan?.inputs} />

      {(workouts ?? []).length === 0 ? (
        <EmptyState title="This plan has no sessions yet." body="TamreenAI writes the plan from the sports, goal, and days saved on your profile." href="/onboarding" action="Edit training setup" />
      ) : null}

      <PlanEditor
        today={today}
        initialView={view}
        showRebuild
        blocks={(blocks ?? []) as PlanBlock[]}
        workouts={mapped}
      />

      {plan?.explanation ? (
        <AboutDisclosure title="About this plan" summary="Objectives, methodology, progression, and recovery">
          <div className="grid gap-3">
            <p>{plan.explanation}</p>
            {currentBlock?.focus ? (
              <p><span className="font-semibold text-ink">Current phase focus:</span> {currentBlock.focus}</p>
            ) : null}
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
    <div className="app-card min-w-0 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="metric mt-1 text-2xl font-extrabold">{value}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}
