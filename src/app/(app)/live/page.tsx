import Link from "next/link";
import { Camera, ChevronRight } from "lucide-react";
import { PageFrame } from "@/components/page";
import { EmptyState } from "@/components/ui/empty-state";
import { SportIcon } from "@/components/ui/sport-icon";
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
      title="Live camera"
      lede="Camera opens only for movements on today's plan that it can track."
      compact
      actions={<Link className="btn btn-ghost btn-sm" href="/train">Train hub</Link>}
    >
      {shown.length === 0 ? (
        <EmptyState
          title="Nothing camera-ready today"
          body="When today's plan includes a tracked strength movement, open it here."
          href="/plan"
          action="Open plan"
          icon={Camera}
        />
      ) : (
        <ul className="grid gap-3">
          {shown.map((workout) => {
            const cameras = workout.exercises.filter((exercise) => exercise.liveSlug);
            return (
              <li key={workout.id} className="app-card grid gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-maroon-soft text-maroon">
                    <SportIcon sport={workout.sport} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`chip sport-${workout.sport}`}>{sportLabel(workout.sport)}</span>
                      <span className="metric caption">{formatDuration(workout.durationMin)}</span>
                    </div>
                    <h2 className="mt-1 text-lg font-bold">{workout.title}</h2>
                  </div>
                </div>
                {cameras.length ? (
                  <div className="grid gap-2">
                    {cameras.map((exercise) => (
                      <Link
                        key={`${exercise.liveSlug}-${exercise.name}`}
                        className="btn btn-primary justify-between"
                        href={`/live/${exercise.liveSlug}?workout=${workout.id}`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Camera size={16} strokeWidth={1.75} aria-hidden />
                          {exercise.name}
                        </span>
                        <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">No camera movement in this session. Log it from the workout.</p>
                )}
                <Link className="btn btn-ghost btn-sm w-fit" href={`/train/${workout.id}`}>Open workout</Link>
              </li>
            );
          })}
        </ul>
      )}

      <section className="grid gap-2">
        <h2 className="section-title">Exercise analysis</h2>
        <ul className="app-card divide-y divide-line">
          {(recent ?? []).length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No camera sessions yet.</li>
          ) : null}
          {(recent ?? []).map((session) => (
            <li key={session.id}>
              <Link href={`/live/report/${session.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span>
                  <span className="block font-semibold capitalize">{session.exercise_slug.replaceAll("_", " ")}</span>
                  <span className="caption">{session.analysis_source}</span>
                </span>
                <span className="metric caption">{session.manual_reps ?? 0} reps</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageFrame>
  );
}
