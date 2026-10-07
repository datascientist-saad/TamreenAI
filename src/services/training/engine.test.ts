import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptMissedSession,
  answerCoach,
  analyzeRun,
  buildPlan,
  consistencyScore,
  findConflicts,
  hasSevereSymptom,
  optimizeWeek,
  overallScore,
  runningScore,
  scoreReadiness,
  sessionLoad,
  strengthExercises,
  strengthScore,
  swimmingScore,
  type AthleteContext,
  type PlannedSession,
} from "./engine";

const athlete: AthleteContext = {
  startDate: "2026-10-05",
  sports: ["strength", "running", "cycling", "swimming", "triathlon"],
  primaryGoal: "ironman_70_3",
  goals: ["ironman_70_3", "increase_strength"],
  experience: "intermediate",
  preferredDays: [1, 2, 3, 4, 5, 6],
  minutesPerDay: 75,
  gymAccess: true,
  poolAccess: true,
  bikeAccess: true,
  eventDate: "2027-03-01",
  eventName: "Ironman 70.3 Doha",
  avoidExercises: [],
  currentInjuryAreas: [],
  redFlag: false,
  weightKg: 78,
  sex: "male",
  reported: { tenKSeconds: 50 * 60, ftpWatts: 240, squatKg: 120, benchKg: 85, deadliftKg: 150 },
};

function session(partial: Partial<PlannedSession> & Pick<PlannedSession, "date" | "title" | "sport">): PlannedSession {
  return {
    objective: "",
    durationMin: 50,
    intensity: "moderate",
    expectedLoad: 40,
    importance: "supporting",
    recoveryHours: 24,
    why: "",
    lowerBody: false,
    quality: false,
    phase: "build",
    structure: {},
    zones: {},
    exercises: [],
    ...partial,
  };
}

test("load treats swimming as cardiovascular work with less musculoskeletal cost", () => {
  const run = sessionLoad(60, "threshold", "running");
  const swim = sessionLoad(60, "threshold", "swimming");
  assert.ok(swim < run);
});

test("hybrid plan includes several sports and explains the event", () => {
  const plan = buildPlan(athlete);
  const sports = new Set(plan.sessions.map((item) => item.sport));
  assert.ok(sports.has("running"));
  assert.ok(sports.has("cycling") || sports.has("brick"));
  assert.ok(sports.has("swimming"));
  assert.ok(sports.has("strength"));
  assert.match(plan.explanation, /Ironman 70.3 Doha/);
  assert.ok(plan.blocks.length >= 2);
});

test("strength for runners explains the single-leg hinge", () => {
  const exercises = strengthExercises(athlete, true, "build", 0);
  const rdl = exercises.find((exercise) => exercise.slug === "single_leg_rdl");
  assert.ok(rdl);
  assert.match(rdl.why, /running/i);
});

