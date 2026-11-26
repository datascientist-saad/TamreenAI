import Link from "next/link";
import {
  Activity,
  Bike,
  ChartNoAxesCombined,
  Dumbbell,
  Footprints,
  Waves,
} from "lucide-react";
import { PageFrame } from "@/components/page";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { shiftIsoDate, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

const copy: Record<string, string> = {
  strength: "Strength uses squat, bench, and deadlift as multiples of body weight.",
  running: "Running compares logged or reported pace with the target for your primary goal.",
  cycling: "Cycling uses FTP and body weight when both exist.",
  swimming: "Swimming uses 100 m pace.",
  consistency: "Completed sessions divided by planned sessions in the recent window.",
  recovery: "From the latest check-in — omitted until you log one.",
  overall: "Averages dimensions that have inputs, with weight on the primary goal.",
};

const icons: Record<string, typeof Dumbbell> = {
  strength: Dumbbell,
  running: Footprints,
  cycling: Bike,
  swimming: Waves,
  consistency: ChartNoAxesCombined,
  recovery: Activity,
  overall: ChartNoAxesCombined,
};

export default async function ProgressPage() {
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const weekFrom = shiftIsoDate(today, -6);
  const [{ data: scores }, { data: weekWorkouts }] = await Promise.all([
    supabase
      .from("performance_scores")
      .select("dimension, score, explanation, scored_on, sample_size")
      .eq("user_id", user.id)
      .order("scored_on", { ascending: false })
      .limit(40),
    supabase
      .from("workouts")
      .select("status")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .gte("scheduled_date", weekFrom)
      .lte("scheduled_date", today)
      .limit(40),
  ]);
  const latest = new Map<string, NonNullable<typeof scores>[number]>();
  for (const score of scores ?? []) {
    if (!latest.has(score.dimension)) latest.set(score.dimension, score);
  }
  const rows = [...latest.values()];
  const overall = latest.get("overall");
  const sportRows = rows.filter((row) => row.dimension !== "overall");
  const completed = (weekWorkouts ?? []).filter((w) => w.status === "completed").length;
  const planned = (weekWorkouts ?? []).length;

  return (
    <PageFrame
      title="Progress"
      lede="Performance by sport — only dimensions with real inputs."
      compact
      actions={
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-ghost btn-sm" href="/analytics">Analytics</Link>
          <Link className="btn btn-ghost btn-sm" href="/records">History</Link>
          <Link className="btn btn-ghost btn-sm" href="/recovery">Recovery</Link>
          <Link className="btn btn-ghost btn-sm" href="/weekly">Weekly</Link>
        </div>
      }
    >
      {planned > 0 ? (
        <section className="app-card p-4">
          <h2 className="section-title">Recent consistency</h2>
          <div className="mt-3">
            <ProgressIndicator value={completed} max={Math.max(planned, 1)} label={`${completed}/${planned} sessions completed`} />
          </div>
        </section>
      ) : null}

      {overall ? (
        <article className="app-card p-4">
          <p className="eyebrow">Overall</p>
          <p className="metric mt-1 text-4xl font-bold">{overall.score ?? "—"}</p>
          <p className="mt-1 text-sm text-muted">{overall.explanation ?? copy.overall}</p>
        </article>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No score yet"
          body="Log a workout or finish onboarding with benchmarks. Tamreen will not display a number it cannot explain."
          href="/recovery"
          action="Log recovery"
          icon={ChartNoAxesCombined}
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {sportRows.map((score) => {
            const Icon = icons[score.dimension] ?? ChartNoAxesCombined;
            return (
              <li key={score.dimension}>
                <Link className="app-card flex items-start gap-3 p-4 transition-colors hover:bg-elevated" href={`/progress/${score.dimension}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-maroon-soft text-maroon">
                    <Icon size={18} strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-bold capitalize">{score.dimension}</span>
                      <span className="metric text-2xl font-bold">{score.score ?? "—"}</span>
                    </span>
                    <span className="mt-1 block text-sm text-muted line-clamp-2">{score.explanation ?? copy[score.dimension]}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageFrame>
  );
}
