import {
  addDays,
  buildPlan,
  clamp,
  daysBetween,
  phaseForWeek,
  sessionLoad,
  weekday,
  type AthleteContext,
  type BuiltPlan,
  type Intensity,
  type Phase,
  type PlannedSession,
  type Sport,
  type TrainingBlock,
} from "@/services/training/engine";

const PHASES = ["base", "build", "peak", "taper", "recovery"] as const;
const INTENSITIES = ["recovery", "easy", "moderate", "tempo", "threshold", "vo2", "race", "max"] as const;
const SPORTS = [
  "strength",
  "bodybuilding",
  "running",
  "cycling",
  "swimming",
  "brick",
  "mobility",
  "recovery",
  "football",
  "padel",
  "basketball",
  "tennis",
  "volleyball",
  "pickleball",
  "badminton",
  "cricket",
] as const satisfies readonly Sport[];
const COURT_SPORTS = ["football", "padel", "basketball", "tennis", "volleyball", "pickleball", "badminton", "cricket"] as const;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface StoredSelections {
  sports: string[];
  primaryGoal: string;
  goals: string[];
  customGoal: string | null;
  experience: string;
  preferredDays: number[];
  minutesPerDay: number;
  gymAccess: boolean;
  poolAccess: boolean;
  bikeAccess: boolean;
  eventName: string | null;
  eventDate: string | null;
  eventDistanceM: number | null;
  goalTimeSeconds: number | null;
  avoidExercises: string[];
  injuryAreas: string[];
  redFlag: boolean;
  sex: string | null;
  benchmarks: {
    fiveKSeconds: number | null;
    tenKSeconds: number | null;
    halfSeconds: number | null;
    marathonSeconds: number | null;
    weeklyRunKm: number | null;
    ftpWatts: number | null;
    weeklyBikeKm: number | null;
    swim100Seconds: number | null;
    swim400Seconds: number | null;
    weeklySwimM: number | null;
    squatKg: number | null;
    benchKg: number | null;
    deadliftKg: number | null;
    weightKg: number | null;
  };
}

export interface PlanSource {
  generator: "chatgpt" | "engine";
  model: string | null;
  fallbackReason: "red_flag" | "missing_api_key" | "invalid_chatgpt_plan" | "chatgpt_unavailable" | null;
}

interface LibraryExercise {
  slug: string;
  name: string;
}

interface DraftExercise {
  slug: string;
  sets: number;
  reps: string;
  targetRpe: number;
  restSeconds: number;
  tempo: string;
  technique: "straight" | "superset" | "warmup";
  why: string;
}

interface DraftSession {
  weekday: number | null;
  sport: Sport;
  title: string;
  objective: string;
  durationMin: number;
  intensity: Intensity;
  importance: PlannedSession["importance"];
  recoveryHours: number;
  why: string;
  lowerBody: boolean;
  quality: boolean;
  zones: Record<string, string>;
  exercises: DraftExercise[];
}

interface DraftPattern {
  focus: string;
  sessions: DraftSession[];
}

const IMPORTANCE_RANK = { key: 0, supporting: 1, optional: 2 };

export function planInputs(selections: StoredSelections, source: PlanSource) {
  return {
    sports: selections.sports,
    minutes: selections.minutesPerDay,
    days: selections.preferredDays,
    generator: source.generator,
    model: source.model,
    fallbackReason: source.fallbackReason,
    selections,
  };
}

export function describePlanSource(inputs: unknown): { eyebrow: string; detail: string; chips: string[] } | null {
  if (!inputs || typeof inputs !== "object") return null;
  const record = inputs as { generator?: unknown; fallbackReason?: unknown; selections?: unknown };
  const selections = record.selections && typeof record.selections === "object" ? record.selections as Partial<StoredSelections> : null;
  const generator = record.generator === "chatgpt" || record.generator === "engine" ? record.generator : null;
  if (!generator && !selections) return null;
  const reason = typeof record.fallbackReason === "string" ? record.fallbackReason : null;
  const detail = reason === "red_flag"
    ? "A red-flag injury is saved on your profile, so TamreenAI kept this as a recovery plan."
    : "TamreenAI created this plan from the sports, goal, days, and equipment saved on your profile.";
  return {
    eyebrow: "TamreenAI",
    detail,
    chips: selectionChips(selections),
  };
}

