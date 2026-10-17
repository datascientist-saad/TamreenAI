import assert from "node:assert/strict";
import test from "node:test";
import { sessionLoad, weekday, type AthleteContext } from "@/services/training/engine";
import { readModelJson } from "./openai";
import {
  chatPlanMessages,
  describePlanSource,
  materializeChatPlan,
  planCoversSelections,
  planInputs,
  resolvePlan,
  type StoredSelections,
} from "./plan";

const athlete: AthleteContext = {
  startDate: "2026-10-17",
  sports: ["padel", "strength"],
  primaryGoal: "improve_padel",
  goals: ["improve_padel", "increase_strength"],
  experience: "intermediate",
  preferredDays: [1, 6],
  minutesPerDay: 60,
  gymAccess: true,
  poolAccess: false,
  bikeAccess: false,
  eventDate: null,
  eventName: null,
  avoidExercises: ["squat"],
  currentInjuryAreas: [],
  redFlag: false,
  weightKg: 78,
  sex: "male",
  reported: { squatKg: 100 },
};

const selections: StoredSelections = {
  sports: ["padel", "strength"],
  primaryGoal: "improve_padel",
  goals: ["improve_padel", "increase_strength"],
  customGoal: null,
  experience: "intermediate",
  preferredDays: [1, 6],
  minutesPerDay: 60,
  gymAccess: true,
  poolAccess: false,
  bikeAccess: false,
  eventName: null,
  eventDate: null,
  eventDistanceM: null,
  goalTimeSeconds: null,
  avoidExercises: ["squat"],
  injuryAreas: [],
  redFlag: false,
  sex: "male",
  benchmarks: {
    fiveKSeconds: null,
    tenKSeconds: null,
    halfSeconds: null,
    marathonSeconds: null,
    weeklyRunKm: null,
    ftpWatts: null,
    weeklyBikeKm: null,
    swim100Seconds: null,
    swim400Seconds: null,
    weeklySwimM: null,
    squatKg: 100,
    benchKg: null,
    deadliftKg: null,
    weightKg: 78,
  },
};

const library = [
  { slug: "back_squat", name: "Back squat" },
  { slug: "plank", name: "Plank" },
];

function draft() {
  return {
    name: "Padel and strength plan",
    explanation: "This week keeps padel speed away from heavy squats and uses the two days you saved.",
    patterns: [
      {
        phase: "build",
        focus: "Match speed and supporting strength",
        sessions: [
          {
            weekday: 6,
            sport: "swimming",
            title: "Pool session",
            objective: "Should be dropped",
            durationMin: 200,
            intensity: "vo2",
            importance: "key",
            recoveryHours: 24,
            why: "The athlete did not select a pool.",
            lowerBody: false,
            quality: true,
            zones: [],
            exercises: [],
          },
          {
            weekday: 6,
            sport: "padel",
            title: "Padel point play",
            objective: "Short points and the split step",
            durationMin: 75,
            intensity: "vo2",
            importance: "key",
            recoveryHours: 30,
            why: "Padel is the primary saved goal, so the key day is match speed.",
            lowerBody: true,
            quality: true,
            zones: [{ key: "Effort", value: "match speed" }],
            exercises: [],
          },
          {
            weekday: 1,
            sport: "strength",
            title: "Strength support",
            objective: "Trunk and upper body that leave the legs for padel",
            durationMin: 50,
            intensity: "moderate",
            importance: "supporting",
            recoveryHours: 24,
            why: "Squat variations are on the avoid list, so the strength day uses a plank instead.",
            lowerBody: false,
            quality: false,
            zones: { note: "RPE 7" },
            exercises: [
              { slug: "back_squat", sets: 4, reps: "5", targetRpe: 8, restSeconds: 120, tempo: "controlled", technique: "straight", why: "Should be removed." },
              { slug: "missing_move", sets: 3, reps: "8", targetRpe: 7, restSeconds: 60, tempo: "controlled", technique: "straight", why: "Unknown." },
              { slug: "plank", sets: 3, reps: "30 sec", targetRpe: 7, restSeconds: 45, tempo: "controlled", technique: "straight", why: "Trunk stiffness for the split step." },
            ],
          },
        ],
      },
    ],
  };
}

