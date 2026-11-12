"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ageFromDob, computeDailyTargets, exerciseKcalFromLoad, mapGoalSlug } from "@/services/nutrition/calories";
import { scoreBenchmarks, scoreSelfReport, mergeHybrid } from "@/services/fitness/assessment";
import { buildPhasePlan, findEventTemplate, readinessEvidence } from "@/services/events/templates";
import { recommendSportPriorities } from "@/services/training/priorities";
import { buildWeeklyReview } from "@/services/weekly/review";
import { shiftIsoDate, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "./guard";

async function limit(action: string, maxCalls: number, windowSeconds: number) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    action,
    max_calls: maxCalls,
    window_seconds: windowSeconds,
  });
  if (error || data !== true) throw new Error("Too many requests. Wait a moment and try again.");
  return { supabase, user };
}

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    /* ignore */
  }
}

const prefsSchema = z.object({
  dietaryPattern: z.enum(["none", "halal", "vegetarian", "vegan", "pescatarian", "kosher", "custom"]),
  allergies: z.array(z.string().max(60)).max(20),
  dislikedFoods: z.array(z.string().max(60)).max(20),
  cuisinePreferences: z.array(z.string().max(40)).max(12),
  nutritionMode: z.enum(["flexible", "structured"]),
  schedulingMode: z.enum(["adaptive", "fixed"]),
  sportPriorityMode: z.enum(["ai_recommended", "athlete_controlled"]),
  mealFrequency: z.number().int().min(1).max(8),
  budgetLevel: z.enum(["low", "moderate", "high"]),
  assessmentPath: z.enum(["self_report", "benchmark", "hybrid"]),
  healthDataConsent: z.boolean(),
  notes: z.string().max(500).optional(),
  sportPriorities: z.array(z.object({
    sport: z.string(),
    priority: z.enum(["primary", "secondary", "maintenance"]),
  })).max(20).optional(),
});

export async function saveAthletePreferences(input: z.infer<typeof prefsSchema>) {
  const parsed = prefsSchema.parse(input);
  const { supabase, user } = await limit("save_prefs", 30, 3600);
  const { error } = await supabase.from("athlete_preferences").upsert({
    user_id: user.id,
    dietary_pattern: parsed.dietaryPattern,
    allergies: parsed.allergies,
    disliked_foods: parsed.dislikedFoods,
    cuisine_preferences: parsed.cuisinePreferences,
    nutrition_mode: parsed.nutritionMode,
    scheduling_mode: parsed.schedulingMode,
    sport_priority_mode: parsed.sportPriorityMode,
    meal_frequency: parsed.mealFrequency,
    budget_level: parsed.budgetLevel,
    assessment_path: parsed.assessmentPath,
    health_data_consent: parsed.healthDataConsent,
    health_data_consent_at: parsed.healthDataConsent ? new Date().toISOString() : null,
    notes: parsed.notes ?? "",
  });
  if (error) return { ok: false as const, message: error.message };

  if (parsed.sportPriorities?.length) {
    const { data: sports } = await supabase.from("sports").select("id, slug");
    const bySlug = new Map((sports ?? []).map((row) => [row.slug, row.id]));
    for (const row of parsed.sportPriorities) {
      const sportId = bySlug.get(row.sport);
      if (!sportId) continue;
      await supabase.from("athlete_sports").update({
        priority_class: row.priority,
        is_primary: row.priority === "primary",
      }).eq("user_id", user.id).eq("sport_id", sportId);
    }
  }

  safeRevalidate("/onboarding");
  safeRevalidate("/profile");
  safeRevalidate("/nutrition");
  return { ok: true as const };
}

export async function activateDraftPlan() {
  const { supabase, user } = await limit("activate_plan", 10, 3600);
  const { data: draft, error } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false as const, message: error.message };
  if (!draft) return { ok: false as const, message: "No draft plan to activate." };

  await supabase.from("training_plans").update({ status: "archived" }).eq("user_id", user.id).eq("status", "active");
  const { error: activateError } = await supabase.from("training_plans").update({ status: "active" }).eq("id", draft.id).eq("user_id", user.id);
  if (activateError) return { ok: false as const, message: activateError.message };

  await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
  await supabase.from("plan_revisions").insert({
    user_id: user.id,
    plan_id: draft.id,
    reason: "athlete_confirmed_onboarding",
    change_summary: "Athlete confirmed the plan preview and activated the initial plan.",
    requires_approval: false,
    approved_at: new Date().toISOString(),
  });
  await supabase.from("notifications").insert({
    user_id: user.id,
    kind: "plan",
    title: "Plan activated",
    body: "Your confirmed training plan is now active.",
    href: "/plan",
  });
  safeRevalidate("/plan");
  safeRevalidate("/home");
  safeRevalidate("/onboarding");
  return { ok: true as const };
}

