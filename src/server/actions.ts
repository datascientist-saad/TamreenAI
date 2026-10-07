"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  adaptMissedSession,
  analyzeRun,
  answerCoach,
  buildPlan,
  consistencyScore,
  cyclingScore,
  findConflicts,
  isPersonalRecord,
  optimizeWeek,
  overallScore,
  recommendedWeeklyLoad,
  runningScore,
  scoreReadiness,
  sessionLoad,
  strengthScore,
  swimmingScore,
  type AthleteContext,
  type CatalogSport,
  type Intensity,
  type PlannedSession,
  type Sport,
} from "@/services/training/engine";
import { todayInTimeZone } from "@/lib/utils";
import { requireUser } from "./guard";

async function limit(action: string, maxCalls: number, windowSeconds: number) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    action,
    max_calls: maxCalls,
    window_seconds: windowSeconds,
  });
  if (error || data !== true) {
    throw new Error("Too many requests. Wait a moment and try again.");
  }
  return { supabase, user };
}

const sportList = ["strength", "bodybuilding", "running", "cycling", "swimming", "triathlon"] as const;

const onboardingSchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sex: z.enum(["female", "male", "other", "prefer_not_to_say"]),
  heightCm: z.number().min(50).max(260),
  weightKg: z.number().min(20).max(400),
  bodyFat: z.number().min(2).max(70).nullable(),
  experience: z.enum(["beginner", "intermediate", "advanced", "elite"]),
  sports: z.array(z.enum(sportList)).min(1),
  primaryGoal: z.string().min(1),
  goals: z.array(z.string()).min(1),
  customGoal: z.string().max(160).optional(),
  preferredDays: z.array(z.number().int().min(0).max(6)).min(1),
  minutesPerDay: z.number().int().min(15).max(360),
  gymAccess: z.boolean(),
  poolAccess: z.boolean(),
  bikeAccess: z.boolean(),
  injuries: z.array(z.object({
    status: z.enum(["current", "previous"]),
    bodyArea: z.string().min(1).max(80),
    description: z.string().max(400),
    avoid: z.array(z.string()).max(12),
    severity: z.enum(["mild", "moderate", "severe"]),
    redFlag: z.boolean(),
  })).max(12),
  event: z.object({
    name: z.string().min(1).max(120),
    eventType: z.string().min(1).max(80),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    distanceM: z.number().positive().nullable(),
    goalTimeSeconds: z.number().int().positive().nullable(),
  }).nullable(),
  benchmarks: z.object({
    fiveKSeconds: z.number().int().positive().nullable(),
    tenKSeconds: z.number().int().positive().nullable(),
    halfSeconds: z.number().int().positive().nullable(),
    marathonSeconds: z.number().int().positive().nullable(),
    weeklyRunKm: z.number().nonnegative().nullable(),
    ftpWatts: z.number().int().positive().nullable(),
    weeklyBikeKm: z.number().nonnegative().nullable(),
    swim100Seconds: z.number().int().positive().nullable(),
    swim400Seconds: z.number().int().positive().nullable(),
    weeklySwimM: z.number().nonnegative().nullable(),
    squatKg: z.number().positive().nullable(),
    benchKg: z.number().positive().nullable(),
    deadliftKg: z.number().positive().nullable(),
  }),
});

export async function saveOnboarding(input: z.infer<typeof onboardingSchema>) {
  const parsed = onboardingSchema.parse(input);
  const { supabase, user } = await limit("onboarding", 12, 3600);
  const { data: sports } = await supabase.from("sports").select("id, slug");
  const { data: goals } = await supabase.from("goals").select("id, slug");
  const sportId = new Map((sports ?? []).map((sport) => [sport.slug, sport.id]));
  const goalId = new Map((goals ?? []).map((goal) => [goal.slug, goal.id]));

  const { error: profileError } = await supabase.from("profiles").update({
    full_name: parsed.fullName,
    date_of_birth: parsed.dateOfBirth,
    sex: parsed.sex,
    onboarding_completed: true,
  }).eq("id", user.id);
  if (profileError) throw new Error(profileError.message);

  const { error: athleteError } = await supabase.from("athlete_profiles").update({
    height_cm: parsed.heightCm,
    weight_kg: parsed.weightKg,
    body_fat_pct: parsed.bodyFat,
    experience_level: parsed.experience,
    days_available: parsed.preferredDays.length,
    minutes_per_day: parsed.minutesPerDay,
    preferred_days: parsed.preferredDays,
    gym_access: parsed.gymAccess,
    pool_access: parsed.poolAccess,
    bike_access: parsed.bikeAccess,
    reported_5k_seconds: parsed.benchmarks.fiveKSeconds,
    reported_10k_seconds: parsed.benchmarks.tenKSeconds,
    reported_half_seconds: parsed.benchmarks.halfSeconds,
    reported_marathon_seconds: parsed.benchmarks.marathonSeconds,
    weekly_run_km: parsed.benchmarks.weeklyRunKm,
    ftp_watts: parsed.benchmarks.ftpWatts,
    weekly_bike_km: parsed.benchmarks.weeklyBikeKm,
    swim_100m_seconds: parsed.benchmarks.swim100Seconds,
    swim_400m_seconds: parsed.benchmarks.swim400Seconds,
    weekly_swim_m: parsed.benchmarks.weeklySwimM,
    squat_kg: parsed.benchmarks.squatKg,
    bench_kg: parsed.benchmarks.benchKg,
    deadlift_kg: parsed.benchmarks.deadliftKg,
  }).eq("user_id", user.id);
  if (athleteError) throw new Error(athleteError.message);

  await supabase.from("athlete_sports").delete().eq("user_id", user.id);
  await supabase.from("athlete_sports").insert(parsed.sports.flatMap((slug) => {
    const id = sportId.get(slug);
    return id ? [{ user_id: user.id, sport_id: id, is_primary: slug === parsed.sports[0], experience_level: parsed.experience }] : [];
  }));

  await supabase.from("athlete_goals").delete().eq("user_id", user.id);
  const goalRows = [...new Set([parsed.primaryGoal, ...parsed.goals])].flatMap((slug) => {
    const id = goalId.get(slug);
    return id ? [{
      user_id: user.id,
      goal_id: id,
      is_primary: slug === parsed.primaryGoal,
      custom_label: slug === "custom" ? parsed.customGoal ?? "Custom goal" : null,
    }] : [];
  });
  if (goalRows.length) {
    const { error } = await supabase.from("athlete_goals").insert(goalRows);
    if (error) throw new Error(error.message);
  }

  await supabase.from("injuries").delete().eq("user_id", user.id);
  if (parsed.injuries.length) {
    await supabase.from("injuries").insert(parsed.injuries.map((injury) => ({
      user_id: user.id,
      status: injury.status,
      body_area: injury.bodyArea,
      description: injury.description,
      exercises_to_avoid: injury.avoid,
      severity: injury.severity,
      red_flag: injury.redFlag || injury.severity === "severe",
    })));
  }

  if (parsed.event) {
    await supabase.from("events").insert({
      owner_user_id: user.id,
      name: parsed.event.name,
      event_type: parsed.event.eventType,
      discipline: parsed.event.eventType,
      starts_on: parsed.event.date,
      distance_m: parsed.event.distanceM,
      goal_time_seconds: parsed.event.goalTimeSeconds,
      description: "Training target created during onboarding.",
    });
  }

  await generatePlan();
  revalidatePath("/home");
  return { ok: true };
}