export function chatPlanMessages(ctx: AthleteContext, selections: StoredSelections, exercises: LibraryExercise[]) {
  const allowed = allowedSports(ctx);
  const phases = phasesForHorizon(ctx);
  const system = [
    "You are Tamreen's training planner.",
    "Write one weekly pattern for each requested phase from the athlete's saved selections.",
    "Return a single JSON object and nothing else.",
    "Do not invent race results, heart-rate readings, or medical advice.",
    "Use only allowedSports, only exerciseLibrary slugs, and only the athlete's preferred days.",
    "Leave exercises empty for sports other than strength, bodybuilding, and mobility.",
    "Keep every durationMin at or below minutesPerDay.",
    "A red-flag injury must not appear here; if one does, return an empty patterns array.",
  ].join(" ");
  const user = JSON.stringify({
    task: "Generate the training plan JSON from these saved selections.",
    selections: {
      sports: selections.sports,
      primaryGoal: selections.primaryGoal,
      goals: selections.goals,
      customGoal: selections.customGoal,
      experience: selections.experience,
      preferredDays: selections.preferredDays,
      dayNames: selections.preferredDays.map((day) => DAY_NAMES[day] ?? String(day)),
      minutesPerDay: selections.minutesPerDay,
      gymAccess: selections.gymAccess,
      poolAccess: selections.poolAccess,
      bikeAccess: selections.bikeAccess,
      eventName: selections.eventName,
      eventDate: selections.eventDate,
      eventDistanceM: selections.eventDistanceM,
      goalTimeSeconds: selections.goalTimeSeconds,
      avoidExercises: selections.avoidExercises,
      injuryAreas: selections.injuryAreas,
      sex: selections.sex,
      benchmarks: selections.benchmarks,
    },
    allowedSports: allowed,
    requiredPhases: phases,
    exerciseLibrary: exercises.map((exercise) => ({ slug: exercise.slug, name: exercise.name })),
    jsonShape: {
      name: "short plan name",
      explanation: "why this plan matches the saved selections",
      patterns: [
        {
          phase: phases[0] ?? "base",
          focus: "what this phase is for",
          sessions: [
            {
              weekday: selections.preferredDays[0] ?? 1,
              sport: allowed[0] ?? "strength",
              title: "session title",
              objective: "what the session trains",
              durationMin: Math.min(selections.minutesPerDay, 60),
              intensity: "moderate",
              importance: "key",
              recoveryHours: 24,
              why: "how this session follows the saved goal",
              lowerBody: false,
              quality: false,
              zones: [{ key: "effort", value: "steady" }],
              exercises: [],
            },
          ],
        },
      ],
    },
  });
  return { system, user };
}

export async function resolvePlan(args: {
  ctx: AthleteContext;
  selections: StoredSelections;
  exercises: LibraryExercise[];
  complete: null | (() => Promise<{ draft: unknown; model: string }>);
}): Promise<{ plan: BuiltPlan; source: PlanSource }> {
  if (args.ctx.redFlag || args.selections.redFlag) {
    return { plan: buildPlan(args.ctx), source: { generator: "engine", model: null, fallbackReason: "red_flag" } };
  }
  if (!args.complete) {
    return { plan: buildPlan(args.ctx), source: { generator: "engine", model: null, fallbackReason: "missing_api_key" } };
  }
  try {
    const result = await args.complete();
    const plan = materializeChatPlan(args.ctx, result.draft, args.exercises);
    if (!plan) {
      return { plan: buildPlan(args.ctx), source: { generator: "engine", model: null, fallbackReason: "invalid_chatgpt_plan" } };
    }
    return { plan, source: { generator: "chatgpt", model: result.model, fallbackReason: null } };
  } catch {
    return { plan: buildPlan(args.ctx), source: { generator: "engine", model: null, fallbackReason: "chatgpt_unavailable" } };
  }
}

