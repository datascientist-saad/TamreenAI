import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { PageFrame } from "@/components/page";
import { SportIcon } from "@/components/ui/sport-icon";
import { StrengthLogger, type LoggerExercise } from "@/features/strength/logger";
import { sanitizeReturnTo } from "@/lib/navigation";
import { formatDuration, intensityLabel, sportLabel, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";
import { liveSlugForLibrary } from "@/services/live/catalog";

export default async function TrainPage({
  params,
  searchParams,
}: {
  params: Promise<{ workoutId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { workoutId } = await params;
  const { from } = await searchParams;
  const returnTo = sanitizeReturnTo(from);
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
    <PageFrame
      title={workout.title}
      compact
      actions={<BackLink from={returnTo} kind="workout" />}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`chip sport-${workout.sport} inline-flex items-center gap-1`}>
          <SportIcon sport={workout.sport} size={12} />
          {sportLabel(workout.sport)}
        </span>
        <span className={`chip status-${workout.status}`}>{workout.status}</span>
        <span className="metric text-sm text-muted">
          {workout.duration_min != null ? formatDuration(workout.duration_min) : "—"}
          {workout.intensity ? ` · ${intensityLabel(workout.intensity)}` : ""}
        </span>
      </div>

      {strength ? (
        <StrengthLogger
          workoutId={workout.id}
          title={workout.title}
          exercises={exercises.length ? exercises : [{ id: null, name: workout.title, sets: 3, reps: "5", why: workout.why_text, last: last.get(workout.title) ?? null }]}
          weightUnit={settings?.weight_unit === "lb" ? "lb" : "kg"}
        />
      ) : (
        <div className="grid gap-3">
          {exercises.length ? (
            <ul className="app-card divide-y divide-line">
              {exercises.map((exercise) => (
                <li key={`${exercise.name}-${exercise.reps}`} className="px-4 py-3">
                  <p className="font-bold">{exercise.name}</p>
                  <p className="metric text-sm text-muted">{exercise.sets} × {exercise.reps}</p>
                </li>
              ))}
            </ul>
          ) : workout.objective ? (
            <p className="app-card p-4 text-sm">{workout.objective}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {workout.sport === "running" || workout.sport === "brick" ? (
              <Link className="btn btn-primary" href={`/log/run?workout=${workout.id}&title=${encodeURIComponent(workout.title)}&intensity=${encodeURIComponent(workout.intensity)}`}>Log run</Link>
            ) : null}
            {workout.sport === "cycling" || workout.sport === "brick" ? (
              <Link className="btn btn-primary" href={`/log/ride?workout=${workout.id}&title=${encodeURIComponent(workout.title)}`}>Log ride</Link>
            ) : null}
            {workout.sport === "swimming" ? (
              <Link className="btn btn-primary" href={`/log/swim?workout=${workout.id}&title=${encodeURIComponent(workout.title)}`}>Log swim</Link>
            ) : null}
            {workout.sport === "mobility" || workout.sport === "recovery" ? (
              <Link className="btn btn-primary" href="/recovery">Log recovery</Link>
            ) : null}
          </div>
        </div>
      )}

      {cameras.length ? (
        <section className="grid gap-2">
          <h2 className="section-title">Live camera</h2>
          {cameras.map((exercise) => (
            <Link key={`${exercise.slug}-${exercise.name}`} className="btn btn-soft w-full justify-between" href={`/live/${exercise.slug}?workout=${workout.id}`}>
              <span className="inline-flex items-center gap-2">
                <Camera size={16} strokeWidth={1.75} aria-hidden />
                {exercise.name}
              </span>
              <span className="text-sm">Open</span>
            </Link>
          ))}
        </section>
      ) : null}

      {(workout.objective || workout.why_text) ? (
        <details className="app-card p-4">
          <summary className="cursor-pointer font-semibold">Why this workout</summary>
          <div className="mt-2 grid gap-2 text-sm text-muted">
            {workout.objective ? <p>{workout.objective}</p> : null}
            {workout.why_text ? <p>{workout.why_text}</p> : null}
          </div>
        </details>
      ) : null}

      {workout.scheduled_date !== today && strength ? (
        <p className="caption">Live camera opens on the day this session is scheduled.</p>
      ) : null}

      <Link className="text-sm font-bold text-maroon" href="/ai">Ask AI Coach about this session</Link>
    </PageFrame>
  );
}