async function contextFor(userId: string, supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]): Promise<AthleteContext> {
  const [{ data: profile }, { data: athlete }, { data: sports }, { data: goals }, { data: injuries }, { data: event }] = await Promise.all([
    supabase.from("profiles").select("sex").eq("id", userId).single(),
    supabase.from("athlete_profiles").select("*").eq("user_id", userId).single(),
    supabase.from("athlete_sports").select("sports(slug)").eq("user_id", userId),
    supabase.from("athlete_goals").select("is_primary, goals(slug)").eq("user_id", userId),
    supabase.from("injuries").select("body_area, exercises_to_avoid, red_flag, status").eq("user_id", userId),
    supabase.from("events").select("name, starts_on").eq("owner_user_id", userId).is("deleted_at", null).order("starts_on").limit(1).maybeSingle(),
  ]);
  const sportSlugs = (sports ?? []).flatMap((row) => {
    const joined = row.sports as { slug?: string } | { slug?: string }[] | null;
    const slug = Array.isArray(joined) ? joined[0]?.slug : joined?.slug;
    return slug ? [slug as CatalogSport] : [];
  });
  const goalRows = (goals ?? []).map((row) => {
    const joined = row.goals as { slug?: string } | { slug?: string }[] | null;
    const slug = Array.isArray(joined) ? joined[0]?.slug : joined?.slug;
    return { slug: slug ?? "general_hybrid", primary: Boolean(row.is_primary) };
  });
  const primary = goalRows.find((goal) => goal.primary)?.slug ?? goalRows[0]?.slug ?? "general_hybrid";
  const current = (injuries ?? []).filter((injury) => injury.status === "current");
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  return {
    startDate: today,
    sports: sportSlugs,
    primaryGoal: primary,
    goals: goalRows.map((goal) => goal.slug),
    experience: athlete?.experience_level ?? "intermediate",
    preferredDays: athlete?.preferred_days ?? [1, 2, 3, 4, 5, 6],
    minutesPerDay: athlete?.minutes_per_day ?? 60,
    gymAccess: athlete?.gym_access ?? true,
    poolAccess: athlete?.pool_access ?? false,
    bikeAccess: athlete?.bike_access ?? false,
    eventDate: event?.starts_on ?? null,
    eventName: event?.name ?? null,
    avoidExercises: current.flatMap((injury) => injury.exercises_to_avoid ?? []),
    currentInjuryAreas: current.map((injury) => injury.body_area),
    redFlag: current.some((injury) => injury.red_flag),
    weightKg: athlete?.weight_kg ?? null,
    sex: profile?.sex ?? null,
    reported: {
      fiveKSeconds: athlete?.reported_5k_seconds,
      tenKSeconds: athlete?.reported_10k_seconds,
      ftpWatts: athlete?.ftp_watts,
      swim100Seconds: athlete?.swim_100m_seconds,
      squatKg: athlete?.squat_kg,
      benchKg: athlete?.bench_kg,
      deadliftKg: athlete?.deadlift_kg,
    },
  };
}

export async function generatePlan() {
  const { supabase, user } = await limit("generate_plan", 8, 3600);
  const ctx = await contextFor(user.id, supabase);
  const plan = buildPlan(ctx);
  const today = ctx.startDate;
  await supabase.from("training_plans").update({ status: "archived" }).eq("user_id", user.id).eq("status", "active");
  await supabase.from("workouts").update({ deleted_at: new Date().toISOString() }).eq("user_id", user.id).eq("status", "planned").gte("scheduled_date", today).is("deleted_at", null);

  const { data: created, error } = await supabase.from("training_plans").insert({
    user_id: user.id,
    name: plan.name,
    status: "active",
    start_date: plan.startDate,
    end_date: plan.endDate,
    primary_goal_slug: ctx.primaryGoal,
    inputs: { sports: ctx.sports, minutes: ctx.minutesPerDay, days: ctx.preferredDays },
    explanation: plan.explanation,
  }).select("id").single();
  if (error || !created) throw new Error(error?.message ?? "Plan was not saved.");

  const { data: blocks } = await supabase.from("training_blocks").insert(plan.blocks.map((block) => ({
    plan_id: created.id,
    user_id: user.id,
    phase: block.phase,
    name: block.name,
    start_date: block.startDate,
    end_date: block.endDate,
    focus: block.focus,
    sort_order: block.sortOrder,
  }))).select("id, phase, start_date, end_date");

  const blockId = (date: string) => (blocks ?? []).find((block) => date >= block.start_date && date <= block.end_date)?.id ?? null;
  const { data: library } = await supabase.from("exercise_library").select("id, slug");
  const exerciseId = new Map((library ?? []).map((exercise) => [exercise.slug, exercise.id]));
  const workoutRows = plan.sessions.map((session, index) => ({
    plan_id: created.id,
    block_id: blockId(session.date),
    user_id: user.id,
    scheduled_date: session.date,
    sport: session.sport,
    title: session.title,
    objective: session.objective,
    duration_min: session.durationMin,
    intensity: session.intensity,
    expected_load: session.expectedLoad,
    importance: session.importance,
    recovery_hours: session.recoveryHours,
    status: "planned",
    structure: { ...session.structure, clientKey: index },
    zones: session.zones,
    why_text: session.why,
  }));
  const { data: workouts, error: workoutError } = await supabase.from("workouts").insert(workoutRows).select("id, structure");
  if (workoutError) throw new Error(workoutError.message);
  const byKey = new Map((workouts ?? []).map((workout) => [Number((workout.structure as { clientKey?: number }).clientKey), workout.id]));
  const exerciseRows = plan.sessions.flatMap((session, index) => {
    const workoutId = byKey.get(index);
    if (!workoutId) return [];
    return session.exercises.map((exercise, sort) => ({
      workout_id: workoutId,
      exercise_id: exerciseId.get(exercise.slug) ?? null,
      sort_order: sort,
      set_count: exercise.sets,
      reps: exercise.reps,
      target_rpe: exercise.targetRpe,
      rest_seconds: exercise.restSeconds,
      tempo: exercise.tempo,
      technique: exercise.technique,
      why_text: exercise.why,
    }));
  });
  if (exerciseRows.length) await supabase.from("workout_exercises").insert(exerciseRows);

  const conflicts = findConflicts(plan.sessions);
  if (conflicts.length) {
    await supabase.from("training_conflicts").insert(conflicts.slice(0, 12).map((conflict) => ({
      user_id: user.id,
      workout_a_id: byKey.get(conflict.sessionA) ?? null,
      workout_b_id: byKey.get(conflict.sessionB) ?? null,
      severity: conflict.severity,
      title: conflict.title,
      explanation: conflict.explanation,
      recommendation: { factors: conflict.factors },
    })));
  }
  await supabase.from("notifications").insert({
    user_id: user.id,
    kind: "plan",
    title: "Training plan ready",
    body: plan.explanation.slice(0, 180),
    href: "/plan",
  });
  revalidatePath("/home");
  revalidatePath("/plan");
  return { ok: true, recommendedLoad: recommendedWeeklyLoad(ctx) };
}

