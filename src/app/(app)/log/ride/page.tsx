import { PageFrame } from "@/components/page";
import { RideForm } from "@/features/endurance/log-forms";

export default async function LogRidePage({ searchParams }: { searchParams: Promise<{ workout?: string; title?: string }> }) {
  const query = await searchParams;
  return (
    <PageFrame eyebrow="Cycling" title="Log a ride" lede="Power, normalized power, and FTP are optional. A missing power meter stays blank.">
      <RideForm workoutId={query.workout ?? null} title={query.title ?? "Ride"} />
    </PageFrame>
  );
}
