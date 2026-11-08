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

  // Fetch live Strava data if connected
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

  // Build baseline items from onboarding
  const baselineByKey = new Map<string, RecordItem>();

  function addBaseline(key: string, sport: string, label: string, seconds: number | null, unit: string, kind: "baseline" | "volume") {
    if (!seconds) return;
    baselineByKey.set(`${sport}::${key}`, {
      key, label,
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

  // Group actual records by sport
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

  return (
    <PageFrame
      eyebrow="Records"
      title="Personal records"
      lede="Baselines from onboarding, earned PRs, and Strava activity history in one place."
    >
      {fresh.length > 0 && (
        <div className="rounded-2xl bg-gold/20 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-maroon">New this week</p>
          <p className="mt-1 font-bold">{fresh.map((r) => r.record_type.replaceAll("_", " ")).join(", ")}</p>
        </div>
      )}

      {hasAnything && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatPill label="Earned PRs" value={String(totalPRs)} accent="maroon" />
          <StatPill label="Baselines" value={String(totalBaselines)} accent="gold" />
          <StatPill label="Sports" value={String(sortedSports.length)} accent="muted" />
        </div>
      )}

      {!hasAnything ? (
        <EmptyState
          title="No records yet."
          body="Finish a lift, a timed run, an FTP test, or a swim that beats the previous best. Connect Strava on the More page to see your activity history here."
        />
      ) : (
        <div className="grid gap-6">
          {/* Strava live section */}
          {stravaActivities.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fc4c02" aria-hidden="true">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                <h2 className="text-sm font-extrabold uppercase tracking-widest" style={{ color: "#fc4c02" }}>
                  Strava
                </h2>
              </div>

              {/* All-time stats row */}
              {stravaStats && (
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {stravaStats.all_run_totals?.count ? (
                    <MiniStat label="All-time runs" value={String(stravaStats.all_run_totals.count)} />
                  ) : null}
                  {stravaStats.all_ride_totals?.count ? (
                    <MiniStat label="All-time rides" value={String(stravaStats.all_ride_totals.count)} />
                  ) : null}
                  {stravaStats.all_swim_totals?.count ? (
                    <MiniStat label="All-time swims" value={String(stravaStats.all_swim_totals.count)} />
                  ) : null}
                  {stravaStats.all_run_totals?.distance ? (
                    <MiniStat label="Total run km" value={(stravaStats.all_run_totals.distance / 1000).toFixed(0)} />
                  ) : null}
                  {stravaStats.all_ride_totals?.distance ? (
                    <MiniStat label="Total ride km" value={(stravaStats.all_ride_totals.distance / 1000).toFixed(0)} />
                  ) : null}
                  {stravaStats.ytd_run_totals?.distance ? (
                    <MiniStat label="YTD run km" value={(stravaStats.ytd_run_totals.distance / 1000).toFixed(0)} />
                  ) : null}
                </div>
              )}

              {/* Recent activities */}
              <div className="grid gap-2">
                {stravaActivities.map((activity) => (
                  <div key={activity.id} className="app-card flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
                          style={{ background: "rgba(252,76,2,0.12)", color: "#fc4c02" }}
                        >
                          {stravaTypeLabel(activity.sport_type ?? activity.type)}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-bold leading-tight">{activity.name}</p>
                      <p className="text-xs text-muted">
                        {new Date(activity.start_date_local ?? activity.start_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {activity.distance > 0 ? ` · ${fmtDistance(activity.distance)}` : ""}
                      </p>
                    </div>
                    <p className="metric shrink-0 text-xl font-extrabold" style={{ color: "#fc4c02" }}>
                      {fmtDuration(activity.moving_time)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tamreen sport sections */}
          {sortedSports.map((sport) => {
            const config = SPORT_CONFIG[sport] ?? { label: sport, color: "#8a1538", bg: "rgba(138,21,56,0.06)" };
            const baselines = Array.from(baselineByKey.entries())
              .filter(([k]) => k.startsWith(`${sport}::`))
              .map(([, v]) => v);
            const prs = prBySport.get(sport) ?? [];
            if (baselines.length === 0 && prs.length === 0) return null;
            return (
              <section key={sport}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: config.color }} />
                  <h2 className="text-sm font-extrabold uppercase tracking-widest" style={{ color: config.color }}>
                    {config.label}
                  </h2>
                </div>
                <div className="grid gap-2">
                  {prs.map((item) => (
                    <RecordCard key={`pr-${item.key}`} item={item} accentColor={config.color} accentBg={config.bg} />
                  ))}
                  {baselines.map((item) => (
                    <RecordCard key={`base-${item.key}`} item={item} accentColor={config.color} accentBg={config.bg} />
                  ))}
                </div>
              </section>
            );
          })}

          {/* Strava not connected nudge */}
          {stravaSnap.connection.status !== "connected" && (
            <div className="rounded-2xl border border-dashed border-line px-4 py-4 text-center">
              <p className="text-sm font-semibold">Connect Strava on the More page to see your activity history here.</p>
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

function RecordCard({
  item,
  accentColor,
  accentBg,
}: {
  item: RecordItem;
  accentColor: string;
  accentBg: string;
}) {
  const badgeLabel =
    item.kind === "pr" ? "PR" : item.kind === "volume" ? "Volume" : "Baseline";
  const badgeStyle =
    item.kind === "pr"
      ? { background: accentColor, color: "white" }
      : item.kind === "volume"
        ? { background: "rgba(201,168,118,0.3)", color: "#6d5428" }
        : { background: accentBg, color: accentColor };

  return (
    <div className="app-card flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
            style={badgeStyle}
          >
            {badgeLabel}
          </span>
          {item.dataOrigin === "demo" && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">demo</span>
          )}
        </div>
        <p className="mt-1 font-bold capitalize leading-tight">{item.label}</p>
        {item.achievedOn && (
          <p className="text-xs text-muted">
            {new Date(`${item.achievedOn}T00:00:00Z`).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
      </div>
      <p className="metric shrink-0 text-2xl font-extrabold" style={{ color: accentColor }}>
        {item.value}
      </p>
    </div>
  );
}
