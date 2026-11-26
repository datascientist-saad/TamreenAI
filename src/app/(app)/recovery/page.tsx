import Link from "next/link";
import { Suspense } from "react";
import { PageFrame } from "@/components/page";
import { SafetyBanner } from "@/components/states";
import { TrendChart } from "@/features/analytics/trend";
import { FitnessMetricsForm } from "@/features/recovery/fitness-metrics";
import { RecoveryForm } from "@/features/recovery/check-in";
import { RecoverySectionTabs } from "@/features/recovery/section-tabs";
import { WhoopMetrics } from "@/features/whoop/metrics";
import { estimateVo2From5kSeconds, readinessTone, recommendationLabel } from "@/lib/fitness";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/guard";
import { sleepHoursFromMilli, whoopNotice } from "@/services/wearables/whoop";
import { loadWhoopSnapshot } from "@/services/wearables/whoop-load";

type HealthRow = { metric_slug: string; value: number | null; measured_at: string; unit: string; source: string };

function latestBySlug(rows: HealthRow[]): Map<string, HealthRow> {
  const map = new Map<string, HealthRow>();
  for (const row of rows) {
    if (!map.has(row.metric_slug)) map.set(row.metric_slug, row);
  }
  return map;
}

function metricNumber(map: Map<string, HealthRow>, slug: string): number | null {
  const value = map.get(slug)?.value;
  return value == null || !Number.isFinite(Number(value)) ? null : Number(value);
}

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ whoop?: string; tab?: string }> }) {
  const query = await searchParams;
  const tab = query.tab === "metrics" || query.tab === "history" || query.tab === "checkin" || query.tab === "overview"
    ? query.tab
    : "overview";
  const { supabase, user } = await requireUser();
  const [{ data: latest }, { data: logs }, { data: athlete }, { data: healthRows }, whoop] = await Promise.all([
    supabase.from("readiness_scores").select("*").eq("user_id", user.id).order("scored_on", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("recovery_logs")
      .select("logged_on, sleep_hours, sleep_quality, soreness, fatigue, motivation, stress, resting_hr, hrv")
      .eq("user_id", user.id)
      .order("logged_on", { ascending: false })
      .limit(14),
    supabase
      .from("athlete_profiles")
      .select("weight_kg, body_fat_pct, ftp_watts, reported_5k_seconds")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("health_measurements")
      .select("metric_slug, value, measured_at, unit, source")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .in("metric_slug", ["vo2_max", "max_hr", "resting_hr", "hrv", "body_weight", "body_fat_pct", "cycling_ftp"])
      .order("measured_at", { ascending: false })
      .limit(40),
    loadWhoopSnapshot(supabase, user.id, 14),
  ]);

  const latestWhoop = whoop.metrics[0];
  const notice = whoopNotice(query.whoop);
  const health = latestBySlug((healthRows ?? []) as HealthRow[]);
  const estimatedVo2 = estimateVo2From5kSeconds(athlete?.reported_5k_seconds);
  const vo2 = metricNumber(health, "vo2_max") ?? estimatedVo2;
  const restingHr =
    metricNumber(health, "resting_hr")
    ?? (latestWhoop?.restingHeartRate == null ? null : Math.round(latestWhoop.restingHeartRate))
    ?? (logs?.[0]?.resting_hr == null ? null : Number(logs[0].resting_hr));
  const hrv =
    metricNumber(health, "hrv")
    ?? (latestWhoop?.hrvRmssdMilli == null ? null : Math.round(latestWhoop.hrvRmssdMilli * 10) / 10)
    ?? (logs?.[0]?.hrv == null ? null : Number(logs[0].hrv));
  const maxHr = metricNumber(health, "max_hr");
  const weight = metricNumber(health, "body_weight") ?? (athlete?.weight_kg == null ? null : Number(athlete.weight_kg));
  const bodyFat = metricNumber(health, "body_fat_pct") ?? (athlete?.body_fat_pct == null ? null : Number(athlete.body_fat_pct));
  const ftp = metricNumber(health, "cycling_ftp") ?? (athlete?.ftp_watts == null ? null : Number(athlete.ftp_watts));

  const recoveryPoints = whoop.metrics
    .filter((metric) => metric.recoveryScore != null)
    .slice()
    .reverse()
    .map((metric) => ({ label: metric.day.slice(5), value: Math.round(metric.recoveryScore ?? 0) }));
  const linked = whoop.connection.status === "connected" || whoop.connection.status === "error" || whoop.metrics.length > 0;
  const tone = readinessTone(latest?.overall == null ? null : Number(latest.overall));
  const history = [...(logs ?? [])].reverse();
  const maxSleep = Math.max(8, ...history.map((log) => Number(log.sleep_hours ?? 0)));

  const score = latest?.overall == null ? null : Number(latest.overall);
  const toneClass =
    tone === "good" ? "text-success"
    : tone === "ok" ? "text-warning"
    : tone === "low" ? "text-danger"
    : "text-maroon";

  return (
    <PageFrame title="Body" lede="Readiness, check-in, health metrics, and recovery trends." compact>
      {latest?.blocked_for_safety ? <SafetyBanner /> : null}

      <Suspense fallback={<div className="h-10 rounded-full bg-line/40" />}>
        <RecoverySectionTabs />
      </Suspense>

      {(tab === "overview" || tab === "checkin") ? (
      <section className="app-card grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <ReadinessRing score={score} tone={tone} />
        <div className="min-w-0">
          <p className="eyebrow">Readiness</p>
          <p className={cn("mt-1 text-2xl font-bold", toneClass)}>
            {score == null ? "Incomplete" : `${Math.round(score)}/100`}
          </p>
          <p className="mt-0.5 text-sm font-semibold">{recommendationLabel(latest?.train_recommendation)}</p>
          <p className="mt-2 text-sm text-muted line-clamp-3">{latest?.explanation ?? "Save a check-in to score readiness. Tamreen will not invent one."}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-4">
          <MetricTile label="VO₂ max" value={vo2 == null ? "—" : `${vo2}`} hint={metricNumber(health, "vo2_max") == null && estimatedVo2 != null ? "est." : "ml/kg/min"} />
          <MetricTile label="Resting HR" value={restingHr == null ? "—" : `${Math.round(restingHr)}`} hint="bpm" />
          <MetricTile label="HRV" value={hrv == null ? "—" : `${hrv}`} hint="ms" />
          <MetricTile label="Sleep" value={logs?.[0]?.sleep_hours == null ? "—" : `${logs[0].sleep_hours}`} hint="hours" />
        </dl>
        {tab === "overview" ? (
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Link className="btn btn-primary" href="/recovery?tab=checkin">Daily check-in</Link>
            <Link className="btn btn-ghost" href="/health">Health log</Link>
            <Link className="btn btn-ghost" href="/nutrition">Nutrition</Link>
          </div>
        ) : null}
      </section>
      ) : null}

      {tab === "overview" ? (
        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <Link href="/health" className="app-card p-4 transition-colors hover:bg-elevated">
            <h2 className="section-title">Health</h2>
            <p className="mt-1 text-sm text-muted">Manual metrics with last-updated timestamps.</p>
          </Link>
          <Link href="/nutrition" className="app-card p-4 transition-colors hover:bg-elevated">
            <h2 className="section-title">Nutrition</h2>
            <p className="mt-1 text-sm text-muted">Calories, macros, and meal logging.</p>
          </Link>
          <Link href="/weekly" className="app-card p-4 transition-colors hover:bg-elevated sm:col-span-2 xl:col-span-1">
            <h2 className="section-title">Weekly review</h2>
            <p className="mt-1 text-sm text-muted">Compare planned vs completed work and recovery.</p>
          </Link>
        </section>
      ) : null}

      {tab === "checkin" ? (
        <section className="grid gap-3">
          <div>
            <h2 className="text-xl font-extrabold">Daily check-in</h2>
            <p className="text-sm text-muted">Sleep, feelings, and body signals. About one minute.</p>
          </div>
          <RecoveryForm
            defaults={{
              sleepHours: logs?.[0]?.sleep_hours == null ? (latestWhoop ? sleepHoursFromMilli(latestWhoop.asleepMilli) : 7.5) : Number(logs[0].sleep_hours),
              sleepQuality: logs?.[0]?.sleep_quality == null ? null : Number(logs[0].sleep_quality),
              soreness: logs?.[0]?.soreness == null ? null : Number(logs[0].soreness),
              fatigue: logs?.[0]?.fatigue == null ? null : Number(logs[0].fatigue),
              motivation: logs?.[0]?.motivation == null ? null : Number(logs[0].motivation),
              stress: logs?.[0]?.stress == null ? null : Number(logs[0].stress),
              restingHr: logs?.[0]?.resting_hr == null
                ? (latestWhoop?.restingHeartRate == null ? restingHr : Math.round(latestWhoop.restingHeartRate))
                : Number(logs[0].resting_hr),
              hrv: logs?.[0]?.hrv == null
                ? (latestWhoop?.hrvRmssdMilli == null ? hrv : Math.round(latestWhoop.hrvRmssdMilli * 10) / 10)
                : Number(logs[0].hrv),
              loggedOn: logs?.[0]?.logged_on ?? null,
              sourceDay: latestWhoop?.day ?? null,
              weightKg: weight,
              bodyFatPct: bodyFat,
              vo2Max: vo2,
              sleepScore: latestWhoop?.sleepPerformancePercentage == null ? null : Math.round(latestWhoop.sleepPerformancePercentage),
            }}
          />
        </section>
      ) : null}

      {tab === "metrics" ? (
        <div className="grid gap-4">
          <section className="app-card grid gap-3 p-4">
            <div>
              <h2 className="text-xl font-extrabold">Fitness metrics</h2>
              <p className="text-sm text-muted">VO₂ max, heart-rate anchors, body composition, and FTP.</p>
            </div>
            <FitnessMetricsForm
              estimatedVo2={estimatedVo2}
              defaults={{
                vo2Max: metricNumber(health, "vo2_max"),
                maxHr,
                restingHr,
                hrv,
                bodyWeight: weight,
                bodyFat,
                ftpWatts: ftp,
              }}
            />
          </section>

          <section className="app-card grid gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-extrabold">WHOOP</h2>
                <p className="text-sm text-muted">Recovery, strain, and sleep from your wearable.</p>
              </div>
              <Link className="text-sm font-bold text-maroon" href="/more">{linked ? "Manage" : "Connect"}</Link>
            </div>
            {notice ? <p className="text-sm">{notice}</p> : null}
            {linked ? <WhoopMetrics metrics={whoop.metrics} /> : (
              <p className="text-sm text-muted">Connect WHOOP on More to pull recovery, strain, HRV, resting heart rate, and sleep here.</p>
            )}
            {recoveryPoints.length > 1 ? <TrendChart points={recoveryPoints} dataKey="value" /> : null}
          </section>
        </div>
      ) : null}

      {tab === "history" ? (
        <section className="app-card grid gap-4 p-4">
          <div>
            <h2 className="text-xl font-extrabold">Recent check-ins</h2>
            <p className="text-sm text-muted">Last week of sleep and feeling scores.</p>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-muted">No check-ins yet. Start with today&apos;s entry.</p>
          ) : (
            <>
              <div className="grid grid-cols-7 items-end gap-1.5 rounded-2xl bg-paper px-3 py-3">
                {history.slice(-7).map((log) => {
                  const sleep = Number(log.sleep_hours ?? 0);
                  const height = Math.max(12, Math.round((sleep / maxSleep) * 72));
                  return (
                    <div key={`spark-${log.logged_on}`} className="grid justify-items-center gap-1">
                      <div className="flex h-[72px] w-full items-end justify-center">
                        <div className="w-full max-w-6 rounded-t-md bg-maroon" style={{ height }} title={`${sleep}h`} />
                      </div>
                      <p className="text-[10px] font-semibold text-muted">{log.logged_on.slice(5)}</p>
                    </div>
                  );
                })}
              </div>
              <ul className="grid gap-2">
                {history.slice(-7).reverse().map((log) => {
                  const sleep = Number(log.sleep_hours ?? 0);
                  const width = Math.max(8, Math.round((sleep / maxSleep) * 100));
                  return (
                    <li key={log.logged_on} className="rounded-2xl bg-paper px-3 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-bold">{log.logged_on}</p>
                        <p className="metric text-sm font-bold">{sleep || "—"}h sleep</p>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-maroon" style={{ width: `${width}%` }} />
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                        <HistoryChip label="Sore" value={log.soreness} />
                        <HistoryChip label="Fatigue" value={log.fatigue} />
                        <HistoryChip label="Drive" value={log.motivation} />
                        <HistoryChip label="Stress" value={log.stress} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      ) : null}
    </PageFrame>
  );
}

function ReadinessRing({ score, tone }: { score: number | null; tone: string }) {
  const value = score == null ? 0 : Math.max(0, Math.min(100, score));
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const stroke =
    tone === "good" ? "var(--success)"
    : tone === "ok" ? "var(--warning)"
    : tone === "low" ? "var(--danger)"
    : "var(--maroon)";
  return (
    <div className="relative mx-auto grid h-24 w-24 place-items-center" role="img" aria-label={score == null ? "Readiness unavailable" : `Readiness ${Math.round(score)}`}>
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={score == null ? circumference : offset}
        />
      </svg>
      <p className="metric absolute text-2xl font-bold">{score == null ? "—" : Math.round(score)}</p>
    </div>
  );
}

function MetricTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-sm)] bg-elevated px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="metric mt-1 text-xl font-bold">{value}</p>
      <p className="caption">{hint}</p>
    </div>
  );
}

function HistoryChip({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl bg-card px-2 py-2 ring-1 ring-line">
      <p className="text-muted">{label}</p>
      <p className="metric text-base font-bold">{value ?? "—"}</p>
    </div>
  );
}
