import { PageFrame } from "@/components/page";
import { PlanEditor } from "@/features/plan/editor";
import { toPlanWorkout } from "@/features/plan/model";
import { todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

const workoutSelect = "id, scheduled_date, sport, title, objective, duration_min, intensity, expected_load, importance, recovery_hours, status, why_text, workout_exercises(sort_order, set_count, reps, why_text, notes, exercise_library(name, slug, live_supported))";

export default async function CalendarPage() {
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const start = `${today.slice(0, 7)}-01`;
  const monthEnd = new Date(`${start}T00:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  monthEnd.setUTCDate(0);
  const { data: workouts } = await supabase
    .from("workouts")
    .select(workoutSelect)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .gte("scheduled_date", start)
    .lte("scheduled_date", monthEnd.toISOString().slice(0, 10))
    .order("scheduled_date");

  return (
    <PageFrame eyebrow="Calendar" title={today.slice(0, 7)} lede="Drag a session onto another day. The calendar updates immediately, and a conflict asks before it lands.">
      <PlanEditor
        today={today}
        initialView="month"
        lockView
        blocks={[]}
        workouts={(workouts ?? []).map(toPlanWorkout)}
      />
    </PageFrame>
  );
}
