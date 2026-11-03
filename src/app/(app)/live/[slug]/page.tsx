import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/page";
import { LiveSession } from "@/features/live/session";
import { LIVE_EXERCISES } from "@/services/live/pose";
import { loadTodayLivePlan } from "@/server/live-plan";

export default async function LiveExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ workout?: string }>;
}) {
  const { slug } = await params;
  const { workout: workoutId } = await searchParams;
  const exercise = LIVE_EXERCISES.find((item) => item.slug === slug);
  if (!exercise) notFound();
  const { workouts } = await loadTodayLivePlan();
  const matches = workouts.flatMap((workout) => workout.exercises
    .filter((item) => item.liveSlug === slug)
    .map((item) => ({ ...item, workoutId: workout.id, workoutTitle: workout.title })));
  const prescription = (workoutId ? matches.find((item) => item.workoutId === workoutId) : null) ?? matches[0];

  if (!prescription) {
    return (
      <PageFrame eyebrow="Live" title="Camera stays with today" lede="The camera opens only for a movement on the plan for today.">
        <p>This movement is not part of the workout for today, so the camera stays off.</p>
        <Link className="btn btn-primary w-fit" href="/live">Back to today</Link>
      </PageFrame>
    );
  }

  return (
    <PageFrame eyebrow="Live · today" title={prescription.name} lede={`${prescription.workoutTitle}. ${exercise.setup}`}>
      <LiveSession
        slug={slug}
        prescription={{
          workoutTitle: prescription.workoutTitle,
          name: prescription.name,
          sets: prescription.sets,
          reps: prescription.reps,
        }}
      />
      <Link className="text-sm font-bold" href="/live">Workout for today</Link>
    </PageFrame>
  );
}