export function materializeChatPlan(ctx: AthleteContext, draft: unknown, exercises: LibraryExercise[]): BuiltPlan | null {
  if (ctx.redFlag || ctx.preferredDays.length === 0) return null;
  const parsed = parseDraft(draft);
  if (!parsed) return null;
  const library = new Map(exercises.map((exercise) => [exercise.slug, exercise.name]));
  const allowed = new Set(allowedSports(ctx));
  const patterns = new Map<Phase, DraftPattern>();
  for (const pattern of parsed.patterns) {
    const sessions = pattern.sessions.filter((session) => allowed.has(session.sport));
    if (!sessions.length || patterns.has(pattern.phase)) continue;
    patterns.set(pattern.phase, { focus: pattern.focus, sessions });
  }
  const fallback = [...patterns.values()][0];
  if (!fallback) return null;

  const weeks = horizonWeeks(ctx);
  const origin = addDays(ctx.startDate, -weekOffset(weekday(ctx.startDate)));
  const endDate = addDays(ctx.startDate, weeks * 7 - 1);
  const preferred = [...new Set(ctx.preferredDays.filter((day) => day >= 0 && day <= 6))].sort((a, b) => weekOffset(a) - weekOffset(b));
  const sessions: PlannedSession[] = [];
  const blocks: TrainingBlock[] = [];
  let blockStart = ctx.startDate;
  let currentPhase = phaseForWeek(0, weeks);

  for (let week = 0; week < weeks; week += 1) {
    const phase = phaseForWeek(week, weeks);
    const weekStart = addDays(origin, week * 7);
    if (phase !== currentPhase) {
      blocks.push({
        phase: currentPhase,
        name: blockName(currentPhase),
        startDate: blockStart,
        endDate: addDays(weekStart, -1),
        focus: (patterns.get(currentPhase) ?? fallback).focus,
        sortOrder: blocks.length,
      });
      blockStart = weekStart < ctx.startDate ? ctx.startDate : weekStart;
      currentPhase = phase;
    }
    const pattern = patterns.get(phase) ?? fallback;
    for (const item of assignDays(pattern.sessions, preferred)) {
      const date = addDays(weekStart, weekOffset(item.day));
      if (date < ctx.startDate || date > endDate) continue;
      sessions.push(toSession(ctx, item.session, date, phase, library));
    }
  }
  blocks.push({
    phase: currentPhase,
    name: blockName(currentPhase),
    startDate: blockStart,
    endDate,
    focus: (patterns.get(currentPhase) ?? fallback).focus,
    sortOrder: blocks.length,
  });
  if (sessions.length < Math.min(4, weeks)) return null;
  return {
    name: parsed.name,
    explanation: parsed.explanation,
    startDate: ctx.startDate,
    endDate,
    blocks,
    sessions,
  };
}

function parseDraft(draft: unknown): { name: string; explanation: string; patterns: Array<DraftPattern & { phase: Phase }> } | null {
  if (!draft || typeof draft !== "object") return null;
  const record = draft as { name?: unknown; explanation?: unknown; patterns?: unknown };
  const name = text(record.name, 80);
  const explanation = text(record.explanation, 1200);
  if (!name || !explanation || explanation.length < 20 || !Array.isArray(record.patterns)) return null;
  const patterns: Array<DraftPattern & { phase: Phase }> = [];
  for (const pattern of record.patterns.slice(0, 5)) {
    if (!pattern || typeof pattern !== "object") continue;
    const row = pattern as { phase?: unknown; focus?: unknown; sessions?: unknown };
    const phase = oneOf(row.phase, PHASES);
    const focus = text(row.focus, 240);
    if (!phase || !focus || !Array.isArray(row.sessions)) continue;
    const sessions = row.sessions.slice(0, 7).flatMap((session) => {
      const parsed = parseSession(session);
      return parsed ? [parsed] : [];
    });
    if (sessions.length) patterns.push({ phase, focus, sessions });
  }
  return patterns.length ? { name, explanation, patterns } : null;
}

function parseSession(value: unknown): DraftSession | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const sport = oneOf(row.sport, SPORTS);
  const title = text(row.title, 80);
  const objective = text(row.objective, 180);
  const why = text(row.why, 400);
  const durationMin = intIn(row.durationMin, 15, 360);
  const intensity = oneOf(row.intensity, INTENSITIES);
  const importance = oneOf(row.importance, ["key", "supporting", "optional"] as const) ?? "supporting";
  const recoveryHours = intIn(row.recoveryHours, 8, 72);
  if (!sport || !title || !objective || !why || durationMin == null || !intensity || recoveryHours == null) return null;
  const exercises = Array.isArray(row.exercises)
    ? row.exercises.slice(0, 8).flatMap((exercise) => {
      const parsed = parseExercise(exercise);
      return parsed ? [parsed] : [];
    })
    : [];
  return {
    weekday: intIn(row.weekday, 0, 6),
    sport,
    title,
    objective,
    durationMin,
    intensity,
    importance,
    recoveryHours,
    why,
    lowerBody: row.lowerBody === true,
    quality: row.quality === true,
    zones: zonesFrom(row.zones),
    exercises,
  };
}