export async function respondToRecommendation(id: string, accept: boolean) {
  const { supabase, user } = await limit("recommendation", 30, 3600);
  const { data: row } = await supabase.from("ai_recommendations").select("id, proposed_changes, status").eq("id", id).eq("user_id", user.id).single();
  if (!row || row.status !== "pending") throw new Error("That proposal is no longer pending.");
  if (!accept) {
    await supabase.from("ai_recommendations").update({ status: "rejected" }).eq("id", id);
    revalidatePath("/home");
    return { ok: true };
  }
  const changes = (row.proposed_changes ?? []) as Array<{ date: string; title: string; sport: Sport; durationMin: number; intensity: Intensity; why: string }>;
  for (const change of changes) {
    await supabase.from("workouts").insert({
      user_id: user.id,
      scheduled_date: change.date,
      sport: change.sport,
      title: change.title,
      objective: "Accepted plan adjustment",
      duration_min: change.durationMin,
      intensity: change.intensity,
      expected_load: sessionLoad(change.durationMin, change.intensity, change.sport),
      importance: "supporting",
      why_text: change.why,
      status: "planned",
    });
  }
  await supabase.from("ai_recommendations").update({ status: "accepted" }).eq("id", id);
  await supabase.from("notifications").insert({
    user_id: user.id,
    kind: "plan_adjustment",
    title: "Plan adjustment accepted",
    body: "Tamreen added the sessions you accepted. The previous proposal was not applied silently.",
    href: "/plan",
  });
  revalidatePath("/home");
  revalidatePath("/plan");
  return { ok: true };
}

const setSchema = z.object({
  exerciseName: z.string().min(1),
  exerciseId: z.string().uuid().nullable(),
  reps: z.number().int().positive(),
  weightKg: z.number().nonnegative(),
  rpe: z.number().min(1).max(10).nullable(),
  rir: z.number().min(0).max(10).nullable(),
  restSeconds: z.number().int().nonnegative().nullable(),
  tempo: z.string().max(20).nullable(),
  warmup: z.boolean(),
  notes: z.string().max(400),
});

export async function logStrength(input: {
  workoutId: string | null;
  title: string;
  rpe: number;
  fatigue: number;
  notes: string;
  sets: z.infer<typeof setSchema>[];
}) {
  const { supabase, user } = await limit("log_strength", 60, 3600);
  const sets = z.array(setSchema).min(1).parse(input.sets);
  const started = new Date();
  const volume = sets.reduce((sum, set) => sum + (set.warmup ? 0 : set.reps * set.weightKg), 0);
  const load = Math.round(sets.filter((set) => !set.warmup).length * 8 * (input.rpe / 10));
  const { data: completed, error } = await supabase.from("completed_workouts").insert({
    workout_id: input.workoutId,
    user_id: user.id,
    sport: "strength",
    title: input.title,
    started_at: started.toISOString(),
    ended_at: new Date().toISOString(),
    duration_min: Math.max(20, sets.length * 3),
    rpe: input.rpe,
    fatigue: input.fatigue,
    load,
    notes: input.notes,
  }).select("id").single();
  if (error || !completed) throw new Error(error?.message ?? "Workout was not saved.");
  await supabase.from("completed_sets").insert(sets.map((set, index) => ({
    completed_workout_id: completed.id,
    exercise_id: set.exerciseId,
    exercise_name: set.exerciseName,
    set_number: index + 1,
    reps: set.reps,
    weight_kg: set.weightKg,
    rpe: set.rpe,
    rir: set.rir,
    rest_seconds: set.restSeconds,
    tempo: set.tempo,
    is_warmup: set.warmup,
    notes: set.notes,
  })));
  await supabase.from("strength_sessions").insert({
    completed_workout_id: completed.id,
    user_id: user.id,
    total_sets: sets.filter((set) => !set.warmup).length,
    total_reps: sets.reduce((sum, set) => sum + (set.warmup ? 0 : set.reps), 0),
    total_volume_kg: volume,
    focus: input.title,
  });
  if (input.workoutId) {
    await supabase.from("workouts").update({ status: "completed" }).eq("id", input.workoutId).eq("user_id", user.id);
  }
  await recordLiftPrs(supabase, user.id, sets);
  await refreshScores(supabase, user.id);
  revalidatePath("/home");
  revalidatePath("/records");
  return { ok: true, volume };
}

