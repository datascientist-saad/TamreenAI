import Link from "next/link";
import { PageFrame } from "@/components/page";
import { EmptyState } from "@/components/states";
import { formatDuration, sportLabel } from "@/lib/utils";
import { loadTodayLivePlan } from "@/server/live-plan";

export default async function LiveIndexPage({ searchParams }: { searchParams: Promise<{ workout?: string }> }) {
  const { workout: focus } = await searchParams;
  const { supabase, user, workouts } = await loadTodayLivePlan();
  const { data: recent } = await supabase
    .from("live_training_sessions")
    .select("id, exercise_slug, started_at, manual_reps, analysis_source")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(5);
  const visible = focus ? workouts.filter((workout) => workout.id === focus) : workouts;
  const shown = visible.length ? visible : workouts;

  return (
    <PageFrame
      eyebrow="Live training"
      title="Today's workout"
      lede="The camera opens only for movements on today's plan that it can follow. A run, ride, or swim stays on the workout page."
    >
      {shown.length === 0 ? (
        <EmptyState title="Nothing is scheduled today." body="When today's plan includes a tracked strength movement, the camera opens here for that movement." href="/plan" action="Open plan" />
      ) : (
        <ul className="grid gap-3">
          {shown.map((workout) => {
            const cameras = workout.exercises.filter((exercise) => exercise.liveSlug);
            return (
              <li key={workout.id} className="app-card grid gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`chip sport-${workout.sport}`}>{sportLabel(workout.sport)}</span>
                  <span className="metric text-sm">{formatDuration(workout.durationMin)}</span>
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold">{workout.title}</h2>
                  {workout.objective ? <p className="mt-1 text-sm">{workout.objective}</p> : null}
                  {workout.why ? <p className="mt-2 text-sm text-muted">{workout.why}</p> : null}
                </div>
                {workout.exercises.length ? (
                  <ul className="grid gap-2">
                    {workout.exercises.map((exercise) => (
                      <li key={`${exercise.name}-${exercise.reps}`} className="rounded-xl bg-paper px-3 py-2 text-sm">
                        <span className="font-bold">{exercise.name}</span> · {exercise.sets} × {exercise.reps}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {cameras.length ? (
                  <div className="grid gap-2">
                    {cameras.map((exercise) => (
                      <Link key={`${exercise.liveSlug}-${exercise.name}`} className="btn btn-primary" href={`/live/${exercise.liveSlug}?workout=${workout.id}`}>
                        Open camera · {exercise.name}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">This session has no camera movement. Log it from the workout.</p>
                )}
                <Link className="btn btn-ghost w-fit" href={`/train/${workout.id}`}>Open workout</Link>
              </li>
            );
          })}
        </ul>
      )}
      <section>
        <h2 className="font-bold">Recent</h2>
        <ul className="mt-2 grid gap-2">
          {(recent ?? []).length === 0 ? <li className="text-sm text-muted">No camera sessions yet.</li> : null}
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
