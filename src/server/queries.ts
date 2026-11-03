import { blankOnboardingDraft, type OnboardingDraft } from "@/lib/onboarding-draft";
import { goalOptions, sportSlugs, type SportSlug } from "@/lib/sports";
import { daysUntil, hourInTimeZone, shiftIsoDate, todayInTimeZone } from "@/lib/utils";
import { loadWhoopSnapshot } from "@/services/wearables/whoop-load";
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
  const weekEnd = shiftIsoDate(today, 6);
  const [
    todayWorkouts,
    weekWorkouts,
    readiness,
    scores,
    event,
    insight,
    conflicts,
    loads,
    recommendation,
    whoop,
  ] = await Promise.all([
    shell.supabase
      .from("workouts")
      .select("id, sport, title, duration_min, intensity, objective, why_text, status, importance, expected_load, data_origin, workout_exercises(exercise_library(slug, live_supported))")
      .eq("user_id", shell.user.id)
      .eq("scheduled_date", today)
      .is("deleted_at", null)
      .order("importance"),
    shell.supabase
      .from("workouts")
      .select("id, scheduled_date, sport, title, duration_min, status")
      .eq("user_id", shell.user.id)
      .gte("scheduled_date", today)
      .lte("scheduled_date", weekEnd)
      .is("deleted_at", null)
      .order("scheduled_date"),
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
    loadWhoopSnapshot(shell.supabase, shell.user.id, 1),
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
    weekWorkouts: weekWorkouts.data ?? [],
    weekEnd,
    readiness: readiness.data,
    scores: [...latestScores.values()],
    event: event.data ? { ...event.data, days: daysUntil(event.data.starts_on, today) } : null,
    insight: insight.data,
    conflicts: conflicts.data ?? [],
    loads: loads.data ?? [],
    plan: recommendation.data,
    whoop,
  };
}

