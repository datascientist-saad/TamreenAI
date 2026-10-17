import Link from "next/link";
import { PageFrame } from "@/components/page";
import { SafetyBanner } from "@/components/states";
import { RecoveryForm } from "@/features/recovery/check-in";
import { WhoopMetrics } from "@/features/whoop/metrics";
import { TrendChart } from "@/features/analytics/trend";
import { requireUser } from "@/server/guard";
import { sleepHoursFromMilli, whoopNotice } from "@/services/wearables/whoop";
import { loadWhoopSnapshot } from "@/services/wearables/whoop-load";

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ whoop?: string }> }) {
  const query = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: latest }, { data: logs }, whoop] = await Promise.all([
    supabase.from("readiness_scores").select("*").eq("user_id", user.id).order("scored_on", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("recovery_logs").select("logged_on, sleep_hours, soreness, fatigue, motivation").eq("user_id", user.id).order("logged_on", { ascending: false }).limit(7),
    loadWhoopSnapshot(supabase, user.id, 14),
  ]);
  const latestWhoop = whoop.metrics[0];
  const notice = whoopNotice(query.whoop);
  const recoveryPoints = whoop.metrics
    .filter((metric) => metric.recoveryScore != null)
    .slice()
    .reverse()
    .map((metric) => ({ label: metric.day.slice(5), value: Math.round(metric.recoveryScore ?? 0) }));
  const linked = whoop.connection.status === "connected" || whoop.connection.status === "error" || whoop.metrics.length > 0;
  return (
    <PageFrame eyebrow="Recovery" title="Readiness" lede={latest?.explanation ?? "A check-in is required before Tamreen scores readiness."}>
      {latest?.blocked_for_safety ? <SafetyBanner /> : null}
      {latest ? (
        <p className="metric text-6xl font-bold">{latest.overall ?? "—"}</p>
      ) : null}
      <p className="text-sm">Recommendation: {latest?.train_recommendation?.replaceAll("_", " ") ?? "log a check-in"}</p>
      <section className="app-card grid gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">WHOOP</h2>
          <Link className="text-sm font-bold text-maroon" href="/more">{linked ? "Manage" : "Connect"}</Link>
        </div>
        {notice ? <p className="text-sm">{notice}</p> : null}
        {linked ? <WhoopMetrics metrics={whoop.metrics} /> : (
          <p className="text-sm text-muted">Connect WHOOP on More to see recovery, strain, HRV, resting heart rate, and sleep here.</p>
        )}
        {recoveryPoints.length > 1 ? <TrendChart points={recoveryPoints} dataKey="value" /> : null}
      </section>
      <RecoveryForm
        defaults={latestWhoop ? {
          sleepHours: sleepHoursFromMilli(latestWhoop.asleepMilli),
          restingHr: latestWhoop.restingHeartRate == null ? null : Math.round(latestWhoop.restingHeartRate),
          hrv: latestWhoop.hrvRmssdMilli == null ? null : Math.round(latestWhoop.hrvRmssdMilli * 10) / 10,
          sourceDay: latestWhoop.day,
        } : undefined}
      />
      <ul className="grid gap-2">
        {(logs ?? []).map((log) => (
          <li key={log.logged_on} className="app-card px-4 py-3 text-sm">
            {log.logged_on} · sleep {log.sleep_hours}h · soreness {log.soreness} · fatigue {log.fatigue} · motivation {log.motivation}
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}