export async function upsertNutritionTargets(dayType: "training" | "recovery" | "race" | "rest" = "training") {
  const { supabase, user } = await limit("nutrition_targets", 40, 3600);
  const [{ data: profile }, { data: athlete }] = await Promise.all([
    supabase.from("profiles").select("date_of_birth, sex").eq("id", user.id).maybeSingle(),
    supabase.from("athlete_profiles").select("weight_kg, height_cm, timezone").eq("user_id", user.id).maybeSingle(),
  ]);
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const [{ data: goals }, { data: workouts }, { data: completed }] = await Promise.all([
    supabase.from("athlete_goals").select("is_primary, goals(slug)").eq("user_id", user.id),
    supabase.from("workouts").select("expected_load, status").eq("user_id", user.id).eq("scheduled_date", today).is("deleted_at", null),
    supabase.from("completed_workouts").select("load, started_at").eq("user_id", user.id).gte("started_at", `${today}T00:00:00`),
  ]);
  if (athlete?.weight_kg == null || athlete?.height_cm == null || !profile?.date_of_birth) {
    return { ok: false as const, message: "Height, weight, and date of birth are required before calorie targets can be calculated." };
  }
  const age = ageFromDob(profile.date_of_birth, today);
  if (age == null) return { ok: false as const, message: "Date of birth could not be used for metabolic estimates." };

  const primary = (goals ?? []).find((row) => row.is_primary);
  const joined = primary?.goals as { slug?: string } | { slug?: string }[] | null;
  const slug = Array.isArray(joined) ? joined[0]?.slug : joined?.slug;
  const plannedLoad = (workouts ?? []).filter((row) => row.status === "planned").reduce((sum, row) => sum + Number(row.expected_load ?? 0), 0);
  const completedLoad = (completed ?? []).reduce((sum, row) => sum + Number(row.load ?? 0), 0);
  const targets = computeDailyTargets({
    weightKg: Number(athlete.weight_kg),
    heightCm: Number(athlete.height_cm),
    ageYears: age,
    sex: (profile.sex as "female" | "male" | "other" | "prefer_not_to_say" | null) ?? null,
    plannedExerciseKcal: exerciseKcalFromLoad(plannedLoad, Number(athlete.weight_kg)),
    completedExerciseKcal: completedLoad > 0 ? exerciseKcalFromLoad(completedLoad, Number(athlete.weight_kg)) : null,
    dayType,
    primaryGoal: mapGoalSlug(slug ?? "endurance"),
  });

  const { error } = await supabase.from("nutrition_targets").upsert({
    user_id: user.id,
    target_date: today,
    calories_kcal: targets.caloriesKcal,
    protein_g: targets.proteinG,
    carbs_g: targets.carbsG,
    fat_g: targets.fatG,
    hydration_ml: targets.hydrationMl,
    bmr_kcal: targets.bmrKcal,
    tdee_kcal: targets.tdeeKcal,
    exercise_kcal: targets.exerciseKcal,
    goal_adjustment_kcal: targets.goalAdjustmentKcal,
    day_type: dayType,
    method: targets.method,
    explanation: targets.explanation,
    factors: [...targets.factors, ...targets.limitations.map((detail) => ({ label: "Limitation", detail }))],
  }, { onConflict: "user_id,target_date" });
  if (error) return { ok: false as const, message: error.message };

  await supabase.from("decision_explanations").insert({
    user_id: user.id,
    domain: "nutrition",
    title: "Daily nutrition targets",
    body: targets.explanation,
    factors: targets.factors,
    assumptions: [{ label: "Equation", detail: "Mifflin–St Jeor BMR with day-type multiplier." }],
    limitations: targets.limitations,
  });

  safeRevalidate("/nutrition");
  return { ok: true as const, targets };
}

const foodEntrySchema = z.object({
  foodName: z.string().trim().min(1).max(160),
  foodId: z.string().uuid().nullable().optional(),
  mealSlot: z.enum(["breakfast", "lunch", "dinner", "snack", "pre_workout", "during_workout", "post_workout", "other"]),
  entryMethod: z.enum(["photo", "natural_language", "barcode", "search", "manual", "saved_meal"]),
  quantity: z.number().positive().max(50),
  unit: z.string().max(40),
  grams: z.number().positive().nullable().optional(),
  caloriesKcal: z.number().min(0).max(5000),
  proteinG: z.number().min(0).max(400),
  carbsG: z.number().min(0).max(800),
  fatG: z.number().min(0).max(400),
  rawInput: z.string().max(1000).optional(),
  notes: z.string().max(400).optional(),
  confirmed: z.boolean().default(true),
});