function severityOf(value: unknown): "mild" | "moderate" | "severe" {
  return value === "moderate" || value === "severe" ? value : "mild";
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function dateValue(value: unknown): string {
  const text = textValue(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function numberText(value: unknown): string {
  const parsed = numberValue(value);
  return parsed == null ? "" : String(parsed);
}

function joinedSlug(value: unknown): string {
  if (Array.isArray(value)) return joinedSlug(value[0]);
  if (value && typeof value === "object" && "slug" in value) {
    const slug = (value as { slug?: unknown }).slug;
    return typeof slug === "string" ? slug : "";
  }
  return "";
}

export async function loadOnboardingDraft(): Promise<OnboardingDraft> {
  const { supabase, user } = await requireUser();
  const draft = blankOnboardingDraft();
  const [{ data: profile }, { data: athlete }, { data: sports }, { data: goals }, { data: injuries }, { data: events }] = await Promise.all([
    supabase.from("profiles").select("full_name, date_of_birth, sex, onboarding_completed").eq("id", user.id).maybeSingle(),
    supabase.from("athlete_profiles").select("height_cm, weight_kg, body_fat_pct, experience_level, minutes_per_day, preferred_days, gym_access, pool_access, bike_access, reported_5k_seconds, reported_10k_seconds, reported_half_seconds, reported_marathon_seconds, weekly_run_km, ftp_watts, weekly_bike_km, swim_100m_seconds, swim_400m_seconds, weekly_swim_m, squat_kg, bench_kg, deadlift_kg").eq("user_id", user.id).maybeSingle(),
    supabase.from("athlete_sports").select("is_primary, sports(slug)").eq("user_id", user.id),
    supabase.from("athlete_goals").select("is_primary, custom_label, goals(slug)").eq("user_id", user.id),
    supabase.from("injuries").select("status, body_area, description, exercises_to_avoid, severity, red_flag").eq("user_id", user.id).eq("status", "current"),
    supabase.from("events").select("id, name, event_type, starts_on, distance_m, goal_time_seconds, description").eq("owner_user_id", user.id).is("deleted_at", null).order("starts_on"),
  ]);
  const knownSports = new Set<string>(sportSlugs);
  const sportRows = (sports ?? []).flatMap((row) => {
    const slug = joinedSlug(row.sports);
    return knownSports.has(slug) ? [{ slug, primary: Boolean(row.is_primary) }] : [];
  }).sort((a, b) => Number(b.primary) - Number(a.primary));
  const knownGoals = new Set<string>(goalOptions.map(([slug]) => slug));
  const goalRows = (goals ?? []).flatMap((row) => {
    const slug = joinedSlug(row.goals);
    if (!knownGoals.has(slug)) return [];
    const custom = textValue(row.custom_label);
    return [{ slug, primary: Boolean(row.is_primary), custom }];
  });
  const primaryGoal = goalRows.find((goal) => goal.primary)?.slug ?? goalRows[0]?.slug ?? "";
  const current = injuries ?? [];
  const severityRank = { mild: 0, moderate: 1, severe: 2 } as const;
  const severity = current.reduce<"mild" | "moderate" | "severe">((worst, injury) => {
    const next = severityOf(injury.severity);
    return severityRank[next] > severityRank[worst] ? next : worst;
  }, "mild");
  const event = (events ?? []).find((item) => item.description === "Training target created during onboarding.") ?? events?.[0] ?? null;
  const sex = profile?.sex === "female" || profile?.sex === "male" || profile?.sex === "other" || profile?.sex === "prefer_not_to_say"
    ? profile.sex
    : draft.sex;
  const experience = athlete?.experience_level === "beginner" || athlete?.experience_level === "advanced" || athlete?.experience_level === "elite" || athlete?.experience_level === "intermediate"
    ? athlete.experience_level
    : draft.experience;
  const preferred = (Array.isArray(athlete?.preferred_days) ? athlete.preferred_days as unknown[] : draft.preferredDays).flatMap((day) => {
    const index = typeof day === "number" ? day : Number(day);
    return Number.isInteger(index) && index >= 0 && index <= 6 ? [index] : [];
  });
  return {
    completed: profile?.onboarding_completed === true,
    fullName: textValue(profile?.full_name),
    dateOfBirth: dateValue(profile?.date_of_birth),
    sex,
    heightCm: numberText(athlete?.height_cm),
    weightKg: numberText(athlete?.weight_kg),
    bodyFat: numberText(athlete?.body_fat_pct),
    experience,
    sports: sportRows.map((sport) => sport.slug as SportSlug),
    primaryGoal,
    goals: goalRows.map((goal) => goal.slug),
    customGoal: goalRows.find((goal) => goal.slug === "custom")?.custom ?? goalRows.find((goal) => goal.custom)?.custom ?? "",
    preferredDays: preferred.length ? [...new Set(preferred)].sort((a, b) => a - b) : [],
    minutesPerDay: numberText(athlete?.minutes_per_day) || draft.minutesPerDay,
    gymAccess: athlete?.gym_access ?? draft.gymAccess,
    poolAccess: athlete?.pool_access ?? draft.poolAccess,
    bikeAccess: athlete?.bike_access ?? draft.bikeAccess,
    injuryArea: current.map((injury) => injury.body_area).filter(Boolean).join(", "),
    injuryNote: current.map((injury) => textValue(injury.description)).filter(Boolean).join("\n"),
    avoid: [...new Set(current.flatMap((injury) => injury.exercises_to_avoid ?? []))].join(", "),
    severity,
    redFlag: current.some((injury) => injury.red_flag),
    training: Boolean(event),
    eventId: event?.id ?? null,
    eventName: textValue(event?.name),
    eventType: textValue(event?.event_type) || "race",
    eventDate: dateValue(event?.starts_on),
    distanceM: numberText(event?.distance_m),
    goalTimeSeconds: numberValue(event?.goal_time_seconds),
    benchmarks: {
      fiveKSeconds: numberValue(athlete?.reported_5k_seconds),
      tenKSeconds: numberValue(athlete?.reported_10k_seconds),
      halfSeconds: numberValue(athlete?.reported_half_seconds),
      marathonSeconds: numberValue(athlete?.reported_marathon_seconds),
      weeklyRunKm: numberValue(athlete?.weekly_run_km),
      ftpWatts: numberValue(athlete?.ftp_watts),
      weeklyBikeKm: numberValue(athlete?.weekly_bike_km),
      swim100Seconds: numberValue(athlete?.swim_100m_seconds),
      swim400Seconds: numberValue(athlete?.swim_400m_seconds),
      weeklySwimM: numberValue(athlete?.weekly_swim_m),
      squatKg: numberValue(athlete?.squat_kg),
      benchKg: numberValue(athlete?.bench_kg),
      deadliftKg: numberValue(athlete?.deadlift_kg),
    },
  };
}
