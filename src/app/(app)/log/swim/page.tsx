import { PageFrame } from "@/components/page";
import { SwimForm } from "@/features/endurance/log-forms";

export default async function LogSwimPage({ searchParams }: { searchParams: Promise<{ workout?: string; title?: string }> }) {
  const query = await searchParams;
  return (
    <PageFrame eyebrow="Swimming" title="Log a swim" lede="Pace per 100 m is calculated from the distance and time you enter. SWOLF is saved only when you provide it.">
      <SwimForm workoutId={query.workout ?? null} title={query.title ?? "Swim"} />
    </PageFrame>
  );
}
