import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/page";
import { StrengthLogger, type LoggerExercise } from "@/features/strength/logger";
import { sportLabel } from "@/lib/utils";
import { requireUser } from "@/server/guard";
import { poseSlugFor } from "@/services/live/pose";

export default async function TrainPage({ params }: { params: Promise<{ workoutId: string }> }) {
  const { workoutId } = await params;
  const { supabase, user } = await requireUser();
  const { data: workout } = await supabase
    .from("workouts")
    .select("id, sport, title, objective, duration_min, intensity, why_text, status, workout_exercises(exercise_id, sort_order, set_count, reps, why_text, exercise_library(slug, name))")
    .eq("id", workoutId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!workout) notFound();
  const { data: settings } = await supabase.from("user_settings").select("weight_unit").eq("user_id", user.id).maybeSingle();
  const { data: history } = await supabase
    .from("completed_workouts")
    .select("started_at, completed_sets(exercise_name, reps, weight_kg, is_warmup)")
    .eq("user_id", user.id)
    .eq("sport", "strength")
    .order("started_at", { ascending: false })
    .limit(12);
  const last = new Map<string, { weightKg: number; reps: number }>();
  for (const session of history ?? []) {
    for (const set of session.completed_sets ?? []) {
      if (set.is_warmup || last.has(set.exercise_name) || set.weight_kg == null || set.reps == null) continue;
      last.set(set.exercise_name, { weightKg: Number(set.weight_kg), reps: set.reps });
    }
  }
  const exercises: LoggerExercise[] = (workout.workout_exercises ?? []).map((row) => {
    const library = Array.isArray(row.exercise_library) ? row.exercise_library[0] : row.exercise_library;
    const name = library?.name ?? "Exercise";
    const librarySlug = library && "slug" in library ? library.slug : null;
    return {
      id: row.exercise_id,
      name,
      sets: row.set_count,
      reps: row.reps,
      why: row.why_text,
      last: last.get(name) ?? null,
      cameraHref: librarySlug && poseSlugFor(librarySlug) ? `/live/${librarySlug}?workout=${workout.id}` : null,
    };
  });
  const strength = workout.sport === "strength" || workout.sport === "bodybuilding";

  return (
    <PageFrame eyebrow={sportLabel(workout.sport)} title={workout.title} lede={workout.why_text}>
      <p className="text-sm text-muted">{workout.duration_min} min · {workout.intensity} · {workout.status}</p>
      <p>{workout.objective}</p>
      {strength ? (
        <StrengthLogger
          workoutId={workout.id}
          title={workout.title}
          exercises={exercises.length ? exercises : [{ id: null, name: workout.title, sets: 3, reps: "5", why: workout.why_text, last: last.get(workout.title) ?? null, cameraHref: null }]}
          weightUnit={settings?.weight_unit === "lb" ? "lb" : "kg"}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {workout.sport === "running" || workout.sport === "brick" ? <Link className="btn btn-primary" href={`/log/run?workout=${workout.id}&title=${encodeURIComponent(workout.title)}`}>Log run</Link> : null}
          {workout.sport === "cycling" || workout.sport === "brick" ? <Link className="btn btn-primary" href={`/log/ride?workout=${workout.id}&title=${encodeURIComponent(workout.title)}`}>Log ride</Link> : null}
          {workout.sport === "swimming" ? <Link className="btn btn-primary" href={`/log/swim?workout=${workout.id}&title=${encodeURIComponent(workout.title)}`}>Log swim</Link> : null}
          {workout.sport === "mobility" || workout.sport === "recovery" ? <Link className="btn btn-primary" href="/recovery">Log recovery</Link> : null}
        </div>
      )}
    </PageFrame>
  );
}