async function recordLiftPrs(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  sets: z.infer<typeof setSchema>[],
) {
  const best = new Map<string, number>();
  for (const set of sets) {
    if (set.warmup) continue;
    const epley = set.weightKg * (1 + set.reps / 30);
    best.set(set.exerciseName, Math.max(best.get(set.exerciseName) ?? 0, epley));
  }
  for (const [name, estimate] of best) {
    const { data: existing } = await supabase.from("personal_records").select("value").eq("user_id", userId).eq("sport", "strength").eq("record_type", name).order("value", { ascending: false }).limit(1).maybeSingle();
    if (isPersonalRecord(existing?.value ?? null, estimate, true)) {
      await supabase.from("personal_records").insert({
        user_id: userId,
        sport: "strength",
        record_type: name,
        value: Math.round(estimate * 10) / 10,
        unit: "kg e1rm",
        achieved_on: new Date().toISOString().slice(0, 10),
      });
    }
  }
}

const runSchema = z.object({
  workoutId: z.string().uuid().nullable(),
  title: z.string().min(1),
  sessionType: z.string().min(1),
  distanceM: z.number().positive(),
  durationSeconds: z.number().int().positive(),
  avgHr: z.number().int().positive().nullable(),
  hrStart: z.number().int().positive().nullable(),
  hrEnd: z.number().int().positive().nullable(),
  cadence: z.number().int().positive().nullable(),
  elevationM: z.number().nullable(),
  splits: z.array(z.number().positive()).max(60),
  rpe: z.number().min(1).max(10),
  notes: z.string().max(500),
});

export async function logRun(input: z.infer<typeof runSchema>) {
  const parsed = runSchema.parse(input);
  const { supabase, user } = await limit("log_run", 40, 3600);
  const analysis = analyzeRun({
    distanceM: parsed.distanceM,
    durationSeconds: parsed.durationSeconds,
    splitsSecPerKm: parsed.splits,
    hrStart: parsed.hrStart,
    hrEnd: parsed.hrEnd,
  });
  const intensity = parsed.sessionType === "intervals" || parsed.sessionType === "vo2" ? "vo2" : parsed.sessionType === "tempo" || parsed.sessionType === "threshold" ? "threshold" : "easy";
  const { data: completed, error } = await supabase.from("completed_workouts").insert({
    workout_id: parsed.workoutId,
    user_id: user.id,
    sport: "running",
    title: parsed.title,
    started_at: new Date(Date.now() - parsed.durationSeconds * 1000).toISOString(),
    ended_at: new Date().toISOString(),
    duration_min: Math.round(parsed.durationSeconds / 60),
    rpe: parsed.rpe,
    load: sessionLoad(Math.round(parsed.durationSeconds / 60), intensity, "running"),
    notes: parsed.notes,
  }).select("id").single();
  if (error || !completed) throw new Error(error?.message ?? "Run was not saved.");
  await supabase.from("running_sessions").insert({
    completed_workout_id: completed.id,
    user_id: user.id,
    session_type: parsed.sessionType,
    distance_m: parsed.distanceM,
    duration_seconds: parsed.durationSeconds,
    avg_pace_sec_per_km: analysis.paceSecPerKm,
    avg_hr: parsed.avgHr,
    cadence: parsed.cadence,
    elevation_m: parsed.elevationM,
    splits: parsed.splits,
    consistency: analysis.consistency,
    aerobic_efficiency: analysis.aerobicEfficiency,
    insight: analysis.insight,
  });
  if (parsed.workoutId) await supabase.from("workouts").update({ status: "completed" }).eq("id", parsed.workoutId).eq("user_id", user.id);
  await maybeDistancePr(supabase, user.id, "running", parsed.distanceM, parsed.durationSeconds);
  await refreshScores(supabase, user.id);
  revalidatePath("/home");
  return { id: completed.id, analysis };
}

async function maybeDistancePr(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  sport: string,
  distanceM: number,
  durationSeconds: number,
) {
  const buckets: Array<[string, number]> = [["1k", 1000], ["5k", 5000], ["10k", 10000], ["half", 21097], ["marathon", 42195]];
  const match = buckets.find(([, meters]) => Math.abs(distanceM - meters) / meters < 0.03);
  if (!match) return;
  const { data: existing } = await supabase.from("personal_records").select("value").eq("user_id", userId).eq("sport", sport).eq("record_type", match[0]).order("value").limit(1).maybeSingle();
  if (isPersonalRecord(existing?.value ?? null, durationSeconds, false)) {
    await supabase.from("personal_records").insert({
      user_id: userId,
      sport,
      record_type: match[0],
      value: durationSeconds,
      unit: "seconds",
      achieved_on: new Date().toISOString().slice(0, 10),
    });
  }
}

export async function logRide(input: {
  title: string;
  sessionType: string;
  distanceM: number;
  durationSeconds: number;
  avgPower: number | null;
  normalizedPower: number | null;
  ftp: number | null;
  cadence: number | null;
  avgHr: number | null;
  elevationM: number | null;
  rpe: number;
  notes: string;
  workoutId: string | null;
}) {
  const { supabase, user } = await limit("log_ride", 40, 3600);
  const intensity: Intensity = input.sessionType === "vo2" ? "vo2" : input.sessionType === "threshold" || input.sessionType === "sweet_spot" ? "threshold" : "easy";
  const { data: completed, error } = await supabase.from("completed_workouts").insert({
    workout_id: input.workoutId,
    user_id: user.id,
    sport: "cycling",
    title: input.title,
    started_at: new Date(Date.now() - input.durationSeconds * 1000).toISOString(),
    ended_at: new Date().toISOString(),
    duration_min: Math.max(1, Math.round(input.durationSeconds / 60)),
    rpe: input.rpe,
    load: sessionLoad(Math.round(input.durationSeconds / 60), intensity, "cycling"),
    notes: input.notes,
  }).select("id").single();
  if (error || !completed) throw new Error(error?.message ?? "Ride was not saved.");
  await supabase.from("cycling_sessions").insert({
    completed_workout_id: completed.id,
    user_id: user.id,
    session_type: input.sessionType,
    distance_m: input.distanceM,
    duration_seconds: input.durationSeconds,
    avg_speed_kph: input.durationSeconds > 0 ? (input.distanceM / 1000) / (input.durationSeconds / 3600) : null,
    avg_power: input.avgPower,
    normalized_power: input.normalizedPower,
    ftp: input.ftp,
    cadence: input.cadence,
    avg_hr: input.avgHr,
    elevation_m: input.elevationM,
  });
  if (input.ftp) {
    const { data: existing } = await supabase.from("personal_records").select("value").eq("user_id", user.id).eq("sport", "cycling").eq("record_type", "ftp").order("value", { ascending: false }).limit(1).maybeSingle();
    if (isPersonalRecord(existing?.value ?? null, input.ftp, true)) {
      await supabase.from("personal_records").insert({
        user_id: user.id,
        sport: "cycling",
        record_type: "ftp",
        value: input.ftp,
        unit: "watts",
        achieved_on: new Date().toISOString().slice(0, 10),
      });
    }
  }
  if (input.workoutId) await supabase.from("workouts").update({ status: "completed" }).eq("id", input.workoutId);
  await refreshScores(supabase, user.id);
  revalidatePath("/home");
  return { ok: true };
}

