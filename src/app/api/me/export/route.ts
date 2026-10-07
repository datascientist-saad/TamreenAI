import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const userId = data.user.id;
  const [profile, athlete, workouts, recovery, records] = await Promise.all([
    supabase.from("profiles").select("full_name, date_of_birth, sex, onboarding_completed").eq("id", userId).maybeSingle(),
    supabase.from("athlete_profiles").select("height_cm, weight_kg, experience_level, preferred_days, minutes_per_day").eq("user_id", userId).maybeSingle(),
    supabase.from("completed_workouts").select("sport, title, started_at, duration_min, rpe, load").eq("user_id", userId).order("started_at", { ascending: false }).limit(200),
    supabase.from("recovery_logs").select("logged_on, sleep_hours, soreness, fatigue, motivation, stress").eq("user_id", userId).order("logged_on", { ascending: false }).limit(60),
    supabase.from("personal_records").select("sport, record_type, value, unit, achieved_on").eq("user_id", userId),
  ]);
  return NextResponse.json({
    exported_at: new Date().toISOString(),
    profile: profile.data,
    athlete: athlete.data,
    workouts: workouts.data,
    recovery: recovery.data,
    records: records.data,
  });
}
