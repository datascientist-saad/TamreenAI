import { notFound } from "next/navigation";
import { PageFrame } from "@/components/page";
import { TrendChart } from "@/features/analytics/trend";
import { formatClock, formatPace } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export default async function RunAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: session } = await supabase
    .from("running_sessions")
    .select("session_type, distance_m, duration_seconds, avg_pace_sec_per_km, avg_hr, cadence, elevation_m, splits, consistency, aerobic_efficiency, insight, completed_workouts!inner(title, user_id, rpe, data_origin)")
    .eq("completed_workout_id", id)
    .maybeSingle();
  const owner = Array.isArray(session?.completed_workouts) ? session.completed_workouts[0] : session?.completed_workouts;
  if (!session || owner?.user_id !== user.id) notFound();
  const splits = Array.isArray(session.splits) ? session.splits.map((value, index) => ({ label: `${index + 1}`, pace: Number(value) })) : [];
  const { data: settings } = await supabase.from("user_settings").select("distance_unit").eq("user_id", user.id).maybeSingle();
  const unit = settings?.distance_unit === "mi" ? "mi" : "km";

  return (
    <PageFrame eyebrow="Run analysis" title={owner?.title ?? "Run"} lede={session.insight ?? "No insight was stored because the inputs were incomplete."}>
      {owner?.data_origin === "demo" ? <p className="text-sm font-bold">Demo session. This is seeded history, not a live measurement.</p> : null}
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Distance" value={`${Math.round(Number(session.distance_m))} m`} />
        <Metric label="Time" value={formatClock(session.duration_seconds)} />
        <Metric label="Pace" value={session.avg_pace_sec_per_km ? formatPace(Number(session.avg_pace_sec_per_km), unit) : "—"} />
        <Metric label="Heart rate" value={session.avg_hr ? String(session.avg_hr) : "—"} />
        <Metric label="Cadence" value={session.cadence ? String(session.cadence) : "—"} />
        <Metric label="Elevation" value={session.elevation_m != null ? `${session.elevation_m} m` : "—"} />
        <Metric label="Consistency" value={session.consistency != null ? String(session.consistency) : "—"} />
        <Metric label="Aerobic efficiency" value={session.aerobic_efficiency != null ? String(session.aerobic_efficiency) : "—"} />
      </dl>
      <article className="app-card p-4">
        <h2 className="font-bold">Splits</h2>
        <TrendChart points={splits} dataKey="pace" />
      </article>
      <p className="text-sm text-muted">Heart-rate drift and a performance score stay blank unless both a start and finish heart rate, or enough splits, were logged. Nothing on this page is estimated to fill a gap.</p>
    </PageFrame>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-card p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="metric text-xl font-bold">{value}</dd>
    </div>
  );
}