test("ChatGPT draft is placed only on saved days and drops disallowed work", () => {
  const plan = materializeChatPlan(athlete, draft(), library);
  assert.ok(plan);
  assert.equal(plan?.name, "Padel and strength plan");
  assert.ok(plan && plan.sessions.length >= 4);
  assert.ok(plan?.sessions.every((session) => session.date >= athlete.startDate));
  assert.ok(plan?.sessions.every((session) => weekday(session.date) === 1 || weekday(session.date) === 6));
  assert.equal(plan?.sessions.some((session) => session.sport === "swimming"), false);
  assert.equal(plan?.sessions.some((session) => session.date === "2026-10-17" && session.sport === "padel"), true);
  const padel = plan?.sessions.find((session) => session.sport === "padel" && session.phase === "taper");
  assert.equal(padel?.intensity, "threshold");
  assert.equal(padel?.durationMin, 60);
  assert.equal(padel?.expectedLoad, sessionLoad(60, "threshold", "padel"));
  assert.equal(padel?.zones.effort, "match speed");
  const strength = plan?.sessions.find((session) => session.sport === "strength");
  assert.deepEqual(strength?.exercises.map((exercise) => exercise.slug), ["plank"]);
  assert.equal(plan?.sessions.some((session) => session.structure.source !== "chatgpt"), false);
  const visible = plan?.sessions.filter((session) => session.date >= "2026-10-17" && session.date <= "2026-10-23") ?? [];
  const visibleSports = new Set(visible.map((session) => session.sport));
  assert.ok(visibleSports.has("padel"));
  assert.ok(visibleSports.has("strength"));
  assert.equal(visible.some((session) => session.title === "Tempo run"), false);
  assert.equal(plan ? planCoversSelections(plan, athlete) : false, true);
});

test("a draft that does not match the selections is rejected", () => {
  assert.equal(materializeChatPlan(athlete, { name: "x", explanation: "too short", patterns: [] }, library), null);
  assert.equal(materializeChatPlan({ ...athlete, redFlag: true }, draft(), library), null);
});

test("resolvePlan keeps the engine when ChatGPT cannot be used", async () => {
  let calls = 0;
  const blocked = await resolvePlan({
    ctx: { ...athlete, redFlag: true },
    selections: { ...selections, redFlag: true },
    exercises: library,
    complete: async () => {
      calls += 1;
      return { draft: draft(), model: "gpt-4.1-mini" };
    },
  });
  assert.equal(calls, 0);
  assert.equal(blocked.source.fallbackReason, "red_flag");
  assert.match(blocked.plan.explanation, /red-flag/i);

  const missing = await resolvePlan({ ctx: athlete, selections, exercises: library, complete: null });
  assert.equal(missing.source.fallbackReason, "missing_api_key");
  assert.equal(missing.source.generator, "engine");

  const broken = await resolvePlan({
    ctx: athlete,
    selections,
    exercises: library,
    complete: async () => {
      throw new Error("network");
    },
  });
  assert.equal(broken.source.fallbackReason, "chatgpt_unavailable");

  const accepted = await resolvePlan({
    ctx: athlete,
    selections,
    exercises: library,
    complete: async () => ({ draft: draft(), model: "gpt-4.1-mini" }),
  });
  assert.equal(accepted.source.generator, "chatgpt");
  assert.equal(accepted.source.model, "gpt-4.1-mini");
  assert.equal(planInputs(selections, accepted.source).selections.primaryGoal, "improve_padel");
});

test("the ChatGPT prompt contains the saved selections and no secret", () => {
  const messages = chatPlanMessages(athlete, selections, library);
  assert.match(messages.user, /improve_padel/);
  assert.match(messages.user, /"avoidExercises":\["squat"\]/);
  assert.match(messages.user, /mustIncludeSports/);
  assert.match(messages.system, /every preferred day/);
  assert.match(messages.user, /"weekday":1/);
  assert.match(messages.user, /"weekday":6/);
  assert.doesNotMatch(`${messages.system}\n${messages.user}`, /sk-|@/);
  const described = describePlanSource(planInputs(selections, { generator: "chatgpt", model: "gpt-4.1-mini", fallbackReason: null }));
  assert.equal(described?.eyebrow, "TamreenAI");
  assert.match(described?.detail ?? "", /TamreenAI created this plan/);
  assert.doesNotMatch(described?.detail ?? "", /ChatGPT/);
  assert.match(described?.chips.join(" ") ?? "", /padel/);
  const fallback = describePlanSource(planInputs(selections, { generator: "engine", model: null, fallbackReason: "invalid_chatgpt_plan" }));
  assert.equal(fallback?.eyebrow, "TamreenAI");
  assert.match(fallback?.detail ?? "", /TamreenAI created this plan/);
  assert.doesNotMatch(fallback?.detail ?? "", /ChatGPT|training rules/);
});