export async function logFoodEntry(input: z.infer<typeof foodEntrySchema>) {
  const parsed = foodEntrySchema.parse(input);
  const { supabase, user } = await limit("log_food", 120, 3600);
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const { error } = await supabase.from("food_entries").insert({
    user_id: user.id,
    logged_on: today,
    meal_slot: parsed.mealSlot,
    entry_method: parsed.entryMethod,
    food_id: parsed.foodId ?? null,
    food_name: parsed.foodName,
    quantity: parsed.quantity,
    unit: parsed.unit,
    grams: parsed.grams ?? null,
    calories_kcal: parsed.caloriesKcal,
    protein_g: parsed.proteinG,
    carbs_g: parsed.carbsG,
    fat_g: parsed.fatG,
    raw_input: parsed.rawInput ?? null,
    notes: parsed.notes ?? "",
    confirmed: parsed.confirmed,
  });
  if (error) return { ok: false as const, message: error.message };
  safeRevalidate("/nutrition");
  return { ok: true as const };
}

export async function logHydration(amountMl: number) {
  if (!Number.isFinite(amountMl) || amountMl <= 0 || amountMl > 5000) {
    return { ok: false as const, message: "Enter a hydration amount between 1 and 5000 ml." };
  }
  const { supabase, user } = await limit("log_hydration", 80, 3600);
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const { error } = await supabase.from("hydration_entries").insert({
    user_id: user.id,
    logged_on: today,
    amount_ml: Math.round(amountMl),
  });
  if (error) return { ok: false as const, message: error.message };
  safeRevalidate("/nutrition");
  safeRevalidate("/health");
  return { ok: true as const };
}

const healthSchema = z.object({
  metricSlug: z.string().min(1),
  value: z.number().nullable(),
  valueText: z.string().max(80).nullable().optional(),
  unit: z.string().min(1).max(30),
  measuredAt: z.string().datetime().optional(),
  method: z.string().max(80).nullable().optional(),
  source: z.enum(["manual", "whoop", "lab", "estimate", "device", "other"]).default("manual"),
  notes: z.string().max(400).optional(),
});

export async function saveHealthMeasurement(input: z.infer<typeof healthSchema>) {
  const parsed = healthSchema.parse(input);
  const { supabase, user } = await limit("health_measure", 80, 3600);
  const { data: prefs } = await supabase.from("athlete_preferences").select("health_data_consent").eq("user_id", user.id).maybeSingle();
  if (!prefs?.health_data_consent) {
    return { ok: false as const, message: "Confirm health-data consent in onboarding or settings before saving measurements." };
  }
  const { data: def } = await supabase.from("health_metric_definitions").select("min_value, max_value, slug").eq("slug", parsed.metricSlug).maybeSingle();
  if (!def) return { ok: false as const, message: "Unknown health metric." };
  if (parsed.value != null) {
    if (def.min_value != null && parsed.value < Number(def.min_value)) return { ok: false as const, message: "Value is below the allowed range." };
    if (def.max_value != null && parsed.value > Number(def.max_value)) return { ok: false as const, message: "Value is above the allowed range." };
  }
  const { error } = await supabase.from("health_measurements").insert({
    user_id: user.id,
    metric_slug: parsed.metricSlug,
    value: parsed.value,
    value_text: parsed.valueText ?? null,
    unit: parsed.unit,
    measured_at: parsed.measuredAt ?? new Date().toISOString(),
    method: parsed.method ?? null,
    source: parsed.source,
    notes: parsed.notes ?? "",
  });
  if (error) return { ok: false as const, message: error.message };
  if (parsed.metricSlug === "body_weight" && parsed.value != null) {
    await supabase.from("athlete_profiles").update({ weight_kg: parsed.value }).eq("user_id", user.id);
  }
  if (parsed.metricSlug === "body_height" && parsed.value != null) {
    await supabase.from("athlete_profiles").update({ height_cm: parsed.value }).eq("user_id", user.id);
  }
  safeRevalidate("/health");
  safeRevalidate("/recovery");
  return { ok: true as const };
}

export async function deleteHealthMeasurement(id: string) {
  const { supabase, user } = await limit("health_delete", 40, 3600);
  const { error } = await supabase.from("health_measurements").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false as const, message: error.message };
  safeRevalidate("/health");
  return { ok: true as const };
}

