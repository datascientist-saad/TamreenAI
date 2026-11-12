import Link from "next/link";
import { PageFrame } from "@/components/page";
import { EmptyState } from "@/components/states";
import { formatClock, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";
import { stravaServerConfig } from "@/services/wearables/strava-config";
import { loadStravaSnapshot } from "@/services/wearables/strava-load";
import { loadStravaFeed } from "@/services/wearables/strava-sync";
import type { StravaActivity, StravaActivityStats } from "@/services/wearables/strava";

const SPORT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  running: { label: "Running", color: "#8a1538", bg: "rgba(138,21,56,0.08)" },
  cycling: { label: "Cycling", color: "#c9a876", bg: "rgba(201,168,118,0.15)" },
  swimming: { label: "Swimming", color: "#2f5d78", bg: "rgba(47,93,120,0.1)" },
  strength: { label: "Strength", color: "#1f1115", bg: "rgba(31,17,21,0.07)" },
};

interface RecordItem {
  key: string;
  label: string;
  value: string;
  raw: number;
  unit: string;
  kind: "baseline" | "pr" | "volume";
  achievedOn?: string | null;
  dataOrigin?: string;
  sport: string;
}

function formatValue(value: number, unit: string): string {
  if (unit.includes("second")) return formatClock(value);
  if (unit === "kg") return `${value} kg`;
  if (unit === "watts") return `${value} W`;
  if (unit === "km") return `${value} km`;
  if (unit === "m") return `${value} m`;
  return `${value} ${unit}`;
}

