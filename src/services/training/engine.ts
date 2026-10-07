/**
 * Tamreen adaptive training engine.
 *
 * One athlete model. Strength, running, cycling, and swimming change the same
 * week, the same readiness score, and the same explanation. Scores are omitted
 * when the inputs do not exist. Nothing here invents a measurement.
 */

export const SEVERE_SYMPTOMS = [
  "chest_pain",
  "fainting",
  "severe_pain",
  "shortness_of_breath_at_rest",
] as const;

export type SevereSymptom = (typeof SEVERE_SYMPTOMS)[number];

export type Experience = "beginner" | "intermediate" | "advanced" | "elite";
export type Phase = "base" | "build" | "peak" | "taper" | "recovery";
export type Intensity =
  | "recovery"
  | "easy"
  | "moderate"
  | "tempo"
  | "threshold"
  | "vo2"
  | "race"
  | "max";
export type Sport =
  | "strength"
  | "bodybuilding"
  | "running"
  | "cycling"
  | "swimming"
  | "brick"
  | "mobility"
  | "recovery";
export type CatalogSport =
  | "strength"
  | "bodybuilding"
  | "running"
  | "cycling"
  | "swimming"
  | "triathlon";

export interface AthleteContext {
  startDate: string;
  sports: CatalogSport[];
  primaryGoal: string;
  goals: string[];
  experience: Experience;
  preferredDays: number[];
  minutesPerDay: number;
  gymAccess: boolean;
  poolAccess: boolean;
  bikeAccess: boolean;
  eventDate: string | null;
  eventName: string | null;
  avoidExercises: string[];
  currentInjuryAreas: string[];
  redFlag: boolean;
  weightKg: number | null;
  sex: "female" | "male" | "other" | "prefer_not_to_say" | null;
  reported: {
    fiveKSeconds?: number | null;
    tenKSeconds?: number | null;
    ftpWatts?: number | null;
    swim100Seconds?: number | null;
    squatKg?: number | null;
    benchKg?: number | null;
    deadliftKg?: number | null;
  };
}

export interface PrescribedExercise {
  slug: string;
  name: string;
  sets: number;
  reps: string;
  targetRpe: number;
  restSeconds: number;
  tempo: string;
  technique: "straight" | "superset" | "warmup";
  why: string;
}

export interface PlannedSession {
  date: string;
  sport: Sport;
  title: string;
  objective: string;
  durationMin: number;
  intensity: Intensity;
  expectedLoad: number;
  importance: "key" | "supporting" | "optional";
  recoveryHours: number;
  why: string;
  lowerBody: boolean;
  quality: boolean;
  phase: Phase;
  structure: Record<string, unknown>;
  zones: Record<string, string>;
  exercises: PrescribedExercise[];
}

export interface TrainingBlock {
  phase: Phase;
  name: string;
  startDate: string;
  endDate: string;
  focus: string;
  sortOrder: number;
}

export interface BuiltPlan {
  name: string;
  explanation: string;
  startDate: string;
  endDate: string;
  blocks: TrainingBlock[];
  sessions: PlannedSession[];
}

export interface ConflictFinding {
  severity: "info" | "warning" | "high";
  title: string;
  explanation: string;
  factors: string[];
  sessionA: number;
  sessionB: number;
}

export interface ScheduleChange {
  fromDate: string;
  toDate: string;
  title: string;
  reason: string;
}

export interface Adaptation {
  title: string;
  body: string;
  factors: string[];
  changes: Array<{
    date: string;
    title: string;
    sport: Sport;
    durationMin: number;
    intensity: Intensity;
    why: string;
  }>;
}

export interface Factor {
  label: string;
  detail: string;
}

export interface ExplainedScore {
  dimension: string;
  score: number;
  explanation: string;
  factors: Factor[];
  sampleSize: number;
}

export interface ReadinessInput {
  sleepHours: number | null;
  sleepQuality: number | null;
  soreness: number | null;
  fatigue: number | null;
  motivation: number | null;
  stress: number | null;
  hrv: number | null;
  hrvBaseline: number | null;
  severeSymptoms: string[];
  acuteLoad: number;
  chronicLoad: number;
  lowerBodyLoad48h: number;
  hardEnduranceLoad48h: number;
}

export interface ReadinessResult {
  blockedForSafety: boolean;
  trainRecommendation: "seek_care" | "rest" | "easy_only" | "train_as_planned" | "push_ok";
  overall: number | null;
  sleep: number | null;
  recovery: number | null;
  recentLoad: number | null;
  muscleFatigue: number | null;
  cardioFatigue: number | null;
  explanation: string;
  factors: Factor[];
}

const INTENSITY_FACTOR: Record<Intensity, number> = {
  recovery: 0.4,
  easy: 0.6,
  moderate: 0.75,
  tempo: 0.9,
  threshold: 1.05,
  vo2: 1.25,
  race: 1.15,
  max: 1.3,
};

