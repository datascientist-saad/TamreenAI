import { daysUntil, hourInTimeZone, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "./guard";

export async function loadShell() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: roles }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("full_name, onboarding_completed, is_demo, avatar_path").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id).is("revoked_at", null),
    supabase.from("user_settings").select("unit_system, distance_unit, weight_unit, theme").eq("user_id", user.id).maybeSingle(),
  ]);
  const { data: athlete } = await supabase
    .from("athlete_profiles")
    .select("timezone, minutes_per_day, preferred_days, experience_level")
    .eq("user_id", user.id)
    .maybeSingle();
  return {
    supabase,
    user,
    profile,
    roles: (roles ?? []).map((row) => row.role as string),
    settings,
    timeZone: athlete?.timezone || "Asia/Qatar",
    minutesPerDay: athlete?.minutes_per_day ?? 60,
    preferredDays: athlete?.preferred_days ?? [1, 2, 3, 4, 5],
    experience: athlete?.experience_level ?? "intermediate",
  };
}

export async function loadHome() {
  const shell = await loadShell();
  const today = todayInTimeZone(shell.timeZone);
  const weekStart = new Date(`${today}T00:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const from = weekStart.toISOString().slice(0, 10);
  const [
    todayWorkouts,
    readiness,
    scores,
    event,
    insight,
    conflicts,
    loads,
    recommendation,
  ] = await Promise.all([
    shell.supabase
      .from("workouts")
      .select("id, sport, title, duration_min, intensity, objective, why_text, status, importance, expected_load, data_origin")
      .eq("user_id", shell.user.id)
      .eq("scheduled_date", today)
      .is("deleted_at", null)
      .order("importance"),
    shell.supabase
      .from("readiness_scores")
      .select("overall, sleep, recovery, recent_load, muscle_fatigue, cardio_fatigue, explanation, train_recommendation, blocked_for_safety, factors, data_origin")
      .eq("user_id", shell.user.id)
      .order("scored_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
    shell.supabase
      .from("performance_scores")
      .select("dimension, score, explanation, factors, sample_size, data_origin, scored_on")
      .eq("user_id", shell.user.id)
      .order("scored_on", { ascending: false })
      .limit(20),
    shell.supabase
      .from("events")
      .select("id, name, event_type, starts_on, goal_time_seconds, data_origin")
      .eq("owner_user_id", shell.user.id)
      .is("deleted_at", null)
      .gte("starts_on", today)
      .order("starts_on")
      .limit(1)
      .maybeSingle(),
    shell.supabase
      .from("ai_recommendations")
      .select("id, title, body, factors, proposed_changes, status, kind, data_origin")
      .eq("user_id", shell.user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    shell.supabase
      .from("training_conflicts")
      .select("id, title, explanation, severity, status, recommendation, data_origin")
      .eq("user_id", shell.user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(3),
    shell.supabase
      .from("completed_workouts")
      .select("started_at, load, sport, data_origin")
      .eq("user_id", shell.user.id)
      .gte("started_at", `${from}T00:00:00Z`),
    shell.supabase
      .from("training_plans")
      .select("id, name, explanation, status")
      .eq("user_id", shell.user.id)
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle(),
  ]);
  const latestScores = new Map<string, NonNullable<typeof scores.data>[number]>();
  for (const score of scores.data ?? []) {
    if (!latestScores.has(score.dimension)) latestScores.set(score.dimension, score);
  }
  return {
    ...shell,
    today,
    hour: hourInTimeZone(shell.timeZone),
    todayWorkouts: todayWorkouts.data ?? [],
    readiness: readiness.data,
    scores: [...latestScores.values()],
    event: event.data ? { ...event.data, days: daysUntil(event.data.starts_on, today) } : null,
    insight: insight.data,
    conflicts: conflicts.data ?? [],
    loads: loads.data ?? [],
    plan: recommendation.data,
  };
}