function parseExercise(value: unknown): DraftExercise | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const slug = text(row.slug, 80);
  const reps = text(row.reps, 20);
  const why = text(row.why, 240);
  const sets = intIn(row.sets, 1, 8);
  const restSeconds = intIn(row.restSeconds, 0, 300);
  const technique = oneOf(row.technique, ["straight", "superset", "warmup"] as const);
  const targetRpe = typeof row.targetRpe === "number" && row.targetRpe >= 1 && row.targetRpe <= 10 ? row.targetRpe : null;
  const tempo = text(row.tempo, 20) ?? "controlled";
  if (!slug || !reps || !why || sets == null || restSeconds == null || !technique || targetRpe == null) return null;
  return { slug, reps, why, sets, restSeconds, technique, targetRpe, tempo };
}

function toSession(
  ctx: AthleteContext,
  draft: DraftSession,
  date: string,
  phase: Phase,
  library: Map<string, string>,
): PlannedSession {
  let intensity = capIntensity(phase, draft.intensity);
  if (ctx.currentInjuryAreas.length && (intensity === "vo2" || intensity === "race" || intensity === "max")) intensity = "tempo";
  const durationMin = clamp(draft.durationMin, Math.min(20, ctx.minutesPerDay), ctx.minutesPerDay);
  const lift = draft.sport === "strength" || draft.sport === "bodybuilding" || draft.sport === "mobility";
  const exercises = lift
    ? draft.exercises.flatMap((exercise) => {
      const name = library.get(exercise.slug);
      if (!name || avoided(ctx.avoidExercises, exercise.slug, name)) return [];
      return [{
        slug: exercise.slug,
        name,
        sets: exercise.sets,
        reps: exercise.reps,
        targetRpe: clamp(Math.round(exercise.targetRpe), phase === "recovery" || phase === "taper" ? 6 : 5, 9),
        restSeconds: exercise.restSeconds,
        tempo: exercise.tempo,
        technique: exercise.technique,
        why: exercise.why,
      }];
    })
    : [];
  const hard = intensity === "threshold" || intensity === "vo2" || intensity === "race" || intensity === "max";
  const lowerBody = draft.sport === "swimming" || draft.sport === "mobility" || draft.sport === "recovery"
    ? false
    : draft.sport === "strength" || draft.sport === "bodybuilding"
      ? draft.lowerBody
      : true;
  return {
    date,
    sport: draft.sport,
    title: draft.title,
    objective: draft.objective,
    durationMin,
    intensity,
    expectedLoad: sessionLoad(durationMin, intensity, draft.sport),
    importance: draft.importance,
    recoveryHours: draft.recoveryHours,
    why: draft.why,
    lowerBody,
    quality: hard,
    phase,
    structure: { source: "chatgpt", exercises: exercises.map((exercise) => exercise.slug) },
    zones: draft.zones,
    exercises,
  };
}

export function allowedSports(ctx: AthleteContext): Sport[] {
  const selected = new Set(ctx.sports);
  const tri = selected.has("triathlon") || (selected.has("running") && selected.has("cycling") && selected.has("swimming"));
  const court = COURT_SPORTS.filter((sport) => selected.has(sport));
  const sports: Sport[] = ["mobility", "recovery"];
  const lift = ctx.gymAccess && (selected.has("strength") || selected.has("bodybuilding") || tri || selected.has("running") || selected.has("cycling") || selected.has("swimming") || court.length > 0);
  if (lift) sports.push(selected.has("bodybuilding") && !selected.has("strength") && !tri ? "bodybuilding" : "strength");
  if (ctx.gymAccess && selected.has("bodybuilding") && selected.has("strength")) sports.push("bodybuilding");
  if (selected.has("running") || tri) sports.push("running");
  if ((selected.has("cycling") || tri) && (ctx.bikeAccess || selected.has("cycling") || tri)) sports.push("cycling");
  if (ctx.poolAccess && (selected.has("swimming") || tri)) sports.push("swimming");
  if (tri && ctx.bikeAccess && (selected.has("running") || tri)) sports.push("brick");
  sports.push(...court);
  return [...new Set(sports)];
}