export async function saveFitnessAssessment(input: {
  path: "self_report" | "benchmark" | "hybrid";
  selfReport?: Parameters<typeof scoreSelfReport>[0];
  benchmarks?: Parameters<typeof scoreBenchmarks>[0];
}) {
  const { supabase, user } = await limit("fitness_assess", 20, 3600);
  const self = input.selfReport ? scoreSelfReport(input.selfReport) : null;
  const bench = scoreBenchmarks(input.benchmarks ?? []);
  const result = input.path === "self_report" && self
    ? self
    : input.path === "benchmark"
      ? bench
      : self
        ? mergeHybrid(self, bench)
        : bench;

  const { data: assessment, error } = await supabase.from("fitness_assessments").insert({
    user_id: user.id,
    level: result.level,
    assessment_path: input.path === "hybrid" ? "hybrid" : input.path === "benchmark" ? "benchmark" : "self_report",
    summary: result.summary,
    confidence: result.confidence,
    source: result.source,
    payload: result.payload,
  }).select("id").single();
  if (error || !assessment) return { ok: false as const, message: error?.message ?? "Assessment was not saved." };

  if (input.benchmarks?.length) {
    await supabase.from("benchmark_results").insert(input.benchmarks.map((row) => ({
      assessment_id: assessment.id,
      user_id: user.id,
      sport: row.sport,
      test_slug: row.testSlug,
      value: row.value,
      unit: row.unit,
      is_maximal: row.isMaximal,
      notes: row.notes ?? "",
      confidence: row.value == null ? 0.1 : row.isMaximal ? 0.7 : 0.6,
      source: "athlete",
    })));
  }

  safeRevalidate("/onboarding");
  safeRevalidate("/progress");
  return { ok: true as const, result };
}

