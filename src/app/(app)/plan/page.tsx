import Link from "next/link";
import { PageFrame } from "@/components/page";
import { EmptyState } from "@/components/states";
import { WorkoutControls } from "@/features/calendar/controls";
import { formatDuration, shiftIsoDate, sportLabel, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";
import { generatePlan } from "@/server/actions";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view = "week" } = await searchParams;
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const { data: plan } = await supabase.from("training_plans").select("id, name, explanation, start_date, end_date").eq("user_id", user.id).eq("status", "active").is("deleted_at", null).maybeSingle();
  const { data: blocks } = plan
    ? await supabase.from("training_blocks").select("id, phase, name, start_date, end_date, focus").eq("plan_id", plan.id).order("sort_order")
    : { data: [] };
  const currentBlock = (blocks ?? []).find((block) => block.start_date <= today && block.end_date >= today) ?? blocks?.[0];
  const [from, to] = windowFor(view, today, currentBlock);
  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, scheduled_date, sport, title, objective, duration_min, intensity, expected_load, importance, recovery_hours, status, why_text, zones, workout_exercises(sort_order, set_count, reps, why_text, exercise_library(name))")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
    .order("scheduled_date");

  return (
    <PageFrame eyebrow="Training plan" title={plan?.name ?? "No active plan"} lede={plan?.explanation}>
      <div className="sticky top-16 z-20 -mx-4 flex flex-wrap gap-2 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur md:top-0">
        {["today", "week", "month", "block"].map((item) => (
          <Link key={item} className={`btn min-h-10 ${view === item ? "btn-primary" : "btn-ghost"}`} href={`/plan?view=${item}`}>{item}</Link>
        ))}
        <form action={async () => { "use server"; await generatePlan(); }}>
          <button className="btn btn-gold min-h-10" type="submit">Rebuild plan</button>
        </form>
      </div>
      {view === "block" ? (
        <ul className="grid gap-2">
          {(blocks ?? []).map((block) => (
            <li key={block.id} className="app-card p-4">
              <p className="eyebrow">{block.phase}</p>
              <h2 className="font-bold">{block.name}</h2>
              <p className="text-sm text-muted">{block.start_date} → {block.end_date}. {block.focus}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {(workouts ?? []).length === 0 && view !== "week" ? (
        <EmptyState title="This view is empty." body="Finish onboarding or rebuild the plan. Tamreen writes the plan from your sports, goal, and event date." href="/onboarding" action="Complete onboarding" />
      ) : (
        <div className="grid gap-4">
          {groupDates(view, from, to, today, workouts ?? []).map((date) => {
            const rows = (workouts ?? []).filter((workout) => workout.scheduled_date === date);
            return (
              <section key={date} id={date} className={`grid gap-3 rounded-3xl p-3 ${date === today ? "bg-maroon/10 ring-2 ring-maroon" : ""}`}>
                <h2 className="px-1 text-lg font-extrabold">{dayLabel(date, today)}</h2>
                {rows.length === 0 ? <p className="px-1 text-sm text-muted">Rest. Nothing is scheduled.</p> : null}
                {rows.map((workout) => (
                  <article key={workout.id} className="app-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`chip sport-${workout.sport}`}>{sportLabel(workout.sport)}</span>
                      <span className="metric text-sm">{formatDuration(workout.duration_min)} · {workout.intensity}</span>
                    </div>
                    <h3 className="mt-2 text-2xl font-bold">{workout.title}</h3>
                    <p className="text-sm">{workout.objective}</p>
                    <p className="mt-2 text-sm text-muted">{workout.why_text}</p>
                    <p className="mt-2 text-xs uppercase tracking-wide text-muted">Load {workout.expected_load} · {workout.importance} · recovery {workout.recovery_hours}h · {workout.status}</p>
                    <ExerciseList rows={workout.workout_exercises} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link className="btn btn-primary" href={`/train/${workout.id}`}>Start</Link>
                    </div>
                    <WorkoutControls id={workout.id} date={workout.scheduled_date} />
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </PageFrame>
  );
}

function ExerciseList({ rows }: { rows: Array<{ sort_order: number; set_count: number; reps: string; why_text: string; exercise_library: { name: string } | { name: string }[] | null }> | null }) {
  if (!rows?.length) return null;
  return (
    <ul className="mt-3 grid gap-2">
      {rows.map((row) => {
        const library = Array.isArray(row.exercise_library) ? row.exercise_library[0] : row.exercise_library;
        return (
          <li key={`${library?.name}-${row.sort_order}`} className="rounded-xl bg-paper px-3 py-2 text-sm">
            <span className="font-bold">{library?.name ?? "Exercise"}</span> · {row.set_count} × {row.reps}
            {row.why_text ? <span className="block text-muted">{row.why_text}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function groupDates(
  view: string,
  from: string,
  to: string,
  today: string,
  workouts: Array<{ scheduled_date: string }>,
): string[] {
  if (view === "week" || view === "today") {
    const dates: string[] = [];
    let cursor = from;
    while (cursor <= to && dates.length < 14) {
      dates.push(cursor);
      cursor = shiftIsoDate(cursor, 1);
    }
    return dates.length ? dates : [today];
  }
  return [...new Set(workouts.map((workout) => workout.scheduled_date))];
}

function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function windowFor(
  view: string,
  today: string,
  block: { start_date: string; end_date: string } | undefined,
): [string, string] {
  if (view === "today") return [today, today];
  if (view === "block" && block) return [block.start_date, block.end_date];
  if (view === "month") {
    const start = `${today.slice(0, 7)}-01`;
    const end = new Date(`${start}T00:00:00Z`);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
    return [start, end.toISOString().slice(0, 10)];
  }
  const date = new Date(`${today}T00:00:00Z`);
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)];
}