export async function logSwim(input: {
  title: string;
  sessionType: string;
  distanceM: number;
  durationSeconds: number;
  laps: number | null;
  strokeRate: number | null;
  strokeCount: number | null;
  swolf: number | null;
  rpe: number;
  notes: string;
  workoutId: string | null;
}) {
  const { supabase, user } = await limit("log_swim", 40, 3600);
  const pace = input.distanceM > 0 ? input.durationSeconds / (input.distanceM / 100) : null;
  const { data: completed, error } = await supabase.from("completed_workouts").insert({
    workout_id: input.workoutId,
    user_id: user.id,
    sport: "swimming",
    title: input.title,
    started_at: new Date(Date.now() - input.durationSeconds * 1000).toISOString(),
    ended_at: new Date().toISOString(),
    duration_min: Math.max(1, Math.round(input.durationSeconds / 60)),
    rpe: input.rpe,
    load: sessionLoad(Math.round(input.durationSeconds / 60), input.sessionType === "threshold" ? "threshold" : "easy", "swimming"),
    notes: input.notes,
  }).select("id").single();
  if (error || !completed) throw new Error(error?.message ?? "Swim was not saved.");
  await supabase.from("swimming_sessions").insert({
    completed_workout_id: completed.id,
    user_id: user.id,
    session_type: input.sessionType,
    distance_m: input.distanceM,
    duration_seconds: input.durationSeconds,
    pace_sec_per_100m: pace,
    laps: input.laps,
    stroke_rate: input.strokeRate,
    stroke_count: input.strokeCount,
    swolf: input.swolf,
  });
  if (input.workoutId) await supabase.from("workouts").update({ status: "completed" }).eq("id", input.workoutId);
  await refreshScores(supabase, user.id);
  revalidatePath("/home");
  return { ok: true };
}

export async function logRecovery(input: {
  sleepHours: number;
  sleepQuality: number;
  soreness: number;
  fatigue: number;
  motivation: number;
  stress: number;
  restingHr: number | null;
  hrv: number | null;
  notes: string;
  severeSymptoms: string[];
}) {
  const { supabase, user } = await limit("recovery", 20, 3600);
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).single();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const scale = (value: number) => Math.min(5, Math.max(1, Math.round(value)));
  const { error } = await supabase.from("recovery_logs").upsert({
    user_id: user.id,
    logged_on: today,
    sleep_hours: input.sleepHours,
    sleep_quality: scale(input.sleepQuality),
    soreness: scale(input.soreness),
    fatigue: scale(input.fatigue),
    motivation: scale(input.motivation),
    stress: scale(input.stress),
    resting_hr: input.restingHr,
    hrv: input.hrv,
    notes: input.notes,
    severe_symptoms: input.severeSymptoms,
  }, { onConflict: "user_id,logged_on" });
  if (error) throw new Error(error.message);
  await refreshScores(supabase, user.id);
  const { data: readiness } = await supabase.from("readiness_scores").select("train_recommendation, blocked_for_safety").eq("user_id", user.id).eq("scored_on", today).maybeSingle();
  if (readiness && (readiness.blocked_for_safety || readiness.train_recommendation === "easy_only" || readiness.train_recommendation === "rest")) {
    await supabase.from("notifications").insert({
      user_id: user.id,
      kind: "recovery",
      title: "Recovery check",
      body: readiness.blocked_for_safety
        ? "Today's check-in includes a safety flag. Training guidance is paused."
        : "Your recovery is lower than a normal training day. Review today's session before you start.",
      href: "/recovery",
    });
  }
  revalidatePath("/home");
  revalidatePath("/recovery");
  return { ok: true };
}

export async function moveWorkout(id: string, date: string, confirm: boolean) {
  const { supabase, user } = await limit("move_workout", 40, 3600);
  const { data: workout } = await supabase.from("workouts").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!workout) throw new Error("Workout not found.");
  const { data: nearby } = await supabase.from("workouts").select("*").eq("user_id", user.id).is("deleted_at", null).gte("scheduled_date", date).lte("scheduled_date", date);
  const draft: PlannedSession[] = [toPlanned({ ...workout, scheduled_date: date }), ...(nearby ?? []).filter((row) => row.id !== id).map(toPlanned)];
  const conflicts = findConflicts(draft);
  if (conflicts.length && !confirm) {
    return { ok: false, conflicts };
  }
  await supabase.from("workouts").update({ scheduled_date: date, moved_from: workout.scheduled_date, status: "moved" }).eq("id", id);
  revalidatePath("/calendar");
  revalidatePath("/plan");
  return { ok: true, conflicts };
}

export async function setWorkoutStatus(id: string, status: "skipped" | "completed" | "missed") {
  const { supabase, user } = await limit("workout_status", 40, 3600);
  const { data: workout } = await supabase.from("workouts").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!workout) throw new Error("Workout not found.");
  await supabase.from("workouts").update({ status }).eq("id", id);
  if (status === "missed" || status === "skipped") {
    const { data: upcoming } = await supabase.from("workouts").select("*").eq("user_id", user.id).eq("status", "planned").is("deleted_at", null).gt("scheduled_date", workout.scheduled_date).order("scheduled_date").limit(4);
    const { data: recovery } = await supabase.from("readiness_scores").select("overall").eq("user_id", user.id).order("scored_on", { ascending: false }).limit(1).maybeSingle();
    const adaptation = adaptMissedSession(toPlanned(workout), (upcoming ?? []).map(toPlanned), (recovery?.overall ?? 70) < 55);
    await supabase.from("ai_recommendations").insert({
      user_id: user.id,
      kind: "missed_session",
      title: adaptation.title,
      body: adaptation.body,
      factors: adaptation.factors.map((factor) => ({ label: "Factor", detail: factor })),
      proposed_changes: adaptation.changes,
      status: "pending",
    });
  }
  revalidatePath("/home");
  revalidatePath("/plan");
  return { ok: true };
}