test("heavy lower body before intervals is a conflict", () => {
  const findings = findConflicts([
    session({
      date: "2026-10-06",
      title: "Lower-body strength",
      sport: "strength",
      lowerBody: true,
      intensity: "moderate",
    }),
    session({
      date: "2026-10-07",
      title: "VO2 max intervals",
      sport: "running",
      intensity: "vo2",
      quality: true,
      lowerBody: true,
      importance: "key",
    }),
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.severity, "high");
  assert.match(findings[0]?.explanation ?? "", /lower-body/i);
});

test("a brick is not flagged as an accidental run-bike conflict", () => {
  const findings = findConflicts([
    session({ date: "2026-10-10", title: "Endurance ride", sport: "cycling", quality: true, intensity: "tempo" }),
    session({ date: "2026-10-10", title: "Bike-to-run brick", sport: "brick", quality: true, intensity: "moderate" }),
  ]);
  assert.equal(findings.length, 0);
});

test("optimizer separates squat day from interval day", () => {
  const original = [
    session({
      date: "2026-10-06",
      title: "Lower-body strength",
      sport: "strength",
      lowerBody: true,
      importance: "supporting",
    }),
    session({
      date: "2026-10-07",
      title: "VO2 max intervals",
      sport: "running",
      intensity: "vo2",
      quality: true,
      lowerBody: true,
      importance: "key",
    }),
  ];
  const result = optimizeWeek(athlete, original);
  const squat = result.sessions.find((item) => item.title === "Lower-body strength");
  const intervals = result.sessions.find((item) => item.title === "VO2 max intervals");
  assert.ok(squat && intervals);
  const gap = Math.abs(Date.parse(squat.date) - Date.parse(intervals.date)) / 86_400_000;
  assert.ok(gap >= 2);
});

test("missed long run is not pasted onto lower-body day", () => {
  const missed = session({
    date: "2026-10-10",
    title: "Long run",
    sport: "running",
    durationMin: 90,
    intensity: "easy",
    lowerBody: true,
    importance: "key",
  });
  const upcoming = [
    session({ date: "2026-10-11", title: "Lower-body strength", sport: "strength", lowerBody: true }),
    session({ date: "2026-10-12", title: "Upper-body strength", sport: "strength" }),
    session({ date: "2026-10-13", title: "VO2 max intervals", sport: "running", quality: true, intensity: "vo2" }),
  ];
  const adaptation = adaptMissedSession(missed, upcoming, true);
  assert.match(adaptation.body, /full session/);
  const sunday = adaptation.changes.find((change) => change.date === "2026-10-11");
  assert.equal(sunday?.title, "Easy aerobic run");
  assert.ok((sunday?.durationMin ?? 100) < 90);
});

test("severe symptoms block training and do not invent a readiness score", () => {
  assert.equal(hasSevereSymptom(["chest_pain"]), true);
  const readiness = scoreReadiness({
    sleepHours: 8,
    sleepQuality: 5,
    soreness: 1,
    fatigue: 1,
    motivation: 5,
    stress: 1,
    hrv: 70,
    hrvBaseline: 68,
    severeSymptoms: ["chest_pain"],
    acuteLoad: 100,
    chronicLoad: 100,
    lowerBodyLoad48h: 10,
    hardEnduranceLoad48h: 10,
  });
  assert.equal(readiness.blockedForSafety, true);
  assert.equal(readiness.overall, null);
  assert.equal(readiness.trainRecommendation, "seek_care");
});

test("scores are explained and omitted without inputs", () => {
  assert.equal(strengthScore({ sex: "male", weightKg: null, squatKg: 100, benchKg: 80, deadliftKg: 140 }), null);
  const strength = strengthScore({ sex: "male", weightKg: 80, squatKg: 120, benchKg: 80, deadliftKg: 160 });
  assert.ok(strength);
  assert.match(strength.explanation, /body weight/);
  assert.equal(runningScore(null, 300), null);
  const running = runningScore(312, 300);
  assert.ok(running && running.score < 88);
  assert.equal(swimmingScore(null), null);
  const consistency = consistencyScore(0, 0);
  assert.equal(consistency, null);
  const overall = overallScore(
    [strength!, running!].filter(Boolean),
    "ironman_70_3",
  );
  assert.ok(overall);
  assert.match(overall.explanation, /left out|weighted/i);
});

test("run analysis does not score missing splits or heart rate", () => {
  const analyzed = analyzeRun({
    distanceM: 10000,
    durationSeconds: 3120,
    splitsSecPerKm: [],
    hrStart: null,
    hrEnd: null,
  });
  assert.equal(analyzed.consistency, null);
  assert.equal(analyzed.aerobicEfficiency, null);
  assert.match(analyzed.insight, /not scored/);
});

test("coach does not silently change the plan", () => {
  const answer = answerCoach({
    name: "Saad",
    primaryGoal: "ironman_70_3",
    today: session({
      date: "2026-10-07",
      title: "VO2 max intervals",
      sport: "running",
      quality: true,
      intensity: "vo2",
      why: "Quality run.",
    }),
    readiness: scoreReadiness({
      sleepHours: 5.5,
      sleepQuality: 2,
      soreness: 4,
      fatigue: 4,
      motivation: 2,
      stress: 4,
      hrv: null,
      hrvBaseline: null,
      severeSymptoms: [],
      acuteLoad: 400,
      chronicLoad: 220,
      lowerBodyLoad48h: 180,
      hardEnduranceLoad48h: 160,
    }),
    conflicts: [],
    recentMiss: null,
    eventName: "Ironman 70.3 Doha",
    daysToEvent: 146,
    consistency: consistencyScore(8, 10),
    question: "Should I run today?",
  });
  assert.equal(answer.requiresAcceptance, true);
  assert.equal(answer.safety, false);
  assert.ok(answer.proposedChanges.length > 0);
});