const SPORT_FACTOR: Record<Sport, number> = {
  swimming: 0.85,
  cycling: 1,
  running: 1.05,
  strength: 0.95,
  bodybuilding: 0.9,
  brick: 1.15,
  mobility: 0.35,
  recovery: 0.3,
};

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function weekday(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function daysBetween(start: string, end: string): number {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const a = Date.UTC(ys, ms - 1, ds);
  const b = Date.UTC(ye, me - 1, de);
  return Math.round((b - a) / 86_400_000);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sessionLoad(durationMin: number, intensity: Intensity, sport: Sport): number {
  return Math.round(durationMin * INTENSITY_FACTOR[intensity] * SPORT_FACTOR[sport]);
}

export function hasSevereSymptom(symptoms: string[]): boolean {
  return symptoms.some((symptom) =>
    (SEVERE_SYMPTOMS as readonly string[]).includes(symptom),
  );
}

export function safetyMessage(): string {
  return "Tamreen provides training guidance, not a medical diagnosis. Chest pain, fainting, severe pain, or breathlessness at rest are reasons to stop training and seek urgent professional care.";
}

function wants(ctx: AthleteContext, sport: CatalogSport): boolean {
  return ctx.sports.includes(sport);
}

function isTri(ctx: AthleteContext): boolean {
  return (
    wants(ctx, "triathlon") ||
    (wants(ctx, "running") && wants(ctx, "cycling") && wants(ctx, "swimming"))
  );
}

function durationFor(ctx: AthleteContext, phase: Phase, share: number): number {
  const phaseScale =
    phase === "taper" ? 0.62 : phase === "recovery" ? 0.68 : phase === "peak" ? 0.9 : 1;
  const experienceScale =
    ctx.experience === "beginner" ? 0.85 : ctx.experience === "elite" ? 1.05 : 1;
  return clamp(Math.round(ctx.minutesPerDay * share * phaseScale * experienceScale), 20, ctx.minutesPerDay);
}

function avoided(ctx: AthleteContext, slug: string, name: string): boolean {
  const haystack = `${slug} ${name}`.toLowerCase();
  return ctx.avoidExercises.some((item) => haystack.includes(item.toLowerCase()) || item.toLowerCase().includes(slug));
}

interface ExerciseSeed {
  slug: string;
  name: string;
  why: string;
}

const EXERCISE_SEEDS: Record<string, ExerciseSeed> = {
  back_squat: {
    slug: "back_squat",
    name: "Back squat",
    why: "Builds lower-body strength that supports running and cycling posture under fatigue.",
  },
  bench_press: {
    slug: "bench_press",
    name: "Bench press",
    why: "Builds horizontal pressing strength without dominating the aerobic week.",
  },
  romanian_deadlift: {
    slug: "romanian_deadlift",
    name: "Romanian deadlift",
    why: "Loads the hamstrings through a long range, which supports hip extension for running and cycling.",
  },
  single_leg_rdl: {
    slug: "single_leg_rdl",
    name: "Single-leg Romanian deadlift",
    why: "Improves unilateral posterior-chain strength and hip stability relevant to running mechanics.",
  },
  split_squat: {
    slug: "split_squat",
    name: "Bulgarian split squat",
    why: "Builds single-leg strength and knee control for pedaling and running.",
  },
  hip_thrust: {
    slug: "hip_thrust",
    name: "Hip thrust",
    why: "Trains hip extension, the position where cyclists and runners produce force.",
  },
  soleus_raise: {
    slug: "soleus_raise",
    name: "Seated soleus raise",
    why: "The soleus does a large share of the work in distance running. This trains it directly.",
  },
  calf_raise: {
    slug: "calf_raise",
    name: "Standing calf raise",
    why: "Raises calf capacity so easy and long runs cost less at the ankle.",
  },
  dead_bug: {
    slug: "dead_bug",
    name: "Dead bug",
    why: "Teaches the trunk to stay steady while the arms and legs move.",
  },
  pallof_press: {
    slug: "pallof_press",
    name: "Pallof press",
    why: "Builds anti-rotation strength for the bike position and the swim stroke.",
  },
  face_pull: {
    slug: "face_pull",
    name: "Face pull",
    why: "Balances pressing and supports the shoulder position used in swimming.",
  },
  band_external_rotation: {
    slug: "band_external_rotation",
    name: "Band external rotation",
    why: "Trains the rotator cuff so swim volume does not outrun shoulder control.",
  },
  lat_pulldown: {
    slug: "lat_pulldown",
    name: "Lat pulldown",
    why: "Builds the lat strength swimmers use in the catch and pull.",
  },
  pull_up: {
    slug: "pull_up",
    name: "Pull-up",
    why: "A vertical pull that transfers to the swim stroke and upper-body strength.",
  },
  push_up: {
    slug: "push_up",
    name: "Push-up",
    why: "A scalable press for sessions away from a heavy barbell.",
  },
  overhead_press: {
    slug: "overhead_press",
    name: "Overhead press",
    why: "Builds overhead strength and trunk stiffness.",
  },
  plank: {
    slug: "plank",
    name: "Plank",
    why: "Trains the trunk stiffness every sport uses when the limbs are moving.",
  },
  bicep_curl: {
    slug: "bicep_curl",
    name: "Biceps curl",
    why: "Adds arm work when hypertrophy is a goal, placed away from key aerobic sessions.",
  },
  thoracic_rotation: {
    slug: "thoracic_rotation",
    name: "Open book rotation",
    why: "Restores thoracic rotation so the swim catch is not limited by the upper back.",
  },
  walking_lunge: {
    slug: "walking_lunge",
    name: "Walking lunge",
    why: "Trains each leg on its own, which matches the single-leg demand of running.",
  },
};

function prescribe(ctx: AthleteContext, slugs: string[], hypertrophy: boolean, phase: Phase): PrescribedExercise[] {
  const endurance =
    isTri(ctx) || wants(ctx, "running") || wants(ctx, "cycling") || wants(ctx, "swimming");
  const sets = phase === "taper" ? 2 : hypertrophy && !endurance ? 3 : endurance && !hypertrophy ? 3 : 4;
  const reps = hypertrophy ? "8-12" : endurance && ctx.primaryGoal !== "increase_strength" ? "6" : "5";
  const rpe = phase === "taper" ? 6 : hypertrophy ? 8 : endurance ? 7 : 8;
  return slugs
    .map((slug) => EXERCISE_SEEDS[slug])
    .filter((exercise): exercise is ExerciseSeed => Boolean(exercise))
    .filter((exercise) => !avoided(ctx, exercise.slug, exercise.name))
    .map((exercise) => ({
      slug: exercise.slug,
      name: exercise.name,
      sets,
      reps,
      targetRpe: rpe,
      restSeconds: hypertrophy ? 90 : 150,
      tempo: "3-1-1-0",
      technique: "straight" as const,
      why: exercise.why,
    }));
}

export function strengthExercises(ctx: AthleteContext, lower: boolean, phase: Phase, weekIndex: number): PrescribedExercise[] {
  const hypertrophy = wants(ctx, "bodybuilding") || ctx.primaryGoal === "build_muscle" || ctx.primaryGoal === "recomposition";
  const runBias = wants(ctx, "running") || isTri(ctx);
  const bikeBias = wants(ctx, "cycling") || isTri(ctx);
  const swimBias = wants(ctx, "swimming") || isTri(ctx);
  if (!lower) {
    const upper = swimBias
      ? ["face_pull", "band_external_rotation", "lat_pulldown", "dead_bug", "thoracic_rotation"]
      : hypertrophy
        ? ["bench_press", "pull_up", "overhead_press", "bicep_curl", "plank"]
        : ["bench_press", "pull_up", "face_pull", "plank"];
    return prescribe(ctx, upper, hypertrophy, phase);
  }
  if (isTri(ctx)) {
    const runDay = weekIndex % 2 === 0;
    return prescribe(
      ctx,
      runDay
        ? ["single_leg_rdl", "split_squat", "soleus_raise", "dead_bug"]
        : ["romanian_deadlift", "hip_thrust", "split_squat", "pallof_press"],
      hypertrophy,
      phase,
    );
  }
  if (runBias) {
    return prescribe(ctx, ["single_leg_rdl", "walking_lunge", "soleus_raise", "calf_raise", "dead_bug"], hypertrophy, phase);
  }
  if (bikeBias) {
    return prescribe(ctx, ["romanian_deadlift", "hip_thrust", "split_squat", "pallof_press"], hypertrophy, phase);
  }
  if (swimBias) {
    return prescribe(ctx, ["face_pull", "lat_pulldown", "dead_bug", "thoracic_rotation", "plank"], hypertrophy, phase);
  }
  return prescribe(ctx, ["back_squat", "romanian_deadlift", "walking_lunge", "plank"], hypertrophy, phase);
}

interface Template {
  sport: Sport;
  title: string;
  objective: string;
  intensity: Intensity;
  importance: PlannedSession["importance"];
  share: number;
  lowerBody: boolean;
  quality: boolean;
  recoveryHours: number;
  why: string;
  zones: Record<string, string>;
  structure: Record<string, unknown>;
  strengthLower?: boolean;
}

function templatesFor(ctx: AthleteContext, phase: Phase, weekIndex: number): Template[] {
  const tri = isTri(ctx);
  const run = tri || wants(ctx, "running");
  const bike = (tri || wants(ctx, "cycling")) && (ctx.bikeAccess || wants(ctx, "cycling") || tri);
  const swim = (tri || wants(ctx, "swimming")) && ctx.poolAccess;
  const lift = ctx.gymAccess && (wants(ctx, "strength") || wants(ctx, "bodybuilding") || tri || run || bike || swim);
  const qualityIntensity: Intensity = phase === "base" || phase === "recovery" ? "tempo" : phase === "taper" ? "threshold" : "vo2";
  const items: Template[] = [];

  if (swim) {
    items.push({
      sport: "swimming",
      title: phase === "build" || phase === "peak" ? "Threshold swim" : "Endurance swim",
      objective: "Aerobic swimming with a controlled stroke",
      intensity: phase === "build" || phase === "peak" ? "threshold" : "easy",
      importance: "supporting",
      share: 0.7,
      lowerBody: false,
      quality: phase === "build" || phase === "peak",
      recoveryHours: 18,
      why: "Swimming adds cardiovascular load with less lower-body musculoskeletal fatigue than running.",
      zones: { pace: phase === "build" ? "CSS / threshold" : "easy aerobic" },
      structure: { stroke: "freestyle", focus: "long smooth repeats" },
    });
  }
  if (run) {
    items.push({
      sport: "running",
      title: phase === "recovery" ? "Recovery run" : "Easy run",
      objective: "Aerobic volume that does not steal the next key session",
      intensity: phase === "recovery" ? "recovery" : "easy",
      importance: "supporting",
      share: 0.75,
      lowerBody: true,
      quality: false,
      recoveryHours: 18,
      why: "Easy running builds the aerobic base the harder sessions sit on.",
      zones: { hr: "Zone 2", pace: "conversational" },
      structure: { surface: "flat" },
    });
    items.push({
      sport: "running",
      title: qualityIntensity === "vo2" ? "VO2 max intervals" : qualityIntensity === "threshold" ? "Threshold run" : "Tempo run",
      objective: "Raise the pace you can sustain without burying the legs the next day",
      intensity: qualityIntensity,
      importance: "key",
      share: 0.8,
      lowerBody: true,
      quality: true,
      recoveryHours: 36,
      why: "This is the week's running quality. It is placed away from heavy lower-body lifting.",
      zones: { pace: qualityIntensity === "vo2" ? "3k-5k effort" : "comfortably hard" },
      structure: { reps: qualityIntensity === "vo2" ? "5 x 3 min" : "20 min continuous" },
    });
    items.push({
      sport: "running",
      title: "Long run",
      objective: "Extend aerobic endurance",
      intensity: phase === "peak" ? "moderate" : "easy",
      importance: "key",
      share: 1,
      lowerBody: true,
      quality: false,
      recoveryHours: 36,
      why: "The long run is the endurance key. Heavy squats are not placed the day before it.",
      zones: { hr: "Zone 2" },
      structure: { finish: phase === "peak" ? "last 15 min steady" : "even effort" },
    });
  }
  if (bike) {
    items.push({
      sport: "cycling",
      title: phase === "build" || phase === "peak" ? "Sweet spot ride" : "Endurance ride",
      objective: bike && tri ? "Specific bike endurance for the event" : "Aerobic cycling",
      intensity: phase === "build" || phase === "peak" ? "tempo" : "easy",
      importance: phase === "build" ? "key" : "supporting",
      share: 0.9,
      lowerBody: true,
      quality: phase === "build" || phase === "peak",
      recoveryHours: 24,
      why: "Cycling carries a large share of endurance load with less impact than running.",
      zones: { power: phase === "build" ? "88-93% FTP" : "Zone 2" },
      structure: { cadence: "85-95 rpm" },
    });
  }
  if (tri && (phase === "build" || phase === "peak") && bike && run) {
    items.push({
      sport: "brick",
      title: "Bike-to-run brick",
      objective: "Practice running off the bike",
      intensity: "moderate",
      importance: "key",
      share: 1,
      lowerBody: true,
      quality: true,
      recoveryHours: 36,
      why: "A brick is an intentional combination. Tamreen does not treat the run off the bike as an accidental conflict.",
      zones: { bike: "steady", run: "event pace feel" },
      structure: { bikeMinShare: 0.7, runMinShare: 0.3 },
    });
  }
  if (lift) {
    items.push({
      sport: wants(ctx, "bodybuilding") && !tri ? "bodybuilding" : "strength",
      title: "Lower-body strength",
      objective: "Strength that supports the endurance sports instead of competing with them",
      intensity: phase === "taper" || phase === "recovery" ? "moderate" : "moderate",
      importance: ctx.primaryGoal === "increase_strength" ? "key" : "supporting",
      share: 0.85,
      lowerBody: true,
      quality: false,
      recoveryHours: 36,
      why: "Lower-body strength is scheduled away from interval running and the long run.",
      zones: {},
      structure: { pattern: "hinge and single leg" },
      strengthLower: true,
    });
    items.push({
      sport: wants(ctx, "bodybuilding") && !tri ? "bodybuilding" : "strength",
      title: swim && !run ? "Swim-support strength" : "Upper-body strength",
      objective: "Upper-body and trunk work with a low cost to the next run or ride",
      intensity: "moderate",
      importance: "supporting",
      share: 0.7,
      lowerBody: false,
      quality: false,
      recoveryHours: 18,
      why: "Upper-body work recovers alongside easy aerobic days more easily than heavy squats do.",
      zones: {},
      structure: { pattern: swim ? "shoulders, lats, trunk" : "press and pull" },
      strengthLower: false,
    });
  }
  if (items.length === 0) {
    items.push({
      sport: "mobility",
      title: "Mobility and easy aerobic",
      objective: "Keep a training rhythm while access or sports are still being set",
      intensity: "easy",
      importance: "optional",
      share: 0.6,
      lowerBody: false,
      quality: false,
      recoveryHours: 12,
      why: "There is not enough sport access yet for a full hybrid week.",
      zones: {},
      structure: {},
    });
  }
  const cap = Math.max(ctx.preferredDays.length, 3);
  const ranked = [...items].sort((a, b) => {
    if (a.importance === b.importance) return 0;
    return a.importance === "key" ? -1 : 1;
  });
  if (weekIndex % 2 === 1) {
    const longIndex = ranked.findIndex((item) => item.title === "Long run");
    const brickIndex = ranked.findIndex((item) => item.sport === "brick");
    if (longIndex >= 0 && brickIndex >= 0) {
      ranked.splice(longIndex, 1);
    }
  }
  return ranked.slice(0, cap);
}

function placeTemplates(ctx: AthleteContext, weekStart: string, templates: Template[], phase: Phase, weekIndex: number): PlannedSession[] {
  const days = (ctx.preferredDays.length ? ctx.preferredDays : [1, 2, 3, 4, 5, 6])
    .filter((day) => day >= 0 && day <= 6)
    .sort((a, b) => a - b);
  // weekStart is Monday. Day 1 is Monday and day 0 is Sunday.
  const pool = days.map((day) => addDays(weekStart, (day + 6) % 7)).sort();
  const used = new Set<string>();
  const placed: PlannedSession[] = [];

  const take = (prefer: (date: string) => number): string | null => {
    const choices = pool.filter((date) => !used.has(date));
    if (!choices.length) return null;
    choices.sort((a, b) => prefer(b) - prefer(a));
    return choices[0];
  };

  const ordered = [...templates].sort((a, b) => Number(b.importance === "key") - Number(a.importance === "key"));
  for (const template of ordered) {
    const date = take((candidate) => {
      let score = 0;
      const neighbors = placed.filter((session) => Math.abs(daysBetween(session.date, candidate)) <= 1);
      if (template.quality && neighbors.some((session) => session.quality || (session.lowerBody && session.sport === "strength"))) {
        score -= 5;
      }
      if (template.strengthLower && neighbors.some((session) => session.quality || session.title === "Long run")) {
        score -= 5;
      }
      if (template.title === "Long run" && (weekday(candidate) === 6 || weekday(candidate) === 0)) score += 3;
      if (template.sport === "brick" && weekday(candidate) >= 5) score += 2;
      if (template.sport === "swimming") score += 1;
      score -= Math.abs(daysBetween(pool[0] ?? candidate, candidate)) * 0.01;
      return score;
    });
    if (!date) continue;
    used.add(date);
    const durationMin = durationFor(ctx, phase, template.share);
    const exercises =
      template.sport === "strength" || template.sport === "bodybuilding"
        ? strengthExercises(ctx, Boolean(template.strengthLower), phase, weekIndex)
        : [];
    placed.push({
      date,
      sport: template.sport,
      title: template.title,
      objective: template.objective,
      durationMin,
      intensity: template.intensity,
      expectedLoad: sessionLoad(durationMin, template.intensity, template.sport),
      importance: template.importance,
      recoveryHours: template.recoveryHours,
      why: template.why,
      lowerBody: template.lowerBody && template.sport !== "swimming",
      quality: template.quality,
      phase,
      structure: { ...template.structure, exercises: exercises.map((exercise) => exercise.slug) },
      zones: template.zones,
      exercises,
    });
  }
  return placed.sort((a, b) => a.date.localeCompare(b.date));
}

export function phaseForWeek(weekIndex: number, totalWeeks: number): Phase {
  if (totalWeeks <= 4) {
    if (weekIndex >= totalWeeks - 1) return "taper";
    return weekIndex % 4 === 3 ? "recovery" : "build";
  }
  const remaining = totalWeeks - weekIndex;
  if (remaining <= 2) return "taper";
  if (remaining <= 4) return "peak";
  if (weekIndex > 0 && weekIndex % 4 === 3 && remaining > 5) return "recovery";
  if (remaining <= Math.ceil(totalWeeks * 0.55)) return "build";
  return "base";
}

export function recommendedWeeklyLoad(ctx: AthleteContext): number {
  const experience = { beginner: 0.75, intermediate: 1, advanced: 1.12, elite: 1.22 }[ctx.experience];
  const days = Math.max(ctx.preferredDays.length, 1);
  return Math.round(ctx.minutesPerDay * days * 0.7 * experience);
}

function mondayOf(iso: string): string {
  return addDays(iso, -((weekday(iso) + 6) % 7));
}

export function buildPlan(ctx: AthleteContext): BuiltPlan {
  const eventWeeks = ctx.eventDate ? Math.max(1, Math.ceil(daysBetween(ctx.startDate, ctx.eventDate) / 7)) : 8;
  const weeks = clamp(eventWeeks, 4, 16);
  const origin = mondayOf(ctx.startDate);
  const sessions: PlannedSession[] = [];
  const blocks: TrainingBlock[] = [];
  let blockStart = ctx.startDate;
  let currentPhase = phaseForWeek(0, weeks);
  for (let week = 0; week < weeks; week += 1) {
    const phase = ctx.redFlag ? "recovery" : phaseForWeek(week, weeks);
    const weekStart = addDays(origin, week * 7);
    if (phase !== currentPhase) {
      blocks.push({
        phase: currentPhase,
        name: blockName(currentPhase),
        startDate: blockStart,
        endDate: addDays(weekStart, -1),
        focus: blockFocus(currentPhase, ctx),
        sortOrder: blocks.length,
      });
      blockStart = weekStart;
      currentPhase = phase;
    }
    sessions.push(
      ...placeTemplates(ctx, weekStart, templatesFor(ctx, phase, week), phase, week).filter(
        (session) => session.date >= ctx.startDate,
      ),
    );
  }
  const endDate = addDays(ctx.startDate, weeks * 7 - 1);
  blocks.push({
    phase: currentPhase,
    name: blockName(currentPhase),
    startDate: blockStart,
    endDate,
    focus: blockFocus(currentPhase, ctx),
    sortOrder: blocks.length,
  });
  const sports = ctx.sports.join(", ") || "general training";
  const explanation = [
    `This is one plan for ${sports}.`,
    ctx.eventName && ctx.eventDate
      ? `${ctx.eventName} is on ${ctx.eventDate}, so the block order moves from base toward a taper instead of repeating four unrelated programs.`
      : "No event date is set, so the plan uses an eight-to-sixteen week base and build rhythm with a recovery week every fourth week.",
    "Heavy lower-body strength is kept away from interval running and the long run. Swimming is used as cardiovascular work that does not beat up the legs the way running does.",
    ctx.poolAccess ? "" : "Pool access is off, so swim sessions are not scheduled.",
    ctx.redFlag
      ? "A current red-flag injury is on the profile, so this draft stays in recovery until that status changes."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    name: ctx.eventName ? `${ctx.eventName} plan` : "Hybrid training plan",
    explanation,
    startDate: ctx.startDate,
    endDate,
    blocks,
    sessions,
  };
}

function blockName(phase: Phase): string {
  return { base: "Base", build: "Build", peak: "Peak", taper: "Taper", recovery: "Recovery" }[phase];
}

function blockFocus(phase: Phase, ctx: AthleteContext): string {
  if (phase === "base") return "Aerobic volume, technique, and strength that does not create extra fatigue.";
  if (phase === "build") return "Add quality and event-specific work while keeping easy days easy.";
  if (phase === "peak") return `Race-specific work for ${ctx.primaryGoal.replaceAll("_", " ")}.`;
  if (phase === "taper") return "Keep a little intensity and cut volume so the event week is fresh.";
  return "Deload. Keep the habit, drop the fatigue.";
}

export function findConflicts(sessions: PlannedSession[]): ConflictFinding[] {
  const findings: ConflictFinding[] = [];
  for (let i = 0; i < sessions.length; i += 1) {
    for (let j = i + 1; j < sessions.length; j += 1) {
      const a = sessions[i];
      const b = sessions[j];
      const gap = Math.abs(daysBetween(a.date, b.date));
      if (gap > 1) continue;
      const earlier = a.date <= b.date ? a : b;
      const later = a.date <= b.date ? b : a;
      const earlierIndex = a.date <= b.date ? i : j;
      const laterIndex = a.date <= b.date ? j : i;
      if (earlier.sport === "brick" || later.sport === "brick") continue;
      const heavyLower = (session: PlannedSession) =>
        (session.sport === "strength" || session.sport === "bodybuilding") && session.lowerBody && session.intensity !== "recovery";
      const hardRun = (session: PlannedSession) => session.sport === "running" && (session.quality || session.title === "Long run");
      if (heavyLower(earlier) && hardRun(later)) {
        findings.push({
          severity: later.intensity === "vo2" ? "high" : "warning",
          title: "Training conflict detected",
          explanation: "Heavy lower-body strength training may reduce the quality of the next running session.",
          factors: [
            `${earlier.title} on ${earlier.date} loads the same muscles the run needs.`,
            `${later.title} on ${later.date} is a ${later.intensity} running session.`,
            "Tamreen separates these so the interval or long run is not performed on pre-fatigued legs.",
          ],
          sessionA: earlierIndex,
          sessionB: laterIndex,
        });
      } else if (earlier.title === "Long run" && heavyLower(later)) {
        findings.push({
          severity: "warning",
          title: "Training conflict detected",
          explanation: "A long run leaves lower-body fatigue that makes the next heavy strength session less useful.",
          factors: [
            `${earlier.title} on ${earlier.date} is a long lower-body aerobic session.`,
            `${later.title} on ${later.date} asks for heavy lower-body force.`,
          ],
          sessionA: earlierIndex,
          sessionB: laterIndex,
        });
      } else if (earlier.quality && later.quality && earlier.sport !== later.sport) {
        findings.push({
          severity: "high",
          title: "Training conflict detected",
          explanation: "Two high-intensity sessions this close stack cardiovascular fatigue across sports.",
          factors: [
            `${earlier.title} is ${earlier.intensity}.`,
            `${later.title} is ${later.intensity}.`,
            "The sports feel different, but the heart and recovery budget are shared.",
          ],
          sessionA: earlierIndex,
          sessionB: laterIndex,
        });
      }
    }
  }
  return findings;
}

export function optimizeWeek(ctx: AthleteContext, sessions: PlannedSession[]): { sessions: PlannedSession[]; changes: ScheduleChange[]; explanation: string } {
  if (!sessions.length) {
    return { sessions, changes: [], explanation: "There are no sessions to move." };
  }
  const weekStart = addDays(sessions[0].date, -((weekday(sessions[0].date) + 6) % 7));
  const phase = sessions[0].phase;
  const templates: Template[] = sessions.map((session) => ({
    sport: session.sport,
    title: session.title,
    objective: session.objective,
    intensity: session.intensity,
    importance: session.importance,
    share: session.durationMin / Math.max(ctx.minutesPerDay, 1),
    lowerBody: session.lowerBody,
    quality: session.quality,
    recoveryHours: session.recoveryHours,
    why: session.why,
    zones: session.zones,
    structure: session.structure,
    strengthLower: session.lowerBody && (session.sport === "strength" || session.sport === "bodybuilding"),
  }));
  const placed = placeTemplates(ctx, weekStart, templates, phase, 0);
  const changes: ScheduleChange[] = [];
  const used = new Set<number>();
  for (const next of placed) {
    const matchIndex = sessions.findIndex((session, index) => !used.has(index) && session.title === next.title);
    if (matchIndex < 0) continue;
    used.add(matchIndex);
    if (sessions[matchIndex].date !== next.date) {
      changes.push({
        fromDate: sessions[matchIndex].date,
        toDate: next.date,
        title: next.title,
        reason: "Moved to respect recovery between lower-body strength and harder running.",
      });
    }
  }
  const merged = placed.map((session) => {
    const original = sessions.find((item) => item.title === session.title);
    return original
      ? { ...original, date: session.date, phase }
      : session;
  });
  return {
    sessions: merged.sort((a, b) => a.date.localeCompare(b.date)),
    changes,
    explanation: changes.length
      ? "Tamreen rearranged this week so heavy lower-body work and high-intensity running are not stacked, while key sessions stay inside the days you marked available."
      : "This week already respects availability, recovery spacing, and key-session priority.",
  };
}

export function adaptMissedSession(
  missed: PlannedSession,
  upcoming: PlannedSession[],
  recoveryLow: boolean,
): Adaptation {
  const nextLower = upcoming.find((session) => session.lowerBody && (session.sport === "strength" || session.sport === "bodybuilding"));
  const factors = [
    `The missed session was ${missed.title} on ${missed.date}.`,
    nextLower
      ? `${nextLower.title} on ${nextLower.date} still needs reasonably fresh legs.`
      : "The next days were checked for sessions that use the same muscles.",
    recoveryLow ? "Recovery is below the recent baseline, so the replacement stays easy." : "Recovery does not force an extra rest day, but the full session is still not dumped onto tomorrow.",
  ];
  if (missed.title !== "Long run" && missed.sport !== "running") {
    return {
      title: "Plan adjustment",
      body: `${missed.title} was missed. Tamreen will not automatically push the full session to the next day. The next key session stays where it is, and this one can be shortened or dropped for the week.`,
      factors,
      changes: upcoming.slice(0, 3).map((session) => ({
        date: session.date,
        title: session.title,
        sport: session.sport,
        durationMin: session.durationMin,
        intensity: session.intensity,
        why: "Unchanged. Missing one session does not rewrite the key sessions around it.",
      })),
    };
  }
  const easyMinutes = clamp(Math.round(missed.durationMin * 0.55), 30, 70);
  const changes = upcoming.slice(0, 4).map((session) => {
    if (nextLower && session.date === nextLower.date) {
      return {
        date: session.date,
        title: "Easy aerobic run",
        sport: "running" as Sport,
        durationMin: easyMinutes,
        intensity: "easy" as Intensity,
        why: "A shortened easy run replaces the missed long run. The full distance would compromise the lower-body session, so that strength session moves.",
      };
    }
    if (session.title.toLowerCase().includes("upper")) {
      return { ...session, sport: session.sport, why: "Upper-body work stays, because it does not compete with the easy run." };
    }
    return {
      date: session.date,
      title: session.title,
      sport: session.sport,
      durationMin: session.durationMin,
      intensity: session.intensity,
      why: session.quality ? "The interval session stays on its own day so it is not glued to the makeup run." : "Kept, with the long-run makeup already absorbed as an easy session.",
    };
  });
  if (nextLower) {
    const moveTo = upcoming.find((session) => session.date > nextLower.date && !session.quality);
    if (moveTo) {
      changes.push({
        date: moveTo.date,
        title: "Lower-body strength",
        sport: "strength",
        durationMin: nextLower.durationMin,
        intensity: "moderate",
        why: "Lower-body strength moves off the makeup run so the two do not stack.",
      });
    }
  }
  return {
    title: "Plan adjustment",
    body: `You missed ${missed.title}. Moving the full session onto the next day would compromise the lower-body work already on the calendar. The recommended change is a shorter easy run, with the heavy lower-body session shifted.`,
    factors,
    changes,
  };
}

export function scoreReadiness(input: ReadinessInput): ReadinessResult {
  if (hasSevereSymptom(input.severeSymptoms)) {
    return {
      blockedForSafety: true,
      trainRecommendation: "seek_care",
      overall: null,
      sleep: null,
      recovery: null,
      recentLoad: null,
      muscleFatigue: null,
      cardioFatigue: null,
      explanation: safetyMessage(),
      factors: input.severeSymptoms.map((symptom) => ({
        label: "Safety flag",
        detail: symptom.replaceAll("_", " "),
      })),
    };
  }
  const sleepQuality = input.sleepQuality == null ? null : (input.sleepQuality / 5) * 100;
  let sleep = sleepQuality;
  if (sleep != null && input.sleepHours != null) {
    if (input.sleepHours < 5) sleep -= 30;
    else if (input.sleepHours < 6) sleep -= 15;
    sleep = clamp(sleep, 0, 100);
  }
  const invert = (value: number | null) => (value == null ? null : ((6 - value) / 5) * 100);
  const soreness = invert(input.soreness);
  const fatigue = invert(input.fatigue);
  const stress = invert(input.stress);
  const motivation = input.motivation == null ? null : (input.motivation / 5) * 100;
  const recoveryParts = [soreness, fatigue, stress, motivation].filter((part): part is number => part != null);
  const recovery = recoveryParts.length ? recoveryParts.reduce((sum, part) => sum + part, 0) / recoveryParts.length : null;
  let recentLoad: number | null = null;
  if (input.chronicLoad > 0) {
    const ratio = input.acuteLoad / input.chronicLoad;
    recentLoad = clamp(Math.round(100 - Math.abs(ratio - 1) * 80), 0, 100);
  }
  const muscleFatigue = clamp(Math.round(100 - input.lowerBodyLoad48h / 2), 20, 100);
  const cardioFatigue = clamp(Math.round(100 - input.hardEnduranceLoad48h / 2), 20, 100);
  const parts = [sleep, recovery, recentLoad, muscleFatigue, cardioFatigue].filter((part): part is number => part != null);
  const overall = parts.length ? Math.round(parts.reduce((sum, part) => sum + part, 0) / parts.length) : null;
  let trainRecommendation: ReadinessResult["trainRecommendation"] = "train_as_planned";
  if (overall == null) trainRecommendation = "train_as_planned";
  else if (overall < 40) trainRecommendation = "rest";
  else if (overall < 60 || muscleFatigue < 50) trainRecommendation = "easy_only";
  else if (overall >= 80) trainRecommendation = "push_ok";
  const factors: Factor[] = [];
  if (sleep != null) factors.push({ label: "Sleep", detail: `${Math.round(sleep)} from quality ${input.sleepQuality ?? "n/a"}/5 and ${input.sleepHours ?? "unlogged"} hours.` });
  if (recovery != null) factors.push({ label: "Recovery feelings", detail: "Soreness, fatigue, stress, and motivation are averaged. 1 is best for soreness, fatigue, and stress." });
  if (recentLoad != null) {
    factors.push({
      label: "Recent load",
      detail: `Acute load ${Math.round(input.acuteLoad)} versus chronic load ${Math.round(input.chronicLoad)}.`,
    });
  }
  factors.push({
    label: "Muscle fatigue",
    detail: `Lower-body load over 48 hours is ${Math.round(input.lowerBodyLoad48h)}. Higher load lowers this component.`,
  });
  factors.push({
    label: "Cardiovascular fatigue",
    detail: `Hard endurance load over 48 hours is ${Math.round(input.hardEnduranceLoad48h)}.`,
  });
  if (input.hrv != null && input.hrvBaseline != null) {
    factors.push({
      label: "HRV",
      detail: `Today ${input.hrv} versus baseline ${input.hrvBaseline}. This is context, not a diagnosis.`,
    });
  }
  return {
    blockedForSafety: false,
    trainRecommendation,
    overall,
    sleep: sleep == null ? null : Math.round(sleep),
    recovery: recovery == null ? null : Math.round(recovery),
    recentLoad,
    muscleFatigue,
    cardioFatigue,
    explanation:
      overall == null
        ? "Readiness needs a check-in before Tamreen will score it."
        : `Readiness is ${overall}. The number is the average of the components that had data. Recommendation: ${trainRecommendation.replaceAll("_", " ")}.`,
    factors,
  };
}

export function strengthScore(input: {
  sex: AthleteContext["sex"];
  weightKg: number | null;
  squatKg: number | null;
  benchKg: number | null;
  deadliftKg: number | null;
}): ExplainedScore | null {
  if (!input.weightKg || input.weightKg <= 0) return null;
  const standards = input.sex === "female"
    ? { squat: 1.15, bench: 0.7, deadlift: 1.5 }
    : input.sex === "male"
      ? { squat: 1.5, bench: 1, deadlift: 2 }
      : { squat: 1.3, bench: 0.85, deadlift: 1.75 };
  const lifts = [
    ["Squat", input.squatKg, standards.squat],
    ["Bench", input.benchKg, standards.bench],
    ["Deadlift", input.deadliftKg, standards.deadlift],
  ].filter((item): item is [string, number, number] => typeof item[1] === "number" && item[1] > 0);
  if (!lifts.length) return null;
  const factors = lifts.map(([label, kg, standard]) => {
    const ratio = kg / input.weightKg!;
    const score = clamp(Math.round(40 + 30 * (ratio / standard)), 0, 99);
    return {
      label,
      detail: `${kg} kg is ${ratio.toFixed(2)} times body weight. The reference for a score of 70 is ${standard} times body weight. This lift scores ${score}.`,
      score,
    };
  });
  const score = Math.round(factors.reduce((sum, factor) => sum + factor.score, 0) / factors.length);
  const band = input.sex === "female" ? "the women's reference band" : input.sex === "male" ? "the men's reference band" : "the midpoint of the women's and men's reference bands";
  return {
    dimension: "strength",
    score,
    sampleSize: factors.length,
    explanation: `Strength is ${score}, averaged from ${factors.length} lift${factors.length > 1 ? "s" : ""} using ${band}. Each lift is scored from its multiple of body weight. A score of 70 means the lift matches that reference, not that it is a competitive total.`,
    factors: factors.map(({ label, detail }) => ({ label, detail })),
  };
}

export function runningScore(paceSecPerKm: number | null, targetSecPerKm: number | null): ExplainedScore | null {
  if (!paceSecPerKm || !targetSecPerKm) return null;
  const gap = paceSecPerKm - targetSecPerKm;
  const score = clamp(Math.round(88 - gap * 0.8), 30, 99);
  return {
    dimension: "running",
    score,
    sampleSize: 1,
    explanation: `Running is ${score}. Current pace is ${Math.round(paceSecPerKm)} sec/km and the target used here is ${Math.round(targetSecPerKm)} sec/km. Each second per kilometre off the target moves the score by 0.8 points from 88.`,
    factors: [{ label: "Pace gap", detail: `${gap.toFixed(1)} sec/km versus the target pace.` }],
  };
}

export function cyclingScore(ftpWatts: number | null, weightKg: number | null): ExplainedScore | null {
  if (!ftpWatts) return null;
  if (weightKg && weightKg > 0) {
    const wkg = ftpWatts / weightKg;
    const score = clamp(Math.round(40 + (wkg - 1.5) * 25), 30, 99);
    return {
      dimension: "cycling",
      score,
      sampleSize: 1,
      explanation: `Cycling is ${score} from ${wkg.toFixed(2)} W/kg. The reference line is 2.5 W/kg = 65 and 3.5 W/kg = 90. This is a training reference, not a lab classification.`,
      factors: [{ label: "FTP", detail: `${ftpWatts} W at ${weightKg} kg.` }],
    };
  }
  const score = clamp(Math.round(40 + (ftpWatts - 140) * 0.35), 30, 99);
  return {
    dimension: "cycling",
    score,
    sampleSize: 1,
    explanation: `Cycling is ${score} from an FTP of ${ftpWatts} W. Body weight is missing, so this uses an absolute watt reference instead of W/kg.`,
    factors: [{ label: "FTP", detail: `${ftpWatts} W, body weight not logged.` }],
  };
}

export function swimmingScore(paceSecPer100: number | null): ExplainedScore | null {
  if (!paceSecPer100) return null;
  const score = clamp(Math.round(100 - (paceSecPer100 - 90) * 0.9), 30, 99);
  return {
    dimension: "swimming",
    score,
    sampleSize: 1,
    explanation: `Swimming is ${score} from a ${Math.round(paceSecPer100)} sec/100m pace. 90 sec/100m scores 100 on this scale and each slower second costs 0.9 points.`,
    factors: [{ label: "Pace", detail: `${Math.round(paceSecPer100)} seconds per 100 metres.` }],
  };
}

export function consistencyScore(completed: number, planned: number): ExplainedScore | null {
  if (planned <= 0) return null;
  const score = clamp(Math.round((completed / planned) * 100), 0, 100);
  return {
    dimension: "consistency",
    score,
    sampleSize: planned,
    explanation: `Consistency is ${score} because ${completed} of ${planned} planned sessions were completed.`,
    factors: [{ label: "Completion", detail: `${completed} completed / ${planned} planned.` }],
  };
}

export function overallScore(parts: ExplainedScore[], primaryGoal: string): ExplainedScore | null {
  if (parts.length < 2) return null;
  const weights: Record<string, number> = {};
  for (const part of parts) {
    let weight = 1;
    if (primaryGoal.includes("strength") && part.dimension === "strength") weight = 1.6;
    if ((primaryGoal.includes("run") || primaryGoal.includes("marathon") || primaryGoal.includes("5k") || primaryGoal.includes("10k")) && part.dimension === "running") weight = 1.6;
    if (primaryGoal.includes("cycl") && part.dimension === "cycling") weight = 1.6;
    if (primaryGoal.includes("swim") && part.dimension === "swimming") weight = 1.6;
    if (primaryGoal.includes("ironman") || primaryGoal.includes("triathlon")) {
      if (["running", "cycling", "swimming", "consistency"].includes(part.dimension)) weight = 1.3;
    }
    weights[part.dimension] = weight;
  }
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const score = Math.round(parts.reduce((sum, part) => sum + part.score * weights[part.dimension], 0) / totalWeight);
  return {
    dimension: "overall",
    score,
    sampleSize: parts.length,
    explanation: `The Tamreen performance score is ${score}. It is a weighted average of ${parts.map((part) => part.dimension).join(", ")}. Sports without data are left out. The primary goal "${primaryGoal.replaceAll("_", " ")}" gives extra weight to the matching dimension.`,
    factors: parts.map((part) => ({
      label: part.dimension,
      detail: `${part.score} with weight ${weights[part.dimension]}.`,
    })),
  };
}

export interface CoachContext {
  name: string;
  primaryGoal: string;
  today: PlannedSession | null;
  readiness: ReadinessResult | null;
  conflicts: ConflictFinding[];
  recentMiss: string | null;
  eventName: string | null;
  daysToEvent: number | null;
  consistency: ExplainedScore | null;
  question: string;
}

export interface CoachAnswer {
  title: string;
  answer: string;
  factors: Factor[];
  proposedChanges: Adaptation["changes"];
  requiresAcceptance: boolean;
  safety: boolean;
}

export function answerCoach(ctx: CoachContext): CoachAnswer {
  const question = ctx.question.toLowerCase();
  if (ctx.readiness?.blockedForSafety || /chest pain|faint|severe pain|can't breathe|cannot breathe/.test(question)) {
    return {
      title: "Stop and get care",
      answer: safetyMessage(),
      factors: ctx.readiness?.factors ?? [{ label: "Question", detail: "The question describes a serious symptom." }],
      proposedChanges: [],
      requiresAcceptance: false,
      safety: true,
    };
  }
  if (/should i (run|train|ride|swim)/.test(question)) {
    const recommendation = ctx.readiness?.trainRecommendation ?? "train_as_planned";
    const today = ctx.today
      ? `Today's plan is ${ctx.today.title}, ${ctx.today.durationMin} minutes, ${ctx.today.intensity}. ${ctx.today.why}`
      : "Nothing is scheduled today.";
    const easy = recommendation === "easy_only" || recommendation === "rest";
    return {
      title: easy ? "Change today's intent" : "Train as planned",
      answer: easy
        ? `${today} Readiness says ${recommendation.replaceAll("_", " ")}, so Tamreen would replace a hard session with easy aerobic work. That change is a proposal until you accept it.`
        : `${today} Readiness supports doing it as written.`,
      factors: ctx.readiness?.factors ?? [{ label: "Readiness", detail: "No check-in is logged, so this uses the plan only." }],
      proposedChanges: easy && ctx.today && ctx.today.quality
        ? [{
            date: ctx.today.date,
            title: "Easy replacement",
            sport: ctx.today.sport === "strength" ? "mobility" : ctx.today.sport,
            durationMin: Math.min(40, ctx.today.durationMin),
            intensity: "easy",
            why: "Hard work is deferred because readiness is below the line for quality.",
          }]
        : [],
      requiresAcceptance: true,
      safety: false,
    };
  }
  if (/squat|volume|reduce/.test(question)) {
    return {
      title: "Why the strength work looks like this",
      answer: "Squat volume stays moderate when running or triathlon quality is in the same week. The legs have one recovery budget. Tamreen spends it on the key run or ride first, then uses single-leg and posterior-chain work that supports those sports.",
      factors: [
        { label: "Shared recovery", detail: "Heavy squats and interval running fatigue the same tissues." },
        { label: "Goal", detail: ctx.primaryGoal.replaceAll("_", " ") },
      ],
      proposedChanges: [],
      requiresAcceptance: false,
      safety: false,
    };
  }
  if (/long run|move .*sunday|sunday/.test(question)) {
    return {
      title: "Moving the long run",
      answer: "Tamreen can move the long run only onto an available day that is not already a heavy lower-body day. Accepting a proposal is what changes the calendar. Asking does not.",
      factors: [
        { label: "Rule", detail: "Do not park a full long run on top of lower-body strength." },
        { label: "Event", detail: ctx.eventName ? `${ctx.eventName} in ${ctx.daysToEvent ?? "?"} days.` : "No event date is driving a taper yet." },
      ],
      proposedChanges: [],
      requiresAcceptance: true,
      safety: false,
    };
  }
  if (/not getting faster|faster|progress/.test(question)) {
    return {
      title: "What would make you faster",
      answer: ctx.consistency && ctx.consistency.score < 70
        ? `Consistency is ${ctx.consistency.score}. The first limiter is missed training, not a missing workout type.`
        : "The plan already contains easy volume and one quality run. Getting faster usually means protecting that quality day, keeping the easy days easy, and sleeping enough to absorb it. Adding more intensity on tired legs does the opposite.",
      factors: ctx.consistency ? ctx.consistency.factors : [{ label: "Data", detail: "Not enough completed sessions to score consistency yet." }],
      proposedChanges: [],
      requiresAcceptance: false,
      safety: false,
    };
  }
  if (/eat|nutrition|breakfast|fuel/.test(question)) {
    return {
      title: "Before the long run",
      answer: "For a long run, eat a familiar carbohydrate-based meal 2–3 hours before, and practice the same drink you will use in the event. Tamreen is not a medical nutrition service. If you have a clinical condition, use a qualified professional for the plan.",
      factors: [
        { label: "Session", detail: ctx.today ? ctx.today.title : "No session is pinned to this answer." },
        { label: "Limit", detail: "This is practical sports fueling, not a diet prescription." },
      ],
      proposedChanges: [],
      requiresAcceptance: false,
      safety: false,
    };
  }
  return {
    title: `Coaching ${ctx.name || "athlete"}`,
    answer: ctx.today
      ? `Today is ${ctx.today.title}. ${ctx.today.why} Your primary goal is ${ctx.primaryGoal.replaceAll("_", " ")}.`
      : `Nothing is scheduled today. The primary goal is ${ctx.primaryGoal.replaceAll("_", " ")}. Ask about today's session, a conflict, or a change and Tamreen will show the factors before anything moves.`,
    factors: [
      { label: "Goal", detail: ctx.primaryGoal.replaceAll("_", " ") },
      { label: "Conflicts open", detail: String(ctx.conflicts.length) },
    ],
    proposedChanges: [],
    requiresAcceptance: false,
    safety: false,
  };
}

export function analyzeRun(input: {
  distanceM: number;
  durationSeconds: number;
  splitsSecPerKm: number[];
  hrStart: number | null;
  hrEnd: number | null;
}): { paceSecPerKm: number; consistency: number | null; aerobicEfficiency: number | null; insight: string } {
  const paceSecPerKm = input.distanceM > 0 ? input.durationSeconds / (input.distanceM / 1000) : 0;
  let consistency: number | null = null;
  if (input.splitsSecPerKm.length >= 3) {
    const mean = input.splitsSecPerKm.reduce((sum, split) => sum + split, 0) / input.splitsSecPerKm.length;
    const variance = input.splitsSecPerKm.reduce((sum, split) => sum + (split - mean) ** 2, 0) / input.splitsSecPerKm.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    consistency = clamp(Math.round(100 - cv * 400), 0, 100);
  }
  let aerobicEfficiency: number | null = null;
  if (input.hrStart && input.hrEnd && input.hrStart > 0) {
    const drift = (input.hrEnd - input.hrStart) / input.hrStart;
    aerobicEfficiency = clamp(Math.round(100 - drift * 250), 0, 100);
  }
  const insight = [
    consistency == null ? "Splits were not logged, so pace consistency is not scored." : `Pace consistency is ${consistency}, from the variation between the splits you entered.`,
    aerobicEfficiency == null
      ? "Heart rate was not logged at the start and end, so aerobic efficiency is not scored."
      : `Aerobic efficiency is ${aerobicEfficiency}, from heart-rate drift between the start and the end. This is a simple drift ratio, not a lab measurement.`,
  ].join(" ");
  return { paceSecPerKm, consistency, aerobicEfficiency, insight };
}

export function isPersonalRecord(best: number | null, next: number, higherIsBetter: boolean): boolean {
  if (best == null) return true;
  return higherIsBetter ? next > best : next < best;
}
