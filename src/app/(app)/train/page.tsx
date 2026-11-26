import Link from "next/link";
import {
  Camera,
  ClipboardList,
  Dumbbell,
  Footprints,
  Bike,
  Waves,
  Scan,
  Sparkles,
} from "lucide-react";
import { PageFrame } from "@/components/page";
import { ResumeWorkoutBanner } from "@/components/resume-workout";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkoutCard } from "@/components/ui/workout-card";
import { SportIcon } from "@/components/ui/sport-icon";
import { withReturnTo } from "@/lib/navigation";
import { todayInTimeZone, formatDuration, sportLabel } from "@/lib/utils";
import { requireUser } from "@/server/guard";
import { workoutHasLiveCamera } from "@/services/live/catalog";

export default async function TrainHubPage() {
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");

  const [{ data: todayWorkouts }, { data: recentLive }, { data: recentCompleted }] = await Promise.all([
    supabase
      .from("workouts")
      .select("id, sport, title, duration_min, intensity, objective, status, workout_exercises(exercise_library(slug, live_supported))")
      .eq("user_id", user.id)
      .eq("scheduled_date", today)
      .is("deleted_at", null)
      .order("importance"),
    supabase
      .from("live_training_sessions")
      .select("id, exercise_slug, started_at, manual_reps")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(3),
    supabase
      .from("completed_workouts")
      .select("id, sport, title, started_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(3),
  ]);

  const planned = todayWorkouts ?? [];
  const next = planned.find((w) => w.status !== "completed") ?? planned[0];
  const cameraReady = planned.some((w) => workoutHasLiveCamera(w.workout_exercises));

  return (
    <PageFrame
      title="Train"
      lede="Live camera, manual logging, and recent sessions."
      compact
      width="wide"
    >
      <ResumeWorkoutBanner />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
      <div className="grid gap-4">
      {next ? (
        <section className="grid gap-3">
          <h2 className="section-title">Recommended</h2>
          <WorkoutCard
            id={next.id}
            sport={next.sport}
            title={next.title}
            durationMin={next.duration_min}
            intensity={next.intensity}
            status={next.status}
            objective={next.objective}
            href={withReturnTo(`/train/${next.id}`, "/train")}
            actionLabel={next.status === "completed" ? "View session" : "Start planned workout"}
          />
        </section>
      ) : (
        <EmptyState
          title="No planned session today"
          body="Log an activity, open live camera, or review the week on Plan."
          href="/train#log"
          action="Log an activity"
          icon={Dumbbell}
        />
      )}

      <section className="grid gap-2">
        <h2 className="section-title">Start</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2">
          <HubLink
            href={next ? `/train/${next.id}` : "/plan"}
            icon={Dumbbell}
            title="Planned workout"
            hint={next ? next.title : "Nothing scheduled"}
            primary
          />
          <HubLink
            href="/live"
            icon={Camera}
            title="Live camera"
            hint={cameraReady ? "Camera-ready movement on today's plan" : "Open when a tracked lift is scheduled"}
          />
          <HubLink
            href="/live"
            icon={Scan}
            title="Exercise analysis"
            hint="Review recent camera sessions"
          />
          <HubLink
            href="#log"
            icon={ClipboardList}
            title="Log activity"
            hint="Run, ride, swim, or free strength"
          />
        </div>
      </section>

      {planned.length > 1 ? (
        <section className="grid gap-2">
          <h2 className="section-title">Also today</h2>
          <ul className="app-card divide-y divide-line px-2 py-1">
            {planned.filter((w) => w.id !== next?.id).map((workout) => (
              <li key={workout.id}>
                <Link
                  href={`/train/${workout.id}`}
                  className="flex min-h-12 items-center gap-3 px-2 py-2.5"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-maroon-soft text-maroon">
                    <SportIcon sport={workout.sport} size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{workout.title}</span>
                    <span className="caption">
                      {sportLabel(workout.sport)}
                      {workout.duration_min != null ? ` · ${formatDuration(workout.duration_min)}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section id="log" className="grid gap-2 scroll-mt-24">
        <h2 className="section-title">Log</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <LogChip href="/log/run" icon={Footprints} label="Run" />
          <LogChip href="/log/ride" icon={Bike} label="Ride" />
          <LogChip href="/log/swim" icon={Waves} label="Swim" />
          <LogChip href="/ai" icon={Sparkles} label="Ask coach" />
        </div>
      </section>
      </div>

      {(recentLive ?? []).length || (recentCompleted ?? []).length ? (
        <section className="grid gap-2 lg:sticky lg:top-4">
          <h2 className="section-title">Recent</h2>
          <ul className="app-card divide-y divide-line">
            {(recentLive ?? []).map((session) => (
              <li key={session.id}>
                <Link href={`/live/report/${session.id}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="font-semibold capitalize">{session.exercise_slug.replaceAll("_", " ")}</span>
                  <span className="caption">{session.manual_reps ?? 0} reps</span>
                </Link>
              </li>
            ))}
            {(recentCompleted ?? []).map((session) => (
              <li key={session.id} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="font-semibold">{session.title || sportLabel(session.sport)}</span>
                <span className="caption">{new Date(session.started_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="hidden lg:grid lg:gap-2">
          <h2 className="section-title">Recent</h2>
          <p className="app-card p-4 text-sm text-muted">Completed camera and logged sessions will show here.</p>
        </section>
      )}
      </div>
    </PageFrame>
  );
}

function HubLink({
  href,
  icon: Icon,
  title,
  hint,
  primary = false,
}: {
  href: string;
  icon: typeof Dumbbell;
  title: string;
  hint: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "app-card flex items-start gap-3 border-maroon/30 p-4 transition-colors hover:bg-maroon-soft"
          : "app-card flex items-start gap-3 p-4 transition-colors hover:bg-elevated"
      }
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-maroon-soft text-maroon">
        <Icon size={18} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-bold">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{hint}</span>
      </span>
    </Link>
  );
}

function LogChip({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Footprints;
  label: string;
}) {
  return (
    <Link href={href} className="app-card flex min-h-12 items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold hover:bg-elevated">
      <Icon size={16} strokeWidth={1.75} className="text-maroon" aria-hidden />
      {label}
    </Link>
  );
}
