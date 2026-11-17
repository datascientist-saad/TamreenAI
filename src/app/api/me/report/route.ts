import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { shiftIsoDate, todayInTimeZone } from "@/lib/utils";
import { buildAthleteReportHtml, buildInsights, describeEventDistances, type AthleteReportData } from "@/services/reports/athlete-report";

export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const userId = data.user.id;
  const url = new URL(request.url);
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone, experience_level").eq("user_id", userId).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const from = url.searchParams.get("from") || shiftIsoDate(today, -28);
  const to = url.searchParams.get("to") || today;

  const [profile, sports, goals, completed, planned, recovery, readiness, events, records, links] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("athlete_sports").select("sports(name, slug)").eq("user_id", userId),
    supabase.from("athlete_goals").select("goals(name, slug), custom_label").eq("user_id", userId),
    supabase
      .from("completed_workouts")
      .select("sport, title, started_at, duration_min, rpe, load")
      .eq("user_id", userId)
      .gte("started_at", `${from}T00:00:00Z`)
      .lte("started_at", `${to}T23:59:59Z`),
    supabase
      .from("workouts")
      .select("id, status, scheduled_date")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("scheduled_date", from)
      .lte("scheduled_date", to),
    supabase
      .from("recovery_logs")
      .select("logged_on, sleep_hours, soreness, fatigue, resting_hr, hrv")
      .eq("user_id", userId)
      .gte("logged_on", from)
      .lte("logged_on", to)
      .order("logged_on"),
    supabase
      .from("readiness_scores")
      .select("scored_on, overall")
      .eq("user_id", userId)
      .gte("scored_on", from)
      .lte("scored_on", to),
    supabase
      .from("events")
      .select("id, name, starts_on, priority, distance_m, swim_m, bike_m, run_m, status")
      .eq("owner_user_id", userId)
      .is("deleted_at", null)
      .order("starts_on"),
    supabase.from("personal_records").select("sport, record_type, value, unit, achieved_on").eq("user_id", userId),
    supabase.from("session_event_links").select("event_id").eq("user_id", userId),
  ]);

  const bySport = new Map<string, { count: number; minutes: number }>();
  for (const row of completed.data ?? []) {
    const current = bySport.get(row.sport) ?? { count: 0, minutes: 0 };
    current.count += 1;
    current.minutes += Number(row.duration_min ?? 0);
    bySport.set(row.sport, current);
  }
  const readinessByDay = new Map((readiness.data ?? []).map((row) => [row.scored_on, row.overall == null ? null : Number(row.overall)]));
  const linkCount = new Map<string, number>();
  for (const row of links.data ?? []) {
    linkCount.set(row.event_id, (linkCount.get(row.event_id) ?? 0) + 1);
  }
  const plannedCount = (planned.data ?? []).length;
  const completedCount = (completed.data ?? []).length;
  const reportBase: Omit<AthleteReportData, "insights"> = {
    generatedAt: new Date().toISOString(),
    period: { from, to },
    athlete: {
      name: profile.data?.full_name || "Athlete",
      experience: athlete?.experience_level ?? null,
      sports: (sports.data ?? []).flatMap((row) => {
        const joined = row.sports as { name?: string } | { name?: string }[] | null;
        const name = Array.isArray(joined) ? joined[0]?.name : joined?.name;
        return name ? [name] : [];
      }),
      goals: (goals.data ?? []).flatMap((row) => {
        if (typeof row.custom_label === "string" && row.custom_label.trim()) return [row.custom_label.trim()];
        const joined = row.goals as { name?: string } | { name?: string }[] | null;
        const name = Array.isArray(joined) ? joined[0]?.name : joined?.name;
        return name ? [name] : [];
      }),
    },
    summary: {
      completedWorkouts: completedCount,
      totalMinutes: (completed.data ?? []).reduce((sum, row) => sum + Number(row.duration_min ?? 0), 0),
      completionRate: plannedCount ? Math.round((completedCount / plannedCount) * 100) : null,
      bySport: [...bySport.entries()].map(([sport, value]) => ({ sport, ...value })),
    },
    recovery: (recovery.data ?? []).map((row) => ({
      day: row.logged_on,
      sleep: row.sleep_hours == null ? null : Number(row.sleep_hours),
      readiness: readinessByDay.get(row.logged_on) ?? null,
      hrv: row.hrv == null ? null : Number(row.hrv),
      restingHr: row.resting_hr == null ? null : Number(row.resting_hr),
      fatigue: row.fatigue == null ? null : Number(row.fatigue),
      soreness: row.soreness == null ? null : Number(row.soreness),
    })),
    events: (events.data ?? [])
      .filter((event) => (event.status ?? "active") !== "cancelled")
      .map((event) => ({
        name: event.name,
        date: event.starts_on,
        priority: event.priority ?? "primary",
        distances: describeEventDistances(event),
        linkedSessions: linkCount.get(event.id) ?? 0,
      })),
    records: (records.data ?? []).map((row) => ({
      sport: row.sport,
      recordType: row.record_type,
      value: `${row.value}${row.unit ? ` ${row.unit}` : ""}`,
      achievedOn: row.achieved_on,
    })),
  };
  const report: AthleteReportData = { ...reportBase, insights: buildInsights(reportBase) };
  const html = buildAthleteReportHtml(report);
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
