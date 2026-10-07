import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/page";
import { LiveSession } from "@/features/live/session";
import { LIVE_EXERCISES } from "@/services/live/pose";

export default async function LiveExercisePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exercise = LIVE_EXERCISES.find((item) => item.slug === slug);
  if (!exercise) notFound();
  return (
    <PageFrame eyebrow="Live" title={exercise.name} lede={exercise.setup}>
      <LiveSession slug={slug} />
      <Link className="text-sm font-bold" href="/live">All exercises</Link>
    </PageFrame>
  );
}