function assignDays(sessions: DraftSession[], preferred: number[]): Array<{ session: DraftSession; day: number }> {
  const ranked = [...sessions]
    .map((session, index) => ({ session, index }))
    .sort((a, b) => IMPORTANCE_RANK[a.session.importance] - IMPORTANCE_RANK[b.session.importance] || a.index - b.index)
    .map((item) => item.session);
  const open = new Set(preferred);
  const placed: Array<{ session: DraftSession; day: number }> = [];
  const waiting: DraftSession[] = [];
  for (const session of ranked) {
    if (session.weekday != null && open.has(session.weekday)) {
      open.delete(session.weekday);
      placed.push({ session, day: session.weekday });
      continue;
    }
    waiting.push(session);
  }
  const remaining = [...open].sort((a, b) => weekOffset(a) - weekOffset(b));
  waiting.slice(0, remaining.length).forEach((session, index) => {
    placed.push({ session, day: remaining[index] });
  });
  return placed;
}

function phasesForHorizon(ctx: AthleteContext): Phase[] {
  const weeks = horizonWeeks(ctx);
  const phases: Phase[] = [];
  for (let week = 0; week < weeks; week += 1) {
    const phase = phaseForWeek(week, weeks);
    if (!phases.includes(phase)) phases.push(phase);
  }
  return phases;
}

function horizonWeeks(ctx: AthleteContext): number {
  const eventWeeks = ctx.eventDate ? Math.max(1, Math.ceil(daysBetween(ctx.startDate, ctx.eventDate) / 7)) : 8;
  return clamp(eventWeeks, 4, 16);
}

function capIntensity(phase: Phase, intensity: Intensity): Intensity {
  if (phase === "recovery") return intensity === "recovery" ? "recovery" : "easy";
  if (phase === "taper" && (intensity === "vo2" || intensity === "race" || intensity === "max")) return "threshold";
  if (phase === "base" && (intensity === "vo2" || intensity === "race" || intensity === "max")) return "tempo";
  return intensity;
}

function avoided(avoid: string[], slug: string, name: string): boolean {
  const haystack = `${slug} ${name}`.toLowerCase();
  return avoid.some((item) => {
    const needle = item.toLowerCase().trim();
    if (!needle) return false;
    return haystack.includes(needle) || needle.includes(slug.replaceAll("_", " ")) || needle.includes(slug);
  });
}

function zonesFrom(value: unknown): Record<string, string> {
  const entries = Array.isArray(value)
    ? value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as { key?: unknown; value?: unknown };
      return [[row.key, row.value] as const];
    })
    : value && typeof value === "object"
      ? Object.entries(value as Record<string, unknown>)
      : [];
  const zones: Record<string, string> = {};
  for (const [rawKey, rawValue] of entries.slice(0, 6)) {
    const key = text(rawKey, 24)?.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const zone = text(rawValue, 80);
    if (key && zone) zones[key] = zone;
  }
  return zones;
}

function selectionChips(selections: Partial<StoredSelections> | null): string[] {
  if (!selections) return [];
  const chips: string[] = [];
  const sports = Array.isArray(selections.sports) ? selections.sports.filter((sport) => typeof sport === "string") : [];
  if (sports.length) chips.push(sports.map((sport) => sport.replaceAll("_", " ")).join(", "));
  if (typeof selections.primaryGoal === "string" && selections.primaryGoal) {
    chips.push(`Goal: ${selections.customGoal || selections.primaryGoal.replaceAll("_", " ")}`);
  }
  if (Array.isArray(selections.preferredDays) && selections.preferredDays.length) {
    const days = selections.preferredDays.filter((day) => typeof day === "number");
    chips.push(days.length === 7 ? "Every day" : days.map((day) => DAY_NAMES[day] ?? String(day)).join(" "));
  }
  if (typeof selections.minutesPerDay === "number") chips.push(`${selections.minutesPerDay} min`);
  if (typeof selections.eventName === "string" && selections.eventName) chips.push(selections.eventName);
  return chips;
}

function blockName(phase: Phase): string {
  return { base: "Base", build: "Build", peak: "Peak", taper: "Taper", recovery: "Recovery" }[phase];
}

function weekOffset(day: number): number {
  return (day + 6) % 7;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, max) : null;
}

function intIn(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return rounded >= min && rounded <= max ? rounded : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : null;
}
