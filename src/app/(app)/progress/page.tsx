import Link from "next/link";
import { PageFrame } from "@/components/page";
import { EmptyState } from "@/components/states";
import { requireUser } from "@/server/guard";

const copy: Record<string, string> = {
  strength: "Strength uses squat, bench, and deadlift as multiples of body weight. A missing lift is left out.",
  running: "Running compares a logged or reported pace with the target pace for the primary goal.",
  cycling: "Cycling uses FTP and body weight when both exist. Watts alone are used if weight is missing.",
  swimming: "Swimming uses 100 m pace. 90 seconds scores the top of this scale.",
  consistency: "Consistency is completed sessions divided by planned sessions in the recent window.",
  recovery: "Recovery comes from the latest check-in. It is omitted until you log one.",
  overall: "The performance score averages only the dimensions that have inputs, with extra weight on the primary goal.",
};

export default async function ProgressPage() {
  const { supabase, user } = await requireUser();
  const { data: scores } = await supabase
    .from("performance_scores")
    .select("dimension, score, explanation, scored_on, sample_size")
    .eq("user_id", user.id)
    .order("scored_on", { ascending: false })
    .limit(40);
  const latest = new Map<string, NonNullable<typeof scores>[number]>();
  for (const score of scores ?? []) {
    if (!latest.has(score.dimension)) latest.set(score.dimension, score);
  }
  const rows = [...latest.values()];
  return (
    <PageFrame eyebrow="Performance" title="Tamreen performance score" lede="A dimension appears only after Tamreen has the inputs for it.">
      {rows.length === 0 ? (
        <EmptyState title="No score yet." body="Log a workout or finish onboarding with benchmarks. Tamreen will not display a number it cannot explain." href="/recovery" action="Log recovery" />
      ) : (
        <ul className="grid gap-3">
          {rows.map((score) => (
            <li key={score.dimension}>
              <Link className="app-card block p-4" href={`/progress/${score.dimension}`}>
                <div className="flex items-end justify-between">
                  <h2 className="text-xl font-bold capitalize">{score.dimension}</h2>
                  <span className="metric text-4xl font-bold">{score.score ?? "—"}</span>
                </div>
                <p className="mt-2 text-sm text-muted">{score.explanation}</p>
                <p className="mt-2 text-sm">{copy[score.dimension] ?? "Open the metric to see the trend and the inputs."}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}