export async function optimizeOpenConflicts() {
  const { supabase, user } = await limit("optimize", 12, 3600);
  const ctx = await contextFor(user.id, supabase);
  const today = ctx.startDate;
  const { data: rows } = await supabase.from("workouts").select("*").eq("user_id", user.id).eq("status", "planned").is("deleted_at", null).gte("scheduled_date", today).order("scheduled_date").limit(12);
  const sessions = (rows ?? []).map(toPlanned);
  const optimized = optimizeWeek(ctx, sessions);
  for (const change of optimized.changes) {
    const row = (rows ?? []).find((item) => item.title === change.title && item.scheduled_date === change.fromDate);
    if (!row) continue;
    await supabase.from("workouts").update({ scheduled_date: change.toDate, moved_from: change.fromDate, why_text: `${row.why_text} ${change.reason}` }).eq("id", row.id);
  }
  await supabase.from("training_conflicts").update({ status: "optimized" }).eq("user_id", user.id).eq("status", "open");
  await supabase.from("ai_recommendations").insert({
    user_id: user.id,
    kind: "schedule_optimization",
    title: "Schedule optimized",
    body: optimized.explanation,
    factors: optimized.changes.map((change) => ({ label: change.title, detail: `${change.fromDate} → ${change.toDate}. ${change.reason}` })),
    proposed_changes: optimized.changes,
    status: "applied",
  });
  revalidatePath("/home");
  revalidatePath("/plan");
  return { explanation: optimized.explanation, changes: optimized.changes };
}

export async function askCoach(question: string) {
  const { supabase, user } = await limit("coach", 40, 3600);
  const ctx = await contextFor(user.id, supabase);
  const today = ctx.startDate;
  const [{ data: profile }, { data: workout }, { data: readinessRow }, { data: conflicts }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase.from("workouts").select("*").eq("user_id", user.id).eq("scheduled_date", today).is("deleted_at", null).limit(1).maybeSingle(),
    supabase.from("readiness_scores").select("*").eq("user_id", user.id).order("scored_on", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("training_conflicts").select("title, explanation, severity").eq("user_id", user.id).eq("status", "open").limit(5),
  ]);
  const answer = answerCoach({
    name: profile?.full_name ?? "Athlete",
    primaryGoal: ctx.primaryGoal,
    today: workout ? toPlanned(workout) : null,
    readiness: readinessRow ? {
      blockedForSafety: readinessRow.blocked_for_safety,
      trainRecommendation: readinessRow.train_recommendation,
      overall: readinessRow.overall,
      sleep: readinessRow.sleep,
      recovery: readinessRow.recovery,
      recentLoad: readinessRow.recent_load,
      muscleFatigue: readinessRow.muscle_fatigue,
      cardioFatigue: readinessRow.cardio_fatigue,
      explanation: readinessRow.explanation,
      factors: Array.isArray(readinessRow.factors) ? readinessRow.factors : [],
    } : null,
    conflicts: (conflicts ?? []).map((conflict, index) => ({
      severity: conflict.severity,
      title: conflict.title,
      explanation: conflict.explanation,
      factors: [],
      sessionA: index,
      sessionB: index,
    })),
    recentMiss: null,
    eventName: ctx.eventName,
    daysToEvent: ctx.eventDate ? Math.round((Date.parse(ctx.eventDate) - Date.parse(today)) / 86_400_000) : null,
    consistency: null,
    question,
  });
  if (answer.proposedChanges.length) {
    await supabase.from("ai_recommendations").insert({
      user_id: user.id,
      kind: "coach",
      title: answer.title,
      body: answer.answer,
      factors: answer.factors,
      proposed_changes: answer.proposedChanges,
      status: "pending",
    });
  }
  revalidatePath("/ai");
  return answer;
}

