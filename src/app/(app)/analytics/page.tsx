import Link from "next/link";
import { PageFrame } from "@/components/page";
import { TrendChart } from "@/features/analytics/trend";
import { todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

const windows: Record<string, number | null> = { "7d": 7, "30d": 30, "3m": 90, "6m": 180, "1y": 365, all: null };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string; metric?: string }> }) {
  const query = await searchParams;
  const range = query.range && query.range in windows ? query.range : "30d";
  const metric = query.metric ?? "load";
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const days = windows[range];
  const from = days == null ? "2000-01-01" : shift(today, -days);
  const [{ data: loads }, { data: runs }, { data: rides }, { data: swims }, { data: scores }, { data: recovery }] = await Promise.all([
    supabase.from("completed_workouts").select("started_at, load, sport").eq("user_id", user.id).gte("started_at", `${from}T00:00:00Z`).order("started_at"),
    supabase.from("running_sessions").select("distance_m, avg_pace_sec_per_km, avg_hr, completed_workouts!inner(started_at, user_id)").eq("user_id", user.id).limit(200),
    supabase.from("cycling_sessions").select("distance_m, avg_power, ftp, completed_workouts!inner(started_at, user_id)").eq("user_id", user.id).limit(200),
    supabase.from("swimming_sessions").select("distance_m, pace_sec_per_100m, completed_workouts!inner(started_at, user_id)").eq("user_id", user.id).limit(200),
    supabase.from("performance_scores").select("scored_on, score, dimension").eq("user_id", user.id).eq("dimension", "overall").gte("scored_on", from).order("scored_on"),
    supabase.from("recovery_logs").select("logged_on, sleep_hours, fatigue").eq("user_id", user.id).gte("logged_on", from).order("logged_on"),
  ]);
  const points = series(metric, { loads: loads ?? [], runs: runs ?? [], rides: rides ?? [], swims: swims ?? [], scores: scores ?? [], recovery: recovery ?? [], from });

  return (
    <PageFrame eyebrow="Analytics" title={metric} lede="One chart at a time. Open a metric, then change the window.">
      <div className="flex flex-wrap gap-2">
        {Object.keys(windows).map((item) => <Link key={item} className={`btn ${range === item ? "btn-primary" : "btn-ghost"}`} href={`/analytics?range=${item}&metric=${metric}`}>{item}</Link>)}
      </div>
      <div className="flex flex-wrap gap-2">
        {["load", "volume", "running", "pace", "heart", "ftp", "swim", "recovery", "score"].map((item) => (
          <Link key={item} className={`btn ${metric === item ? "btn-gold" : "btn-ghost"}`} href={`/analytics?range=${range}&metric=${item}`}>{item}</Link>
        ))}
      </div>
      <article className="app-card p-4">
        <TrendChart points={points} dataKey="value" />
      </article>
    </PageFrame>
  );
}

function series(metric: string, input: {
  loads: Array<{ started_at: string; load: number | null; sport: string }>;
  runs: Array<{ distance_m: number; avg_pace_sec_per_km: number | null; avg_hr: number | null; completed_workouts: { started_at: string } | { started_at: string }[] }>;
  rides: Array<{ ftp: number | null; avg_power: number | null; completed_workouts: { started_at: string } | { started_at: string }[] }>;
  swims: Array<{ pace_sec_per_100m: number | null; completed_workouts: { started_at: string } | { started_at: string }[] }>;
  scores: Array<{ scored_on: string; score: number | null }>;
  recovery: Array<{ logged_on: string; sleep_hours: number | null; fatigue: number | null }>;
  from: string;
}) {
  const started = (row: { completed_workouts: { started_at: string } | { started_at: string }[] }) => {
    const joined = Array.isArray(row.completed_workouts) ? row.completed_workouts[0] : row.completed_workouts;
    return joined?.started_at ?? "";
  };
  if (metric === "running" || metric === "volume") {
    return input.runs.filter((row) => started(row) >= input.from).map((row) => ({ label: started(row).slice(5, 10), value: Math.round(Number(row.distance_m) / 100) / 10 }));
  }
  if (metric === "pace") {
    return input.runs.filter((row) => row.avg_pace_sec_per_km && started(row) >= input.from).map((row) => ({ label: started(row).slice(5, 10), value: Math.round(Number(row.avg_pace_sec_per_km)) }));
  }
  if (metric === "heart") {
    return input.runs.filter((row) => row.avg_hr && started(row) >= input.from).map((row) => ({ label: started(row).slice(5, 10), value: Number(row.avg_hr) }));
  }
  if (metric === "ftp") {
    return input.rides.filter((row) => (row.ftp || row.avg_power) && started(row) >= input.from).map((row) => ({ label: started(row).slice(5, 10), value: Number(row.ftp ?? row.avg_power) }));
  }
  if (metric === "swim") {
    return input.swims.filter((row) => row.pace_sec_per_100m && started(row) >= input.from).map((row) => ({ label: started(row).slice(5, 10), value: Math.round(Number(row.pace_sec_per_100m)) }));
  }
  if (metric === "recovery") {
    return input.recovery.map((row) => ({ label: row.logged_on.slice(5), value: Number(row.sleep_hours ?? 0) }));
  }
  if (metric === "score") {
    return input.scores.filter((row) => row.score != null).map((row) => ({ label: row.scored_on.slice(5), value: Number(row.score) }));
  }
  const byDay = new Map<string, number>();
  for (const row of input.loads) {
    const day = row.started_at.slice(5, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + Number(row.load ?? 0));
  }
  return [...byDay.entries()].map(([label, value]) => ({ label, value }));
}

function shift(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
