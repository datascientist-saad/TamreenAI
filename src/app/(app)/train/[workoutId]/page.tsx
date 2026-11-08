import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/page";
import { StrengthLogger, type LoggerExercise } from "@/features/strength/logger";
import { sportLabel, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";
import { liveSlugForLibrary } from "@/services/live/catalog";

export default async function TrainPage({ params }: { params: Promise<{ workoutId: string }> }) {
  const { workoutId } = await params;
  const { supabase, user } = await requireUser();
  const [{ data: workout }, { data: settings }, { data: history }, { data: athlete }] = await Promise.all([
    supabase
      .from("workouts")
      .select("id, scheduled_date, sport, title, objective, duration_min, intensity, why_text, status, workout_exercises(exercise_id, sort_order, set_count, reps, why_text, notes, exercise_library(name, slug, live_supported))")
      .eq("id", workoutId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("user_settings").select("weight_unit").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("completed_workouts")
      .select("started_at, completed_sets(exercise_name, reps, weight_kg, is_warmup)")
      .eq("user_id", user.id)
      .eq("sport", "strength")
      .order("started_at", { ascending: false })
      .limit(12),
    supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!workout) notFound();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const last = new Map<string, { weightKg: number; reps: number }>();
  for (const session of history ?? []) {
    for (const set of session.completed_sets ?? []) {
      if (set.is_warmup || last.has(set.exercise_name) || set.weight_kg == null || set.reps == null) continue;
      last.set(set.exercise_name, { weightKg: Number(set.weight_kg), reps: set.reps });
    }
  }
  const exercises: LoggerExercise[] = (workout.workout_exercises ?? []).map((row) => {
    const library = Array.isArray(row.exercise_library) ? row.exercise_library[0] : row.exercise_library;
    const name = library?.name || row.notes?.trim() || "Exercise";
    return {
      id: row.exercise_id,
      name,
      sets: row.set_count,
      reps: row.reps,
      why: row.why_text,
      last: last.get(name) ?? null,
    };
  });
  const strength = workout.sport === "strength" || workout.sport === "bodybuilding";
  const cameras = workout.scheduled_date === today
    ? (workout.workout_exercises ?? []).flatMap((row) => {
      const library = Array.isArray(row.exercise_library) ? row.exercise_library[0] : row.exercise_library;
      const slug = library?.slug ? liveSlugForLibrary(library.slug, Boolean(library.live_supported)) : null;
      if (!slug) return [];
      return [{ slug, name: library?.name || row.notes?.trim() || "Exercise" }];
    })
    : [];

  return (
    <PageFrame eyebrow={sportLabel(workout.sport)} title={workout.title} lede={workout.why_text}>
      <p className="text-sm text-muted">{workout.duration_min} min · {workout.intensity} · {workout.status}</p>
      <p>{workout.objective}</p>
      {!strength && exercises.length ? (
        <ul className="grid gap-2">
          {exercises.map((exercise) => (
            <li key={`${exercise.name}-${exercise.reps}`} className="rounded-xl bg-paper px-3 py-2 text-sm">
              <span className="font-bold">{exercise.name}</span> · {exercise.sets} × {exercise.reps}
              {exercise.why ? <span className="block text-muted">{exercise.why}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {strength ? (
        <StrengthLogger
          workoutId={workout.id}
          title={workout.title}
          exercises={exercises.length ? exercises : [{ id: null, name: workout.title, sets: 3, reps: "5", why: workout.why_text, last: last.get(workout.title) ?? null }]}
          weightUnit={settings?.weight_unit === "lb" ? "lb" : "kg"}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {workout.sport === "running" || workout.sport === "brick" ? <Link className="btn btn-primary" href={`/log/run?workout=${workout.id}&title=${encodeURIComponent(workout.title)}&intensity=${encodeURIComponent(workout.intensity)}`}>Log run</Link> : null}
          {workout.sport === "cycling" || workout.sport === "brick" ? <Link className="btn btn-primary" href={`/log/ride?workout=${workout.id}&title=${encodeURIComponent(workout.title)}`}>Log ride</Link> : null}
          {workout.sport === "swimming" ? <Link className="btn btn-primary" href={`/log/swim?workout=${workout.id}&title=${encodeURIComponent(workout.title)}`}>Log swim</Link> : null}
          {workout.sport === "mobility" || workout.sport === "recovery" ? <Link className="btn btn-primary" href="/recovery">Log recovery</Link> : null}
        </div>
      )}
      {cameras.length ? (
        <div className="grid gap-2">
          {cameras.map((exercise) => (
            <Link key={`${exercise.slug}-${exercise.name}`} className="btn btn-ghost" href={`/live/${exercise.slug}?workout=${workout.id}`}>Open camera · {exercise.name}</Link>
          ))}
        </div>
      ) : null}
      {workout.scheduled_date !== today && strength ? <p className="text-sm text-muted">The live camera opens on the day this session is scheduled.</p> : null}
    </PageFrame>
  );
}