export async function createEventPreparation(eventId: string, templateSlug: string, objective: string) {
  const { supabase, user } = await limit("event_prep", 20, 3600);
  const template = findEventTemplate(templateSlug);
  if (!template) return { ok: false as const, message: "Unknown event template." };
  const { data: event } = await supabase.from("events").select("id, starts_on, name").eq("id", eventId).eq("owner_user_id", user.id).maybeSingle();
  if (!event) return { ok: false as const, message: "Event not found." };
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const weeks = Math.max(1, Math.ceil((new Date(`${event.starts_on}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / (7 * 86400000)));
  const phasePlan = buildPhasePlan(template, weeks);
  const evidence = readinessEvidence(template, {});
  const { error } = await supabase.from("event_preparation").upsert({
    user_id: user.id,
    event_id: eventId,
    template_slug: template.slug,
    objective,
    phase_plan: phasePlan,
    readiness_evidence: evidence,
    current_capabilities: { weeksAvailable: weeks, minPrepWeeks: template.minPrepWeeks, shortPrep: weeks < template.minPrepWeeks },
    notes: weeks < template.minPrepWeeks
      ? "Preparation window is shorter than the template minimum. Volume stays conservative; do not compress into an unsafe plan."
      : "",
  }, { onConflict: "user_id,event_id" });
  if (error) return { ok: false as const, message: error.message };
  safeRevalidate("/events");
  safeRevalidate(`/events/${eventId}`);
  return { ok: true as const };
}

export async function generateWeeklyReview() {
  const { supabase, user } = await limit("weekly_review", 12, 3600);
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const weekStart = shiftIsoDate(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const weekEnd = shiftIsoDate(weekStart, 6);

  const [{ data: planned }, { data: completed }, { data: recovery }, { data: targets }, { data: foods }, { data: event }] = await Promise.all([
    supabase.from("workouts").select("status, sport, duration_min, expected_load").eq("user_id", user.id).gte("scheduled_date", weekStart).lte("scheduled_date", weekEnd).is("deleted_at", null),
    supabase.from("completed_workouts").select("sport, duration_min, load, started_at").eq("user_id", user.id).gte("started_at", `${weekStart}T00:00:00`).lte("started_at", `${weekEnd}T23:59:59`),
    supabase.from("recovery_logs").select("fatigue, sleep_hours").eq("user_id", user.id).gte("logged_on", weekStart).lte("logged_on", weekEnd),
    supabase.from("nutrition_targets").select("calories_kcal, target_date").eq("user_id", user.id).gte("target_date", weekStart).lte("target_date", weekEnd),
    supabase.from("food_entries").select("calories_kcal, logged_on").eq("user_id", user.id).gte("logged_on", weekStart).lte("logged_on", weekEnd).is("deleted_at", null),
    supabase.from("events").select("name, starts_on").eq("owner_user_id", user.id).is("deleted_at", null).gte("starts_on", today).order("starts_on").limit(1).maybeSingle(),
  ]);

  const plannedRows = planned ?? [];
  const completedRows = completed ?? [];
  const sportsMap = new Map<string, number>();
  for (const row of completedRows) {
    sportsMap.set(row.sport, (sportsMap.get(row.sport) ?? 0) + Number(row.duration_min ?? 0));
  }

  let nutritionAdherence: number | null = null;
  if ((targets ?? []).length && (foods ?? []).length) {
    const byDay = new Map<string, number>();
    for (const food of foods ?? []) byDay.set(food.logged_on, (byDay.get(food.logged_on) ?? 0) + Number(food.calories_kcal ?? 0));
    const ratios = (targets ?? []).map((target) => {
      const eaten = byDay.get(target.target_date) ?? 0;
      const goal = Number(target.calories_kcal) || 1;
      return Math.max(0, 1 - Math.abs(eaten - goal) / goal);
    });
    nutritionAdherence = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;
  }

  const fatigues = (recovery ?? []).map((row) => Number(row.fatigue)).filter((n) => Number.isFinite(n));
  const sleeps = (recovery ?? []).map((row) => Number(row.sleep_hours)).filter((n) => Number.isFinite(n));
  const review = buildWeeklyReview({
    planned: plannedRows.filter((row) => row.status !== "skipped").length,
    completed: plannedRows.filter((row) => row.status === "completed").length || completedRows.length,
    missed: plannedRows.filter((row) => row.status === "missed").length,
    skipped: plannedRows.filter((row) => row.status === "skipped").length,
    loadPlanned: plannedRows.reduce((sum, row) => sum + Number(row.expected_load ?? 0), 0),
    loadCompleted: completedRows.reduce((sum, row) => sum + Number(row.load ?? 0), 0),
    avgFatigue: fatigues.length ? fatigues.reduce((a, b) => a + b, 0) / fatigues.length : null,
    avgSleep: sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null,
    nutritionAdherence,
    sports: [...sportsMap.entries()].map(([sport, minutes]) => ({ sport, minutes })),
    upcomingEvent: event ? `${event.name} on ${event.starts_on}` : null,
  });

  const { error } = await supabase.from("weekly_reviews").upsert({
    user_id: user.id,
    week_start: weekStart,
    week_end: weekEnd,
    summary: review.summary,
    metrics: review.metrics,
    proposed_adjustments: review.proposedAdjustments,
    status: "pending",
  }, { onConflict: "user_id,week_start" });
  if (error) return { ok: false as const, message: error.message };
  safeRevalidate("/weekly");
  return { ok: true as const, review };
}

export async function respondToWeeklyReview(weekStart: string, accept: boolean) {
  const { supabase, user } = await limit("weekly_review_respond", 20, 3600);
  const { error } = await supabase.from("weekly_reviews").update({
    status: accept ? "accepted" : "rejected",
  }).eq("user_id", user.id).eq("week_start", weekStart);
  if (error) return { ok: false as const, message: error.message };
  if (accept) {
    await supabase.from("ai_recommendations").insert({
      user_id: user.id,
      kind: "weekly_review",
      title: "Weekly adjustments accepted",
      body: "Athlete accepted the proposed next-week adjustments. Apply only through existing optimize/plan flows.",
      status: "accepted",
      proposed_changes: [],
    });
  }
  safeRevalidate("/weekly");
  return { ok: true as const };
}

export async function recommendPrioritiesAction() {
  const { supabase, user } = await requireUser();
  const [{ data: sports }, { data: goals }, { data: event }] = await Promise.all([
    supabase.from("athlete_sports").select("sports(slug)").eq("user_id", user.id),
    supabase.from("athlete_goals").select("is_primary, goals(slug)").eq("user_id", user.id),
    supabase.from("events").select("event_type").eq("owner_user_id", user.id).is("deleted_at", null).order("starts_on").limit(1).maybeSingle(),
  ]);
  const sportSlugs = (sports ?? []).flatMap((row) => {
    const joined = row.sports as { slug?: string } | { slug?: string }[] | null;
    const slug = Array.isArray(joined) ? joined[0]?.slug : joined?.slug;
    return slug ? [slug] : [];
  });
  const primary = (goals ?? []).find((row) => row.is_primary);
  const joined = primary?.goals as { slug?: string } | { slug?: string }[] | null;
  const slug = Array.isArray(joined) ? joined[0]?.slug : joined?.slug;
  return recommendSportPriorities({
    sports: sportSlugs,
    primaryGoal: slug ?? "endurance",
    eventType: event?.event_type ?? null,
  });
}
