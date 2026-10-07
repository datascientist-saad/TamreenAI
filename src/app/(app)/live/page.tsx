import Link from "next/link";
import { PageFrame } from "@/components/page";
import { EmptyState } from "@/components/states";
import { shiftIsoDate, sportLabel, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";
import { poseSlugFor } from "@/services/live/pose";

interface LibraryExercise {
  slug: string;
  name: string;
}

interface PlannedExercise {
  sort_order: number;
  set_count: number;
  reps: string;
  exercise_library: LibraryExercise | LibraryExercise[] | null;
}

interface PlannedWorkout {
  id: string;
  scheduled_date: string;
  title: string;
  sport: string;
  duration_min: number;
  status: string;
  workout_exercises: PlannedExercise[] | null;
}

export default async function LiveIndexPage() {
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const weekMonday = shiftIsoDate(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const until = shiftIsoDate(today, 13);
  const [{ data: planned }, { data: recent }] = await Promise.all([
    supabase
      .from("workouts")
      .select("id, scheduled_date, title, sport, duration_min, status, workout_exercises(sort_order, set_count, reps, exercise_library(slug, name))")
      .eq("user_id", user.id)
      .in("sport", ["strength", "bodybuilding"])
      .gte("scheduled_date", weekMonday)
      .lte("scheduled_date", until)
      .is("deleted_at", null)
      .neq("status", "skipped")
      .order("scheduled_date"),
    supabase
      .from("live_training_sessions")
      .select("id, exercise_slug, started_at, manual_reps, analysis_source")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(5),
  ]);
  const workouts = (planned ?? []) as PlannedWorkout[];
  const upcoming = workouts.filter((workout) => workout.scheduled_date >= today);
  const earlier = workouts.filter((workout) => workout.scheduled_date < today);

  return (
    <PageFrame eyebrow="Live training" title="Camera session" lede="The camera opens the strength exercises already on your plan. Reps update when your body is visible. Movements the camera cannot score stay on the workout so you can log the sets.">
      {workouts.length === 0 ? (
        <EmptyState title="No strength session is on the plan." body="Live camera follows the strength and hypertrophy sessions Tamreen scheduled. Open the plan to see the week, or finish onboarding if the plan is still empty." href="/plan" action="Open plan" />
      ) : (
        <div className="grid gap-4">
          {upcoming.map((workout) => (
            <section key={workout.id} className={`grid gap-2 rounded-3xl p-3 ${workout.scheduled_date === today ? "bg-maroon/10 ring-2 ring-maroon" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div>
                  <p className="eyebrow">{workout.scheduled_date === today ? "Today" : workout.scheduled_date}</p>
                  <h2 className="text-xl font-extrabold">{workout.title}</h2>
                </div>
                <span className="text-sm text-muted">{sportLabel(workout.sport)} · {workout.duration_min} min</span>
              </div>
              <ExerciseRows workout={workout} />
            </section>
          ))}
          {earlier.length ? <h2 className="font-bold">Earlier this week</h2> : null}
          {earlier.map((workout) => (
            <section key={workout.id} className="grid gap-2 rounded-3xl p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div>
                  <p className="eyebrow">{workout.scheduled_date}</p>
                  <h2 className="text-xl font-extrabold">{workout.title}</h2>
                </div>
                <span className="text-sm text-muted">{sportLabel(workout.sport)} · {workout.duration_min} min</span>
              </div>
              <ExerciseRows workout={workout} />
            </section>
          ))}
        </div>
      )}
      <section>
        <h2 className="font-bold">Recent</h2>
        <ul className="mt-2 grid gap-2">
          {(recent ?? []).map((session) => (
            <li key={session.id}>
              <Link href={`/live/report/${session.id}`}>{session.exercise_slug.replaceAll("_", " ")} · {session.manual_reps ?? 0} reps · {session.analysis_source}</Link>
            </li>
          ))}
        </ul>
      </section>
    </PageFrame>
  );
}

function ExerciseRows({ workout }: { workout: PlannedWorkout }) {
  const rows = sortedExercises(workout.workout_exercises);
  if (!rows.length) {
    return <p className="px-1 text-sm text-muted">No lifts are written on this session. <Link className="font-bold" href={`/train/${workout.id}`}>Open the workout</Link></p>;
  }
  return (
    <ul className="grid gap-2">
      {rows.map((exercise) => {
        const library = one(exercise.exercise_library);
        const slug = library?.slug ?? "";
        const camera = Boolean(slug && poseSlugFor(slug));
        return (
          <li key={`${workout.id}-${slug || exercise.sort_order}`}>
            {camera ? (
              <Link className="app-card flex items-center justify-between gap-3 px-4 py-3" href={`/live/${slug}?workout=${workout.id}`}>
                <span>
                  <span className="block font-bold">{library?.name}</span>
                  <span className="text-sm text-muted">{exercise.set_count} sets × {exercise.reps}</span>
                </span>
                <span className="text-sm font-bold">Camera</span>
              </Link>
            ) : (
              <div className="app-card flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block font-bold">{library?.name ?? "Exercise"}</span>
                  <span className="text-sm text-muted">{exercise.set_count} sets × {exercise.reps}. The camera does not score this movement.</span>
                </span>
                <Link className="text-sm font-bold" href={`/train/${workout.id}`}>Log sets</Link>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function sortedExercises(rows: PlannedExercise[] | null): PlannedExercise[] {
  return [...(rows ?? [])].sort((left, right) => left.sort_order - right.sort_order);
}

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}