test("a loose draft still schedules every saved day and sport", () => {
  const plan = materializeChatPlan(athlete, {
    plan: {
      name: "Padel week",
      explanation: "Uses the two saved days.",
      patterns: [{
        phase: "Base",
        focus: "Match play and strength",
        sessions: [
          { weekday: "Saturday", sport: "Padel", title: "Point play", objective: "Split step", duration: "50 min", intensity: "match speed", importance: "key", why: "Primary goal.", lowerBody: true },
          { day: "Monday", sport: "gym", title: "Strength support", minutes: 45, intensity: "moderate", why: "Leave the legs for padel.", exercises: [{ name: "Plank", sets: "3", reps: "30 sec" }] },
        ],
      }],
    },
  }, library);
  assert.ok(plan);
  assert.equal(plan ? planCoversSelections(plan, athlete) : false, true);
  const visible = plan?.sessions.filter((session) => session.date >= athlete.startDate && session.date <= "2026-10-23") ?? [];
  assert.ok(visible.some((session) => session.sport === "padel" && session.title === "Point play"));
  assert.ok(visible.some((session) => session.sport === "strength"));
  const strength = plan?.sessions.find((session) => session.sport === "strength");
  assert.deepEqual(strength?.exercises.map((exercise) => exercise.slug), ["plank"]);
});

test("a single tempo run is replaced by the saved sports and days", async () => {
  const repairs: Array<string | null> = [];
  const runner: AthleteContext = {
    ...athlete,
    sports: ["running", "strength"],
    primaryGoal: "improve_5k",
    goals: ["improve_5k", "increase_strength"],
  };
  const runnerSelections = { ...selections, sports: ["running", "strength"], primaryGoal: "improve_5k", goals: ["improve_5k", "increase_strength"] };
  const resolved = await resolvePlan({
    ctx: runner,
    selections: runnerSelections,
    exercises: library,
    complete: async (repair) => {
      repairs.push(repair);
      if (!repair) {
        return {
          draft: {
            name: "Tempo only",
            explanation: "One tempo run repeated for the week.",
            patterns: [{
              phase: "base",
              focus: "Tempo",
              sessions: [{
                weekday: 6,
                sport: "running",
                title: "Tempo run",
                objective: "One hard run",
                durationMin: 40,
                intensity: "tempo",
                importance: "key",
                recoveryHours: 24,
                why: "A generic tempo run.",
                lowerBody: true,
                quality: true,
                zones: [],
                exercises: [],
              }],
            }],
          },
          model: "gpt-4.1-mini",
        };
      }
      return {
        draft: {
          name: "Running and strength",
          explanation: "Monday is strength and Saturday is the quality run from the saved days.",
          patterns: [{
            phase: "base",
            focus: "5K and strength",
            sessions: [
              {
                weekday: 1,
                sport: "strength",
                title: "Strength support",
                objective: "Upper body that leaves the legs for running",
                durationMin: 45,
                intensity: "moderate",
                importance: "supporting",
                recoveryHours: 24,
                why: "Strength is one of the saved sports.",
                lowerBody: false,
                quality: false,
                zones: [],
                exercises: [{ slug: "plank", sets: 3, reps: "30 sec", targetRpe: 7, restSeconds: 45, tempo: "controlled", technique: "straight", why: "Trunk stiffness." }],
              },
              {
                weekday: 6,
                sport: "running",
                title: "Easy run",
                objective: "Aerobic running for the 5K goal",
                durationMin: 40,
                intensity: "easy",
                importance: "key",
                recoveryHours: 24,
                why: "Running is the primary saved sport.",
                lowerBody: true,
                quality: false,
                zones: [],
                exercises: [],
              },
            ],
          }],
        },
        model: "gpt-4.1-mini",
      };
    },
  });
  assert.equal(repairs.length, 2);
  assert.match(repairs[1] ?? "", /Monday|strength/);
  assert.equal(resolved.source.generator, "chatgpt");
  const visible = resolved.plan.sessions.filter((session) => session.date >= runner.startDate && session.date <= "2026-10-23");
  assert.ok(visible.some((session) => session.sport === "running" && session.title === "Easy run"));
  assert.ok(visible.some((session) => session.sport === "strength" && session.title === "Strength support"));
  assert.equal(visible.some((session) => session.title === "Tempo run"), false);
});

test("fenced model JSON still parses", () => {
  const parsed = readModelJson("```json\n{\"name\":\"Plan\"}\n```");
  assert.deepEqual(parsed, { name: "Plan" });
});
