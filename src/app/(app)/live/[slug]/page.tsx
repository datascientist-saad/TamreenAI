import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/page";
import { LiveSession } from "@/features/live/session";
import { requireUser } from "@/server/guard";
import { resolvePlanExercise } from "@/services/live/pose";

export default async function LiveExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ workout?: string }>;
}) {
  const { slug } = await params;
  const { workout: workoutId } = await searchParams;
  const resolved = resolvePlanExercise(slug);
  if (!resolved) notFound();
  const { supabase, user } = await requireUser();
  const { data: library } = await supabase.from("exercise_library").select("name").eq("slug", slug).maybeSingle();
  const name = library?.name || resolved.name;
  const prescription = await prescriptionFor(supabase, user.id, workoutId, slug);

  return (
    <PageFrame eyebrow={prescription ? `From ${prescription.workoutTitle}` : "Live"} title={name} lede={resolved.setup}>
      {prescription ? <p className="text-sm text-muted">{prescription.date} · {prescription.sets} sets × {prescription.reps}</p> : null}
      <LiveSession
        slug={slug}
        poseSlug={resolved.poseSlug}
        name={name}
        prescription={prescription ? { sets: prescription.sets, reps: prescription.reps, why: prescription.why } : null}
      />
      <Link className="text-sm font-bold" href={prescription ? `/train/${workoutId}` : "/live"}>{prescription ? "Back to this workout" : "Plan exercises"}</Link>
    </PageFrame>
  );
}

async function prescriptionFor(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  workoutId: string | undefined,
  slug: string,
): Promise<{ workoutTitle: string; date: string; sets: number; reps: string; why: string } | null> {
  if (!workoutId) return null;
  const { data: workout } = await supabase
    .from("workouts")
    .select("title, scheduled_date, workout_exercises(set_count, reps, why_text, exercise_library(slug))")
    .eq("id", workoutId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!workout) return null;
  const row = (workout.workout_exercises ?? []).find((exercise) => {
    const library = Array.isArray(exercise.exercise_library) ? exercise.exercise_library[0] : exercise.exercise_library;
    return library?.slug === slug;
  });
  if (!row) return null;
  return {
    workoutTitle: workout.title,
    date: workout.scheduled_date,
    sets: row.set_count,
    reps: row.reps,
    why: row.why_text,
  };
}
