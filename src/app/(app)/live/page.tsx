import Link from "next/link";
import { PageFrame } from "@/components/page";
import { LIVE_EXERCISES } from "@/services/live/pose";
import { requireUser } from "@/server/guard";

export default async function LiveIndexPage() {
  const { supabase, user } = await requireUser();
  const { data: recent } = await supabase
    .from("live_training_sessions")
    .select("id, exercise_slug, started_at, manual_reps, analysis_source")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(5);
  return (
    <PageFrame eyebrow="Live training" title="Camera session" lede="The pose model runs on this device. Reps update from the camera when your body is visible, and you can still count them yourself. Form scores stay blank when the view is too short or the body leaves the frame.">
      <ul className="grid gap-2">
        {LIVE_EXERCISES.map((exercise) => (
          <li key={exercise.slug}>
            <Link className="app-card flex items-center justify-between px-4 py-3" href={`/live/${exercise.slug}`}>
              <span className="font-bold">{exercise.name}</span>
              <span className="text-sm text-muted">Set up</span>
            </Link>
          </li>
        ))}
      </ul>
      <section>
        <h2 className="font-bold">Recent</h2>
        <ul className="mt-2 grid gap-2">
          {(recent ?? []).map((session) => (
            <li key={session.id}>
              <Link href={`/live/report/${session.id}`}>{session.exercise_slug} · {session.manual_reps ?? 0} manual reps · {session.analysis_source}</Link>
            </li>
          ))}
        </ul>
      </section>
    </PageFrame>
  );
}
