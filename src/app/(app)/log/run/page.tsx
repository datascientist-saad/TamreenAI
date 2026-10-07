import { PageFrame } from "@/components/page";
import { RunForm } from "@/features/endurance/log-forms";

export default async function LogRunPage({ searchParams }: { searchParams: Promise<{ workout?: string; title?: string }> }) {
  const query = await searchParams;
  return (
    <PageFrame eyebrow="Running" title="Log a run" lede="Pace, splits, and heart rate are stored as you enter them. The analysis page only scores fields that exist.">
      <RunForm workoutId={query.workout ?? null} title={query.title ?? "Run"} />
    </PageFrame>
  );
}
