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
  const days = preferredDays(ctx);
  const sports = requiredSports(ctx);
  const sample = exercises.find((exercise) => !avoided(ctx.avoidExercises, exercise.slug, exercise.name));
  const system = [
    "You are Tamreen's training planner.",
    "Write one weekly pattern for each requested phase from the athlete's saved selections.",
    "Each pattern must contain exactly one session for every preferred day.",
    "Across that week, include every sport in mustIncludeSports.",
    "Use the saved goal, experience, minutes, equipment, event, benchmarks, and exercises to avoid.",
    "Vary the sessions across those sports and days. Do not return a single tempo run or repeat the same session on every day.",
    "Return a single JSON object and nothing else.",
    "Do not invent race results, heart-rate readings, or medical advice.",
    "Use only allowedSports, only exerciseLibrary slugs, and only the athlete's preferred days.",
    "Leave exercises empty for sports other than strength, bodybuilding, and mobility.",
    "Keep every durationMin at or below minutesPerDay.",
    "Keep each why to one short sentence.",
    "A red-flag injury must not appear here; if one does, return an empty patterns array.",
  ].join(" ");
  const user = JSON.stringify({
    task: "Generate the training plan JSON from these saved selections. Fill every preferred day and include every mustIncludeSports value.",
    selections: {
      sports: selections.sports,
      primaryGoal: selections.primaryGoal,
      goals: selections.goals,
      customGoal: selections.customGoal,
      experience: selections.experience,
      preferredDays: days,
      dayNames: days.map((day) => DAY_NAMES[day] ?? String(day)),
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
    mustIncludeSports: sports,
    requiredPhases: phases,
    exerciseLibrary: exercises.map((exercise) => ({ slug: exercise.slug, name: exercise.name })),
    jsonShape: {
      name: "short plan name",
      explanation: "why this plan matches the saved selections",
      patterns: [
        {
          phase: phases[0] ?? "base",
          focus: "what this phase is for",
          sessions: days.map((day, index) => {
            const sport = sports[index % Math.max(sports.length, 1)] ?? allowed[0] ?? "strength";
            const lift = sport === "strength" || sport === "bodybuilding" || sport === "mobility";
            return {
              weekday: day,
              sport,
              title: `${DAY_NAMES[day]} ${sport.replaceAll("_", " ")}`,
              objective: `Train ${sport.replaceAll("_", " ")} for the saved goal`,
              durationMin: Math.min(selections.minutesPerDay, 60),
              intensity: index === 0 ? "moderate" : "easy",
              importance: index === 0 ? "key" : "supporting",
              recoveryHours: 24,
              why: `This ${DAY_NAMES[day]} session follows the saved goal.`,
              lowerBody: sport !== "swimming",
              quality: index === 0,
              zones: [{ key: "effort", value: "steady" }],
              exercises: lift && sample ? [{ slug: sample.slug, sets: 3, reps: "8", targetRpe: 7, restSeconds: 60, tempo: "controlled", technique: "straight", why: "Matches the saved goal." }] : [],
            };
          }),
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
  complete: null | ((repair: string | null) => Promise<{ draft: unknown; model: string }>);
}): Promise<{ plan: BuiltPlan; source: PlanSource }> {
  if (args.ctx.redFlag || args.selections.redFlag) {
    return { plan: buildPlan(args.ctx), source: { generator: "engine", model: null, fallbackReason: "red_flag" } };
  }
  if (!args.complete) {
    return { plan: buildPlan(args.ctx), source: { generator: "engine", model: null, fallbackReason: "missing_api_key" } };
  }
  let repair: string | null = null;
  let sawInvalid = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await args.complete(repair);
      const plan = materializeChatPlan(args.ctx, result.draft, args.exercises);
      if (plan && planCoversSelections(plan, args.ctx)) {
        return { plan, source: { generator: "chatgpt", model: result.model, fallbackReason: null } };
      }
      sawInvalid = true;
      repair = plan ? coverageRepair(plan, args.ctx) : unusableRepair(args.ctx);
    } catch {
      repair = unusableRepair(args.ctx);
    }
  }
  console.error(`Training plan draft was not used. ${(repair ?? "No draft.").slice(0, 300)}`);
  return {
    plan: buildPlan(args.ctx),
    source: { generator: "engine", model: null, fallbackReason: sawInvalid ? "invalid_chatgpt_plan" : "chatgpt_unavailable" },
  };
}

export function planCoversSelections(plan: BuiltPlan, ctx: AthleteContext): boolean {
  const preferred = preferredDays(ctx);
  const required = requiredSports(ctx);
  if (!preferred.length || !plan.sessions.length || !required.length) return false;
  const present = new Set(plan.sessions.map((session) => session.sport));
  if (required.some((sport) => !present.has(sport))) return false;
  const weeks = new Map<string, { days: Set<number>; titles: Set<string> }>();
  for (const session of plan.sessions) {
    const start = addDays(session.date, -weekOffset(weekday(session.date)));
    const row = weeks.get(start) ?? { days: new Set<number>(), titles: new Set<string>() };
    row.days.add(weekday(session.date));
    row.titles.add(session.title);
    weeks.set(start, row);
  }
  for (const row of weeks.values()) {
    if (!preferred.every((day) => row.days.has(day))) continue;
    if (preferred.length > 1 && row.titles.size < 2) continue;
    return true;
  }
  return false;
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
  const unwrapped = unwrapDraft(draft);
  if (!unwrapped || typeof unwrapped !== "object") return null;
  const record = unwrapped as { name?: unknown; explanation?: unknown; focus?: unknown };
  const name = text(record.name, 80) ?? "Training plan";
  const explanation = text(record.explanation, 1200) ?? "This plan follows the sports, goal, and days saved on the profile.";
  const patterns: Array<DraftPattern & { phase: Phase }> = [];
  for (const pattern of patternRows(unwrapped).slice(0, 5)) {
    if (!pattern || typeof pattern !== "object") continue;
    const row = pattern as { phase?: unknown; focus?: unknown; sessions?: unknown; workouts?: unknown };
    const phase = phaseFrom(row.phase) ?? "base";
    const focus = text(row.focus, 240) ?? text(record.focus, 240) ?? "Training for the saved goal";
    const listed = Array.isArray(row.sessions) ? row.sessions : Array.isArray(row.workouts) ? row.workouts : [];
    const sessions = listed.slice(0, 7).flatMap((session) => {
      const parsed = parseSession(session);
      return parsed ? [parsed] : [];
    });
    if (sessions.length) patterns.push({ phase, focus, sessions });
  }
  return patterns.length ? { name, explanation, patterns } : null;
}

function unwrapDraft(draft: unknown): unknown {
  if (!draft || typeof draft !== "object") return draft;
  const record = draft as Record<string, unknown>;
  if (Array.isArray(record.patterns) || Array.isArray(record.sessions) || Array.isArray(record.weeks) || Array.isArray(record.workouts)) return draft;
  for (const key of ["plan", "training_plan", "trainingPlan", "data", "result"]) {
    const nested = record[key];
    if (nested && typeof nested === "object") return nested;
  }
  return draft;
}

function patternRows(draft: object): unknown[] {
  const record = draft as { patterns?: unknown; weeks?: unknown; sessions?: unknown; workouts?: unknown };
  if (Array.isArray(record.patterns)) return record.patterns;
  if (Array.isArray(record.weeks)) return record.weeks;
  if (record.patterns && typeof record.patterns === "object") {
    return Object.entries(record.patterns as Record<string, unknown>).map(([phase, value]) => (
      value && typeof value === "object" ? { phase, ...(value as object) } : { phase, sessions: value }
    ));
  }
  const sessions = Array.isArray(record.sessions) ? record.sessions : Array.isArray(record.workouts) ? record.workouts : null;
  return sessions ? [{ phase: "base", focus: "Saved selections", sessions }] : [];
}

function parseSession(value: unknown): DraftSession | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const sport = sportFrom(row.sport ?? row.type);
  const title = text(row.title, 80) ?? text(row.name, 80) ?? (sport ? sport.replaceAll("_", " ") : null);
  const objective = text(row.objective, 180) ?? text(row.description, 180) ?? title;
  const why = text(row.why, 400) ?? text(row.reason, 400) ?? "This session follows the saved selections.";
  const durationMin = intIn(row.durationMin ?? row.duration_min ?? row.duration ?? row.minutes, 15, 360) ?? 45;
  const intensity = intensityFrom(row.intensity) ?? "moderate";
  const importance = importanceFrom(row.importance);
  const recoveryHours = recoveryFrom(row.recoveryHours ?? row.recovery_hours ?? row.recovery);
  if (!sport || !title || !objective || !why) return null;
  const exercises = Array.isArray(row.exercises)
    ? row.exercises.slice(0, 8).flatMap((exercise) => {
      const parsed = parseExercise(exercise);
      return parsed ? [parsed] : [];
    })
    : [];
  return {
    weekday: weekdayFrom(row.weekday ?? row.day),
    sport,
    title,
    objective,
    durationMin,
    intensity,
    importance,
    recoveryHours,
    why,
    lowerBody: row.lowerBody === true || row.lower_body === true,
    quality: row.quality === true,
    zones: zonesFrom(row.zones),
    exercises,
  };
}

function parseExercise(value: unknown): DraftExercise | null {
  if (typeof value === "string") {
    const slug = tokenOf(value);
    return slug ? { slug, reps: "8", why: "Matches the saved goal.", sets: 3, restSeconds: 60, technique: "straight", targetRpe: 7, tempo: "controlled" } : null;
  }
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const slug = tokenOf(row.slug ?? row.name ?? row.exercise);
  const reps = text(row.reps, 20) ?? (intIn(row.reps, 1, 30) != null ? String(intIn(row.reps, 1, 30)) : null) ?? "8";
  const why = text(row.why, 240) ?? "Matches the saved goal.";
  const sets = intIn(row.sets, 1, 8) ?? 3;
  const restSeconds = intIn(row.restSeconds ?? row.rest_seconds ?? row.rest, 0, 300) ?? 60;
  const technique = techniqueFrom(row.technique);
  const targetRpe = intIn(row.targetRpe ?? row.target_rpe ?? row.rpe, 1, 10) ?? 7;
  const tempo = text(row.tempo, 20) ?? "controlled";
  if (!slug) return null;
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
      const slug = librarySlug(library, exercise.slug);
      const name = slug ? library.get(slug) : undefined;
      if (!slug || !name || avoided(ctx.avoidExercises, slug, name)) return [];
      return [{
        slug,
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

function preferredDays(ctx: AthleteContext): number[] {
  return [...new Set(ctx.preferredDays.filter((day) => day >= 0 && day <= 6))].sort((a, b) => weekOffset(a) - weekOffset(b));
}

export function requiredSports(ctx: AthleteContext): Sport[] {
  const allowed = new Set(allowedSports(ctx));
  const selected = new Set(ctx.sports);
  const required: Sport[] = [];
  const add = (sport: Sport) => {
    if (allowed.has(sport) && !required.includes(sport)) required.push(sport);
  };
  const tri = selected.has("triathlon") || (selected.has("running") && selected.has("cycling") && selected.has("swimming"));
  if (tri) {
    add("running");
    add("cycling");
    add("swimming");
  }
  for (const sport of ["running", "cycling", "swimming", "strength", "bodybuilding", ...COURT_SPORTS] as const) {
    if (selected.has(sport)) add(sport);
  }
  if (!required.length) {
    for (const sport of allowed) {
      if (sport !== "mobility" && sport !== "recovery" && sport !== "brick") add(sport);
    }
  }
  return required;
}

function coverageRepair(plan: BuiltPlan, ctx: AthleteContext): string {
  const coveredDays = new Set(plan.sessions.map((session) => weekday(session.date)));
  const missingDays = preferredDays(ctx).filter((day) => !coveredDays.has(day)).map((day) => DAY_NAMES[day]);
  const present = new Set(plan.sessions.map((session) => session.sport));
  const missingSports = requiredSports(ctx).filter((sport) => !present.has(sport));
  return [
    "The previous plan did not follow the saved selections.",
    missingDays.length ? `Add a different session on each missing day: ${missingDays.join(", ")}.` : "",
    missingSports.length ? `Include these sports: ${missingSports.join(", ")}.` : "",
    "Do not return only a tempo run.",
  ].filter(Boolean).join(" ");
}

function unusableRepair(ctx: AthleteContext): string {
  const days = preferredDays(ctx).map((day) => DAY_NAMES[day]).join(", ");
  const sports = requiredSports(ctx).join(", ");
  return `Return one JSON object. Each weekly pattern needs a different session on every preferred day (${days}) and must include these sports (${sports}). Do not return only a tempo run.`;
}

const SPORT_ALIASES: Record<string, Sport> = {
  run: "running",
  runs: "running",
  jogging: "running",
  jog: "running",
  ride: "cycling",
  bike: "cycling",
  biking: "cycling",
  cycle: "cycling",
  swim: "swimming",
  gym: "strength",
  weight: "strength",
  weights: "strength",
  weight_training: "strength",
  strength_training: "strength",
  lifting: "strength",
  lift: "strength",
  resistance: "strength",
  hypertrophy: "bodybuilding",
  soccer: "football",
};

const INTENSITY_ALIASES: Record<string, Intensity> = {
  zone_1: "recovery",
  zone_2: "easy",
  aerobic: "easy",
  endurance: "easy",
  conversational: "easy",
  steady: "moderate",
  moderate_effort: "moderate",
  comfortably_hard: "tempo",
  tempo_run: "tempo",
  marathon_pace: "tempo",
  threshold_run: "threshold",
  sweet_spot: "tempo",
  hard: "threshold",
  interval: "vo2",
  intervals: "vo2",
  vo2max: "vo2",
  vo2_max: "vo2",
  sprint: "vo2",
  match: "tempo",
  match_speed: "tempo",
  practice: "moderate",
  rest: "recovery",
};

function sportFrom(value: unknown): Sport | null {
  const token = tokenOf(value);
  if (!token) return null;
  return oneOf(SPORT_ALIASES[token] ?? token, SPORTS);
}

function intensityFrom(value: unknown): Intensity | null {
  const token = tokenOf(value);
  if (!token) return null;
  return oneOf(INTENSITY_ALIASES[token] ?? token, INTENSITIES);
}

function phaseFrom(value: unknown): Phase | null {
  const token = tokenOf(value)?.replace(/_phase$/, "");
  if (!token) return null;
  const aliases: Record<string, Phase> = { foundation: "base", accumulation: "base", deload: "recovery" };
  return oneOf(aliases[token] ?? token, PHASES);
}

function importanceFrom(value: unknown): DraftSession["importance"] {
  const token = tokenOf(value);
  if (token === "key" || token === "primary" || token === "main") return "key";
  if (token === "optional") return "optional";
  return "supporting";
}

function techniqueFrom(value: unknown): DraftExercise["technique"] {
  const token = tokenOf(value);
  if (token === "superset" || token === "super_set") return "superset";
  if (token === "warmup" || token === "warm_up") return "warmup";
  return "straight";
}

function weekdayFrom(value: unknown): number | null {
  if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value.trim()))) {
    return intIn(typeof value === "number" ? value : Number(value), 0, 6);
  }
  const token = tokenOf(value);
  const names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const short = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const index = token ? names.indexOf(token) : -1;
  if (index >= 0) return index;
  const brief = token ? short.indexOf(token.slice(0, 3)) : -1;
  return brief >= 0 ? brief : null;
}

function recoveryFrom(value: unknown): number {
  const parsed = intIn(value, 1, 168);
  if (parsed == null) return 24;
  if (parsed < 8) return parsed * 24 <= 72 ? parsed * 24 : 24;
  return Math.min(parsed, 72);
}

function librarySlug(library: Map<string, string>, slugOrName: string): string | null {
  if (library.has(slugOrName)) return slugOrName;
  const needle = slugOrName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (const [slug, name] of library) {
    if (slug.replaceAll("_", " ") === needle || name.toLowerCase() === needle) return slug;
  }
  return library.has(needle.replaceAll(" ", "_")) ? needle.replaceAll(" ", "_") : null;
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

function tokenOf(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.round(value));
  if (typeof value !== "string") return null;
  const token = value.trim().toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return token || null;
}

function intIn(value: unknown, min: number, max: number): number | null {
  const match = typeof value === "string" ? value.trim().match(/-?\d+(\.\d+)?/) : null;
  const parsed = typeof value === "number" ? value : match ? Number(match[0]) : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return rounded >= min && rounded <= max ? rounded : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : null;
}
