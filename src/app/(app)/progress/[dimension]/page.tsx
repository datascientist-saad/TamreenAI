import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { PageFrame } from "@/components/page";
import { ExplainList } from "@/components/states";
import { TrendChart } from "@/features/analytics/trend";
import { sanitizeReturnTo } from "@/lib/navigation";
import { requireUser } from "@/server/guard";

export default async function DimensionPage({
  params,
  searchParams,
}: {
  params: Promise<{ dimension: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { dimension } = await params;
  const { from } = await searchParams;
  const returnTo = sanitizeReturnTo(from);
  const { supabase, user } = await requireUser();
  const { data: rows } = await supabase
    .from("performance_scores")
    .select("score, explanation, factors, sample_size, scored_on")
    .eq("user_id", user.id)
    .eq("dimension", dimension)
    .order("scored_on");
  if (!rows?.length) notFound();
  const latest = rows[rows.length - 1];
  const factors = Array.isArray(latest.factors) ? latest.factors as Array<{ label: string; detail: string }> : [];
  return (
    <PageFrame
      eyebrow="Performance"
      title={dimension.replaceAll("_", " ")}
      lede={latest.explanation}
      actions={<BackLink from={returnTo} kind="progress" />}
    >
      <p className="metric text-6xl font-bold">{latest.score ?? "—"}</p>
      <p className="text-sm text-muted">Sample size {latest.sample_size}. The trend uses saved scores only.</p>
      <article className="app-card p-4">
        <TrendChart points={rows.filter((row) => row.score != null).map((row) => ({ label: row.scored_on.slice(5), score: Number(row.score) }))} dataKey="score" />
      </article>
      <article className="app-card p-4">
        <h2 className="font-bold">Why this score</h2>
        <ExplainList factors={factors} />
        <p className="mt-3 text-sm">It moves when the underlying inputs move: logged performances, reported baselines, completed sessions, or a new recovery check-in. Refresh happens when you save a workout or a check-in.</p>
      </article>
    </PageFrame>
  );
}
