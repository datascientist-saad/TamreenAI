import { PageFrame } from "@/components/page";
import { EmptyState } from "@/components/states";
import { PlanEditor } from "@/features/plan/editor";
import { SelectionSummary } from "@/features/plan/selection-summary";
import { planWindow, toPlanWorkout, type PlanBlock } from "@/features/plan/model";
import { todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export const maxDuration = 60;

const workoutSelect = "id, scheduled_date, sport, title, objective, duration_min, intensity, expected_load, importance, recovery_hours, status, why_text, workout_exercises(sort_order, set_count, reps, why_text, notes, exercise_library(name, slug, live_supported))";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view = "week" } = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: athlete }, { data: plan }] = await Promise.all([
    supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle(),
    supabase.from("training_plans").select("id, name, explanation, start_date, end_date, inputs").eq("user_id", user.id).eq("status", "active").is("deleted_at", null).maybeSingle(),
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

  return (
    <PageFrame eyebrow="Training plan" title={plan?.name ?? "No active plan"} lede={plan?.explanation}>
      <SelectionSummary inputs={plan?.inputs} />
      {(workouts ?? []).length === 0 ? (
        <EmptyState title="This plan has no sessions yet." body="TamreenAI writes the plan from the sports, goal, and days saved on your profile." href="/onboarding" action="Edit training setup" />
      ) : null}
      <PlanEditor
        today={today}
        initialView={view}
        showRebuild
        blocks={(blocks ?? []) as PlanBlock[]}
        workouts={(workouts ?? []).map(toPlanWorkout)}
      />
    </PageFrame>
  );
}