export async function saveLiveSession(input: {
  exerciseSlug: string;
  durationSeconds: number;
  manualReps: number;
  manualSets: number;
  cameraUsed: boolean;
  savePlaceholder: boolean;
  notes: string;
}) {
  const { supabase, user } = await limit("live_session", 30, 3600);
  const analysisSource = input.savePlaceholder ? "placeholder_demo" : input.manualReps > 0 ? "manual" : "unavailable";
  const { data, error } = await supabase.from("live_training_sessions").insert({
    user_id: user.id,
    exercise_slug: input.exerciseSlug,
    started_at: new Date(Date.now() - input.durationSeconds * 1000).toISOString(),
    ended_at: new Date().toISOString(),
    duration_seconds: input.durationSeconds,
    camera_used: input.cameraUsed,
    manual_reps: input.manualReps,
    manual_sets: input.manualSets,
    analysis_source: analysisSource,
    notes: input.notes,
  }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Live session was not saved.");
  if (input.savePlaceholder && input.exerciseSlug === "squat") {
    await supabase.from("form_analysis").insert({
      session_id: data.id,
      exercise_slug: input.exerciseSlug,
      source: "placeholder_demo",
      is_placeholder: true,
      overall_score: 84,
      metrics: { depth: 92, knee_tracking: 78, torso: 85, tempo: 81 },
      best_note: "Placeholder example: consistent squat depth.",
      improve_note: "Placeholder example, not a measurement of this session.",
    });
  }
  revalidatePath("/live");
  return { id: data.id };
}

export async function updateSettings(input: {
  unitSystem: "metric" | "imperial";
  distanceUnit: "km" | "mi";
  weightUnit: "kg" | "lb";
  theme: "system" | "light" | "dark";
  notifications: Record<string, boolean>;
}) {
  const { supabase, user } = await limit("settings", 30, 3600);
  const { error } = await supabase.from("user_settings").update({
    unit_system: input.unitSystem,
    distance_unit: input.distanceUnit,
    weight_unit: input.weightUnit,
    theme: input.theme,
    notify_workout: input.notifications.workout ?? true,
    notify_recovery: input.notifications.recovery ?? true,
    notify_conflicts: input.notifications.conflicts ?? true,
    notify_prs: input.notifications.prs ?? true,
    notify_events: input.notifications.events ?? true,
    notify_coach: input.notifications.coach ?? true,
    notify_plan_changes: input.notifications.plan ?? true,
  }).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  return { ok: true };
}

export async function createPersonalEvent(input: { name: string; eventType: string; date: string; distanceM: number | null; goalTimeSeconds: number | null; location: string }) {
  const { supabase, user } = await limit("event", 20, 3600);
  const { error } = await supabase.from("events").insert({
    owner_user_id: user.id,
    name: input.name,
    event_type: input.eventType,
    discipline: input.eventType,
    starts_on: input.date,
    distance_m: input.distanceM,
    goal_time_seconds: input.goalTimeSeconds,
    location: input.location,
    description: "",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/events");
  return { ok: true };
}

export async function coachFeedback(athleteId: string, body: string, workoutId: string | null) {
  const { supabase, user } = await limit("coach_feedback", 30, 3600);
  const { error } = await supabase.from("coach_feedback").insert({
    coach_id: user.id,
    athlete_id: athleteId,
    workout_id: workoutId,
    body,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/coach");
  return { ok: true };
}

export async function inviteAthlete(athleteId: string) {
  const { supabase, user } = await limit("coach_invite", 20, 3600);
  const { error } = await supabase.from("coach_athletes").insert({ coach_id: user.id, athlete_id: athleteId, status: "pending" });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function respondToCoach(id: string, accept: boolean) {
  const { supabase } = await limit("coach_response", 20, 3600);
  const { error } = await supabase.from("coach_athletes").update({ status: accept ? "active" : "revoked" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  return { ok: true };
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function markNotificationsRead() {
  const { supabase, user } = await limit("notifications", 30, 3600);
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/notifications");
  return { ok: true };
}

export async function submitFeedback(body: string) {
  const text = z.string().trim().min(4).max(2000).parse(body);
  const { supabase, user } = await limit("feedback", 10, 3600);
  const { error } = await supabase.from("product_feedback").insert({ user_id: user.id, body: text });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function createGym(input: { name: string; location: string }) {
  const name = z.string().trim().min(2).max(80).parse(input.name);
  const { supabase, user } = await limit("gym", 12, 3600);
  const { error } = await supabase.from("gyms").insert({
    name,
    location: input.location.slice(0, 120),
    owner_id: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/gym");
  return { ok: true };
}

export async function addGymCamera(input: {
  gymId: string;
  name: string;
  location: string;
  mode: "qr_checkin" | "session_assignment" | "authenticated_device" | "manual";
}) {
  const { supabase } = await limit("gym_camera", 20, 3600);
  const { error } = await supabase.from("gym_cameras").insert({
    gym_id: input.gymId,
    name: input.name.slice(0, 80),
    location: input.location.slice(0, 120),
    identification_mode: input.mode,
    facial_recognition_enabled: false,
    status: "offline",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/gym");
  return { ok: true };
}

export async function addGymEquipment(input: { gymId: string; name: string; quantity: number }) {
  const { supabase } = await limit("gym_equipment", 30, 3600);
  const { error } = await supabase.from("gym_equipment").insert({
    gym_id: input.gymId,
    name: input.name.slice(0, 80),
    quantity: Math.max(1, Math.round(input.quantity)),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/gym");
  return { ok: true };
}

export async function createEventOrganization(name: string) {
  const label = z.string().trim().min(2).max(80).parse(name);
  const { supabase, user } = await limit("event_org", 10, 3600);
  const { error } = await supabase.from("event_organizations").insert({ name: label, owner_id: user.id });
  if (error) throw new Error(error.message);
  revalidatePath("/event-admin");
  return { ok: true };
}

export async function createManagedEvent(input: {
  organizationId: string;
  name: string;
  eventType: string;
  date: string;
  location: string;
  distanceM: number | null;
}) {
  const { supabase } = await limit("managed_event", 20, 3600);
  const { error } = await supabase.from("events").insert({
    organization_id: input.organizationId,
    name: input.name.slice(0, 120),
    event_type: input.eventType.slice(0, 80),
    discipline: input.eventType.slice(0, 80),
    starts_on: input.date,
    location: input.location.slice(0, 120),
    distance_m: input.distanceM,
    is_public: true,
    description: "Created from the event desk.",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/event-admin");
  return { ok: true };
}

export async function recordEventResult(input: {
  eventId: string;
  athleteId: string;
  finishSeconds: number;
  splits: number[];
}) {
  const { supabase } = await limit("event_result", 30, 3600);
  const { data: registration, error: registrationError } = await supabase.from("event_registrations").upsert({
    event_id: input.eventId,
    user_id: input.athleteId,
    status: "finished",
  }, { onConflict: "event_id,user_id" }).select("id").single();
  if (registrationError || !registration) throw new Error(registrationError?.message ?? "Registration was not saved.");
  const splits = input.splits.filter((split) => split > 0).slice(0, 50);
  const analysis = splitConsistency(splits);
  const distance = splits.length ? splits.length * 1000 : null;
  const { error } = await supabase.from("event_results").upsert({
    registration_id: registration.id,
    finish_time_seconds: input.finishSeconds,
    pace_sec_per_km: distance ? input.finishSeconds / (distance / 1000) : null,
    splits,
    consistency_score: analysis.consistency,
    technique_note: "Technique was not scored. Tamreen does not infer mechanics without camera data from a real model.",
    ai_insight: analysis.insight,
  }, { onConflict: "registration_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/event-admin");
  revalidatePath("/events");
  return { ok: true };
}

function splitConsistency(splits: number[]): { consistency: number | null; insight: string } {
  if (splits.length < 3) {
    return {
      consistency: null,
      insight: "Fewer than three kilometre splits were entered, so consistency was not scored.",
    };
  }
  const mean = splits.reduce((sum, split) => sum + split, 0) / splits.length;
  const variance = splits.reduce((sum, split) => sum + (split - mean) ** 2, 0) / splits.length;
  const cv = Math.sqrt(variance) / mean;
  const consistency = Math.round(Math.max(0, Math.min(100, 100 - cv * 180)));
  let slowestIndex = 0;
  splits.forEach((split, index) => {
    if (split > splits[slowestIndex]) slowestIndex = index;
  });
  return {
    consistency,
    insight: `Consistency is ${consistency} from the coefficient of variation of the entered splits. The slowest split is kilometre ${slowestIndex + 1}. This uses the times that were entered. It is not a camera measurement.`,
  };
}

function toPlanned(row: {
  scheduled_date: string;
  sport: string;
  title: string;
  objective?: string | null;
  duration_min: number;
  intensity: string;
  expected_load?: number | null;
  importance?: string | null;
  recovery_hours?: number | null;
  why_text?: string | null;
}): PlannedSession {
  const sport = row.sport as Sport;
  const intensity = row.intensity as Intensity;
  const lower = row.title.toLowerCase().includes("lower") || row.title.toLowerCase().includes("long") || sport === "running";
  return {
    date: row.scheduled_date,
    sport,
    title: row.title,
    objective: row.objective ?? "",
    durationMin: row.duration_min,
    intensity,
    expectedLoad: Number(row.expected_load ?? 0),
    importance: (row.importance as PlannedSession["importance"]) ?? "supporting",
    recoveryHours: row.recovery_hours ?? 24,
    why: row.why_text ?? "",
    lowerBody: lower,
    quality: ["tempo", "threshold", "vo2", "race"].includes(intensity),
    phase: "build",
    structure: {},
    zones: {},
    exercises: [],
  };
}

async function refreshScores(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string) {
  const { data: athlete } = await supabase.from("athlete_profiles").select("*").eq("user_id", userId).single();
  const { data: profile } = await supabase.from("profiles").select("sex").eq("id", userId).single();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const since = new Date(`${today}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 28);
  const [{ data: planned }, { data: completed }, { data: runs }, { data: recovery }, { data: goal }] = await Promise.all([
    supabase.from("workouts").select("id", { count: "exact" }).eq("user_id", userId).gte("scheduled_date", since.toISOString().slice(0, 10)).lte("scheduled_date", today).is("deleted_at", null),
    supabase.from("completed_workouts").select("id, sport, load, started_at").eq("user_id", userId).gte("started_at", since.toISOString()),
    supabase.from("running_sessions").select("distance_m, duration_seconds, session_type").eq("user_id", userId).order("id", { ascending: false }).limit(12),
    supabase.from("recovery_logs").select("*").eq("user_id", userId).order("logged_on", { ascending: false }).limit(7),
    supabase.from("athlete_goals").select("is_primary, goals(slug)").eq("user_id", userId).eq("is_primary", true).maybeSingle(),
  ]);
  const goalJoin = goal?.goals as { slug?: string } | { slug?: string }[] | null;
  const primary = (Array.isArray(goalJoin) ? goalJoin[0]?.slug : goalJoin?.slug) ?? "general_hybrid";
  const latestRecovery = recovery?.[0];
  const acute = (completed ?? []).filter((row) => Date.parse(row.started_at) > Date.now() - 7 * 86_400_000).reduce((sum, row) => sum + Number(row.load ?? 0), 0);
  const chronic = (completed ?? []).reduce((sum, row) => sum + Number(row.load ?? 0), 0) / 4;
  const lower48 = (completed ?? []).filter((row) => ["running", "strength"].includes(row.sport) && Date.parse(row.started_at) > Date.now() - 2 * 86_400_000).reduce((sum, row) => sum + Number(row.load ?? 0), 0);
  const hard48 = (completed ?? []).filter((row) => Date.parse(row.started_at) > Date.now() - 2 * 86_400_000).reduce((sum, row) => sum + Number(row.load ?? 0), 0);
  if (latestRecovery) {
    const readiness = scoreReadiness({
      sleepHours: latestRecovery.sleep_hours,
      sleepQuality: latestRecovery.sleep_quality,
      soreness: latestRecovery.soreness,
      fatigue: latestRecovery.fatigue,
      motivation: latestRecovery.motivation,
      stress: latestRecovery.stress,
      hrv: latestRecovery.hrv,
      hrvBaseline: null,
      severeSymptoms: latestRecovery.severe_symptoms ?? [],
      acuteLoad: acute,
      chronicLoad: Math.max(chronic, 1),
      lowerBodyLoad48h: lower48,
      hardEnduranceLoad48h: hard48,
    });
    await supabase.from("readiness_scores").upsert({
      user_id: userId,
      scored_on: today,
      overall: readiness.overall,
      sleep: readiness.sleep,
      recovery: readiness.recovery,
      recent_load: readiness.recentLoad,
      muscle_fatigue: readiness.muscleFatigue,
      cardio_fatigue: readiness.cardioFatigue,
      train_recommendation: readiness.trainRecommendation,
      explanation: readiness.explanation,
      factors: readiness.factors,
      blocked_for_safety: readiness.blockedForSafety,
    }, { onConflict: "user_id,scored_on" });
  }
  const tenK = (runs ?? []).find((run) => Math.abs(Number(run.distance_m) - 10000) / 10000 < 0.05);
  const pace = tenK ? Number(tenK.duration_seconds) / (Number(tenK.distance_m) / 1000) : athlete?.reported_10k_seconds ? athlete.reported_10k_seconds / 10 : null;
  const target = primary === "improve_10k" ? 300 : athlete?.reported_10k_seconds ? athlete.reported_10k_seconds / 10 : 300;
  const parts = [
    strengthScore({
      sex: profile?.sex ?? null,
      weightKg: athlete?.weight_kg ?? null,
      squatKg: athlete?.squat_kg ?? null,
      benchKg: athlete?.bench_kg ?? null,
      deadliftKg: athlete?.deadlift_kg ?? null,
    }),
    runningScore(pace, pace ? target : null),
    cyclingScore(athlete?.ftp_watts ?? null, athlete?.weight_kg ?? null),
    swimmingScore(athlete?.swim_100m_seconds ?? null),
    consistencyScore((completed ?? []).length, planned?.length ?? 0),
  ].filter((score): score is NonNullable<typeof score> => Boolean(score));
  const combined = overallScore(parts, primary);
  const rows = [...parts, combined].filter((score): score is NonNullable<typeof score> => Boolean(score)).map((score) => ({
    user_id: userId,
    scored_on: today,
    dimension: score.dimension,
    score: score.score,
    explanation: score.explanation,
    factors: score.factors,
    sample_size: score.sampleSize,
  }));
  if (rows.length) {
    await supabase.from("performance_scores").upsert(rows, { onConflict: "user_id,scored_on,dimension" });
  }
}
