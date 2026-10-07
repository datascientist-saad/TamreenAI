import { notFound } from "next/navigation";
import { PageFrame } from "@/components/page";
import { sessionAnalyzer } from "@/services/live/pose";
import { requireUser } from "@/server/guard";

export default async function LiveReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: session } = await supabase.from("live_training_sessions").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!session) notFound();
  const { data: form } = await supabase.from("form_analysis").select("*").eq("session_id", id).maybeSingle();
  const summary = sessionAnalyzer.summarize({
    exerciseSlug: session.exercise_slug,
    durationSeconds: session.duration_seconds ?? 0,
    manualReps: session.manual_reps ?? 0,
    manualSets: session.manual_sets ?? 0,
    cameraUsed: session.camera_used,
    analysisSource: session.analysis_source,
  });
  const metrics = metricRows(form?.metrics);

  return (
    <PageFrame eyebrow="Workout complete" title={session.exercise_slug.replaceAll("_", " ")} lede={summary.headline}>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Item label="Duration" value={`${session.duration_seconds ?? 0}s`} />
        <Item label="Sets" value={String(session.manual_sets ?? 0)} />
        <Item label="Reps" value={String(session.manual_reps ?? 0)} />
        <Item label="Source" value={session.analysis_source} />
      </dl>
      <article className="app-card p-4">
        <h2 className="font-bold">What was measured</h2>
        <ul className="mt-2 text-sm">{summary.measured.map((line) => <li key={line}>{line}</li>)}</ul>
        {summary.unavailable.length ? (
          <>
            <h3 className="mt-4 font-bold">Not measured</h3>
            <ul className="mt-2 text-sm text-muted">{summary.unavailable.map((line) => <li key={line}>{line}</li>)}</ul>
          </>
        ) : null}
      </article>
      {form?.is_placeholder ? (
        <article className="app-card border-l-4 border-l-gold p-4">
          <p className="eyebrow">Placeholder / demo analysis</p>
          <p className="mt-2 font-bold">These scores are a fixed example. They were not calculated from this camera session.</p>
          <p className="metric mt-2 text-5xl">{form.overall_score}</p>
          <ul className="mt-3 grid gap-2 text-sm">
            {metrics.map((metric) => <li key={metric.key} className="flex justify-between"><span className="capitalize">{metric.label}</span><span className="metric">{metric.score}</span></li>)}
          </ul>
          <p className="mt-3 text-sm"><span className="font-bold">Best. </span>{form.best_note}</p>
          <p className="text-sm"><span className="font-bold">Improve. </span>{form.improve_note}</p>
        </article>
      ) : form?.source === "model" ? (
        <article className="app-card p-4">
          <p className="eyebrow">Camera form</p>
          <p className="mt-2 text-sm">2D camera estimate, not a lab measurement.</p>
          <p className="metric mt-2 text-5xl">{form.overall_score}</p>
          <ul className="mt-3 grid gap-3 text-sm">
            {metrics.map((metric) => (
              <li key={metric.key}>
                <div className="flex justify-between font-bold"><span>{metric.label}</span><span className="metric">{metric.score}</span></div>
                {metric.detail ? <p className="text-muted">{metric.detail}</p> : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm"><span className="font-bold">Best. </span>{form.best_note}</p>
          <p className="text-sm"><span className="font-bold">Improve. </span>{form.improve_note}</p>
        </article>
      ) : (
        <article className="app-card p-4">
          <h2 className="font-bold">Form analysis</h2>
          <p className="mt-2 text-sm text-muted">
            {session.analysis_source === "model"
              ? "The pose model ran, but the body was not visible enough to score form. No score was invented."
              : "No form score was saved. Depth, knee tracking, torso, and tempo stay blank until the camera can see the movement."}
          </p>
        </article>
      )}
    </PageFrame>
  );
}

function metricRows(metrics: unknown): Array<{ key: string; label: string; score: string; detail?: string }> {
  if (!metrics || typeof metrics !== "object") return [];
  return Object.entries(metrics as Record<string, unknown>).map(([key, value]) => {
    if (typeof value === "number") return { key, label: key.replaceAll("_", " "), score: String(value) };
    if (value && typeof value === "object" && "score" in value) {
      const row = value as { score?: number; label?: string; detail?: string };
      return { key, label: row.label || key.replaceAll("_", " "), score: row.score == null ? "—" : String(row.score), detail: row.detail };
    }
    return { key, label: key.replaceAll("_", " "), score: "—" };
  });
}

function Item({ label, value }: { label: string; value: string }) {
  return <div className="app-card p-3"><dt className="text-xs text-muted">{label}</dt><dd className="metric text-2xl font-bold">{value}</dd></div>;
}
