import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const userId = data.user.id;
  const [workouts, recovery] = await Promise.all([
    supabase.from("completed_workouts").select("sport, title, started_at, duration_min, rpe, load").eq("user_id", userId).order("started_at", { ascending: false }).limit(500),
    supabase.from("recovery_logs").select("logged_on, sleep_hours, sleep_quality, soreness, fatigue, motivation, stress, resting_hr, hrv").eq("user_id", userId).order("logged_on", { ascending: false }).limit(200),
  ]);

  const lines = [
    "# Tamreen AI raw export",
    "# completed_workouts",
    "sport,title,started_at,duration_min,rpe,load",
    ...(workouts.data ?? []).map((row) => [row.sport, csv(row.title), row.started_at, row.duration_min, row.rpe, row.load].join(",")),
    "",
    "# recovery_logs",
    "logged_on,sleep_hours,sleep_quality,soreness,fatigue,motivation,stress,resting_hr,hrv",
    ...(recovery.data ?? []).map((row) => [
      row.logged_on,
      row.sleep_hours,
      row.sleep_quality,
      row.soreness,
      row.fatigue,
      row.motivation,
      row.stress,
      row.resting_hr,
      row.hrv,
    ].join(",")),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tamreen-raw-export.csv"',
      "Cache-Control": "no-store",
    },
  });
}

function csv(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