function shift(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function fmtDistance(metres: number): string {
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

function fmtDuration(seconds: number): string {
  return formatClock(seconds);
}

function stravaTypeLabel(type: string): string {
  const map: Record<string, string> = {
    Run: "Running", Ride: "Cycling", Swim: "Swimming", Walk: "Walking",
    Hike: "Hiking", WeightTraining: "Strength", Workout: "Workout",
    VirtualRide: "Cycling", VirtualRun: "Running", TrailRun: "Running",
    MountainBikeRide: "Cycling", Rowing: "Rowing", HIIT: "HIIT",
    Yoga: "Yoga", Crossfit: "CrossFit", Elliptical: "Elliptical",
  };
  return map[type] ?? type;
}

function relativeWidth(items: RecordItem[], item: RecordItem): number {
  const peers = items.filter((row) => row.unit === item.unit && row.raw > 0);
  if (!peers.length) return 40;
  const lowerIsBetter = item.unit.includes("second");
  if (lowerIsBetter) {
    const best = Math.min(...peers.map((row) => row.raw));
    const worst = Math.max(...peers.map((row) => row.raw));
    if (worst === best) return 92;
    return Math.max(18, Math.round(100 - ((item.raw - best) / (worst - best)) * 70));
  }
  const best = Math.max(...peers.map((row) => row.raw));
  if (!best) return 40;
  return Math.max(18, Math.round((item.raw / best) * 100));
}

export default async function RecordsPage() {
  const { supabase, user } = await requireUser();
  const [
    { data: athlete },
    { data: records },
    stravaSnap,
  ] = await Promise.all([
    supabase
      .from("athlete_profiles")
      .select(
        "timezone, reported_5k_seconds, reported_10k_seconds, reported_half_seconds, reported_marathon_seconds, weekly_run_km, ftp_watts, weekly_bike_km, swim_100m_seconds, swim_400m_seconds, weekly_swim_m, squat_kg, bench_kg, deadlift_kg",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("personal_records")
      .select("id, sport, record_type, value, unit, achieved_on, data_origin")
      .eq("user_id", user.id)
      .order("achieved_on", { ascending: false }),
    loadStravaSnapshot(supabase, user.id),
  ]);

  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const weekAgo = shift(today, -7);
  const allRecords = records ?? [];
  const fresh = allRecords.filter((r) => r.achieved_on >= weekAgo);

  const stravaConfig = stravaServerConfig();
  let stravaActivities: StravaActivity[] = [];
  let stravaStats: StravaActivityStats | null = null;
  if (stravaSnap.connection.status === "connected" && stravaConfig) {
    try {
      const feed = await loadStravaFeed(supabase, user.id, stravaConfig);
      stravaActivities = feed.activities;
      stravaStats = feed.stats;
    } catch {
      // non-fatal: show what we have from DB
    }
  }

  const baselineByKey = new Map<string, RecordItem>();

  function addBaseline(key: string, sport: string, label: string, seconds: number | null, unit: string, kind: "baseline" | "volume") {
    if (!seconds) return;
    baselineByKey.set(`${sport}::${key}`, {
      key, label, sport,
      value: formatValue(seconds, unit),
      raw: seconds,
      unit,
      kind,
    });
  }

  addBaseline("5k", "running", "5K", athlete?.reported_5k_seconds ?? null, "seconds", "baseline");
  addBaseline("10k", "running", "10K", athlete?.reported_10k_seconds ?? null, "seconds", "baseline");
  addBaseline("half_marathon", "running", "Half Marathon", athlete?.reported_half_seconds ?? null, "seconds", "baseline");
  addBaseline("marathon", "running", "Marathon", athlete?.reported_marathon_seconds ?? null, "seconds", "baseline");
  addBaseline("weekly_run_km", "running", "Weekly Volume", athlete?.weekly_run_km ? Number(athlete.weekly_run_km) : null, "km", "volume");
  addBaseline("ftp", "cycling", "FTP", athlete?.ftp_watts ? Number(athlete.ftp_watts) : null, "watts", "baseline");
  addBaseline("weekly_bike_km", "cycling", "Weekly Volume", athlete?.weekly_bike_km ? Number(athlete.weekly_bike_km) : null, "km", "volume");
  addBaseline("swim_100m", "swimming", "100 m Pace", athlete?.swim_100m_seconds ?? null, "seconds", "baseline");
  addBaseline("swim_400m", "swimming", "400 m Pace", athlete?.swim_400m_seconds ?? null, "seconds", "baseline");
  addBaseline("weekly_swim_m", "swimming", "Weekly Volume", athlete?.weekly_swim_m ? Number(athlete.weekly_swim_m) : null, "m", "volume");
  addBaseline("squat", "strength", "Squat", athlete?.squat_kg ? Number(athlete.squat_kg) : null, "kg", "baseline");
  addBaseline("bench", "strength", "Bench Press", athlete?.bench_kg ? Number(athlete.bench_kg) : null, "kg", "baseline");
  addBaseline("deadlift", "strength", "Deadlift", athlete?.deadlift_kg ? Number(athlete.deadlift_kg) : null, "kg", "baseline");

  const prBySport = new Map<string, RecordItem[]>();
  for (const rec of allRecords) {
    const list = prBySport.get(rec.sport) ?? [];
    list.push({
      key: rec.record_type,
      label: rec.record_type.replaceAll("_", " "),
      value: rec.unit.includes("second") ? formatClock(Number(rec.value)) : `${rec.value} ${rec.unit}`,
      raw: Number(rec.value),
      unit: rec.unit,
      kind: "pr",
      achievedOn: rec.achieved_on,
      dataOrigin: rec.data_origin,
      sport: rec.sport,
    });
    prBySport.set(rec.sport, list);
  }

  const allSports = new Set<string>([
    ...Array.from(baselineByKey.keys()).map((k) => k.split("::")[0]),
    ...Array.from(prBySport.keys()),
  ]);

  const hasAnything = baselineByKey.size > 0 || allRecords.length > 0 || stravaActivities.length > 0;

  const sportOrder = ["running", "cycling", "swimming", "strength"];
  const sortedSports = [
    ...sportOrder.filter((s) => allSports.has(s)),
    ...[...allSports].filter((s) => !sportOrder.includes(s)),
  ];

  const totalPRs = allRecords.filter((r) => r.data_origin !== "demo").length;
  const totalBaselines = baselineByKey.size;
  const highlight = [
    ...Array.from(prBySport.values()).flat().filter((item) => item.dataOrigin !== "demo"),
    ...Array.from(baselineByKey.values()),
  ].slice(0, 3);

  return (
    <PageFrame
      eyebrow="Records"
      title="Personal marks"
      lede="PRs and baselines in one visual board. Strava stays as a compact activity feed."
    >
      {fresh.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-gold/30 to-maroon/10 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-maroon">New this week</p>
          <p className="mt-1 font-bold">{fresh.map((r) => r.record_type.replaceAll("_", " ")).join(" · ")}</p>
        </div>
      )}

      {hasAnything && (
        <div className="grid grid-cols-3 gap-3">
          <StatPill label="PRs" value={String(totalPRs)} accent="maroon" />
          <StatPill label="Baselines" value={String(totalBaselines)} accent="gold" />
          <StatPill label="Sports" value={String(sortedSports.length)} accent="muted" />
        </div>
      )}

      {!hasAnything ? (
        <EmptyState
          title="No records yet."
          body="Finish a lift, a timed run, an FTP test, or a swim that beats the previous best. Connect Strava on More to pull activity history."
        />
      ) : (
        <div className="grid gap-5">
          {highlight.length > 0 && (
            <section className="grid gap-3">
              <h2 className="text-sm font-extrabold uppercase tracking-widest text-muted">Highlight board</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {highlight.map((item, index) => {
                  const config = SPORT_CONFIG[item.sport] ?? { label: item.sport, color: "#8a1538", bg: "rgba(138,21,56,0.06)" };
                  return (
                    <article
                      key={`${item.sport}-${item.key}-${item.kind}`}
                      className="relative overflow-hidden rounded-[1.4rem] border border-line bg-card p-4"
                      style={{ background: `linear-gradient(160deg, ${config.bg}, transparent 70%)` }}
                    >
                      <p className="text-xs font-bold uppercase tracking-widest text-muted">#{index + 1} · {config.label}</p>
                      <p className="mt-2 font-bold capitalize">{item.label}</p>
                      <p className="metric mt-3 text-3xl font-extrabold" style={{ color: config.color }}>{item.value}</p>
                      <span
                        className="mt-3 inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
                        style={item.kind === "pr" ? { background: config.color, color: "white" } : { background: config.bg, color: config.color }}
                      >
                        {item.kind === "pr" ? "PR" : item.kind === "volume" ? "Volume" : "Baseline"}
                      </span>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {(stravaActivities.length > 0 || stravaStats) && (
            <section className="app-card grid gap-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#fc4c02" aria-hidden="true">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                  </svg>
                  <h2 className="text-sm font-extrabold uppercase tracking-widest" style={{ color: "#fc4c02" }}>Strava</h2>
                </div>
                <Link className="text-sm font-bold text-maroon" href="/more">Manage</Link>
              </div>

              {stravaStats ? (
                <div className="grid grid-cols-3 gap-2">
                  {stravaStats.all_run_totals?.count ? <MiniStat label="Runs" value={String(stravaStats.all_run_totals.count)} /> : null}
                  {stravaStats.all_ride_totals?.count ? <MiniStat label="Rides" value={String(stravaStats.all_ride_totals.count)} /> : null}
                  {stravaStats.ytd_run_totals?.distance ? <MiniStat label="YTD run" value={`${(stravaStats.ytd_run_totals.distance / 1000).toFixed(0)} km`} /> : null}
                </div>
              ) : null}

              <div className="grid gap-2">
                {stravaActivities.slice(0, 4).map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold leading-tight">{activity.name}</p>
                      <p className="text-xs text-muted">
                        {stravaTypeLabel(activity.sport_type ?? activity.type)}
                        {" · "}
                        {new Date(activity.start_date_local ?? activity.start_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                        {activity.distance > 0 ? ` · ${fmtDistance(activity.distance)}` : ""}
                      </p>
                    </div>
                    <p className="metric shrink-0 text-lg font-extrabold" style={{ color: "#fc4c02" }}>
                      {fmtDuration(activity.moving_time)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {sortedSports.map((sport) => {
            const config = SPORT_CONFIG[sport] ?? { label: sport, color: "#8a1538", bg: "rgba(138,21,56,0.06)" };
            const baselines = Array.from(baselineByKey.entries())
              .filter(([k]) => k.startsWith(`${sport}::`))
              .map(([, v]) => v);
            const prs = prBySport.get(sport) ?? [];
            const items = [...prs, ...baselines];
            if (!items.length) return null;
            return (
              <section key={sport} className="app-card grid gap-3 p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: config.color }} />
                  <h2 className="text-sm font-extrabold uppercase tracking-widest" style={{ color: config.color }}>
                    {config.label}
                  </h2>
                  <span className="ml-auto text-xs font-semibold text-muted">{items.length} marks</span>
                </div>
                <div className="grid gap-3">
                  {items.map((item) => (
                    <RecordBar
                      key={`${item.kind}-${item.key}`}
                      item={item}
                      accentColor={config.color}
                      accentBg={config.bg}
                      width={relativeWidth(items, item)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {stravaSnap.connection.status !== "connected" && (
            <div className="rounded-2xl border border-dashed border-line px-4 py-4 text-center">
              <p className="text-sm font-semibold">Connect Strava on More to pull activity history into this board.</p>
            </div>
          )}
        </div>
      )}
    </PageFrame>
  );
}

function StatPill({ label, value, accent }: { label: string; value: string; accent: "maroon" | "gold" | "muted" }) {
  const accentClass =
    accent === "maroon"
      ? "bg-maroon/10 text-maroon"
      : accent === "gold"
        ? "bg-gold/20 text-[#6d5428] dark:text-gold"
        : "bg-line text-muted";
  return (
    <div className={`rounded-2xl px-4 py-3 ${accentClass}`}>
      <p className="metric text-2xl font-extrabold">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-line/40 px-3 py-2 text-center">
      <p className="metric text-lg font-extrabold" style={{ color: "#fc4c02" }}>{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function RecordBar({
  item,
  accentColor,
  accentBg,
  width,
}: {
  item: RecordItem;
  accentColor: string;
  accentBg: string;
  width: number;
}) {
  const badgeLabel = item.kind === "pr" ? "PR" : item.kind === "volume" ? "Volume" : "Baseline";
  const badgeStyle =
    item.kind === "pr"
      ? { background: accentColor, color: "white" }
      : item.kind === "volume"
        ? { background: "rgba(201,168,118,0.3)", color: "#6d5428" }
        : { background: accentBg, color: accentColor };

  return (
    <div className="grid gap-2 rounded-2xl bg-paper px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest" style={badgeStyle}>
              {badgeLabel}
            </span>
            {item.dataOrigin === "demo" ? <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">demo</span> : null}
          </div>
          <p className="mt-1 font-bold capitalize leading-tight">{item.label}</p>
          {item.achievedOn ? (
            <p className="text-xs text-muted">
              {new Date(`${item.achievedOn}T00:00:00Z`).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          ) : null}
        </div>
        <p className="metric shrink-0 text-2xl font-extrabold" style={{ color: accentColor }}>{item.value}</p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-line/70">
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: accentColor }} />
      </div>
    </div>
  );
}
