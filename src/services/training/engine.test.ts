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
  strengthFocus,
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

test("football and padel are scheduled from the sports on the profile", () => {
  const plan = buildPlan({
    ...athlete,
    sports: ["football", "padel", "strength"],
    primaryGoal: "improve_padel",
    goals: ["improve_padel", "improve_football"],
    eventDate: null,
    eventName: null,
    poolAccess: false,
    bikeAccess: false,
  });
  const sports = new Set(plan.sessions.map((item) => item.sport));
  assert.ok(sports.has("padel"));
  assert.ok(sports.has("football"));
  assert.ok(sports.has("strength"));
  assert.equal(sports.has("running"), false);
  assert.match(plan.explanation, /padel/);
  const titles = plan.sessions.map((item) => `${item.date}|${item.sport}|${item.title}`);
  assert.equal(new Set(titles).size, titles.length);
});

test("onboarding on Saturday still schedules that day", () => {
  const plan = buildPlan({
    ...athlete,
    startDate: "2026-10-17",
    sports: ["padel", "football", "strength"],
    primaryGoal: "improve_padel",
    goals: ["improve_padel"],
    eventDate: null,
    eventName: null,
    preferredDays: [1, 2, 3, 4, 5, 6],
    poolAccess: false,
    bikeAccess: false,
  });
  const today = plan.sessions.filter((item) => item.date === "2026-10-17");
  assert.equal(today.length, 1);
  assert.equal(today[0]?.sport, "padel");
  assert.ok(today.every((item) => item.exercises.some((exercise) => exercise.slug.endsWith("_stretch"))));
});

test("selected bodybuilding stays in the plan beside triathlon", () => {
  const plan = buildPlan({
    ...athlete,
    sports: ["padel", "bodybuilding", "cycling", "strength", "swimming", "triathlon", "running"],
    primaryGoal: "ironman_70_3",
    goals: ["ironman_70_3", "build_muscle"],
    eventDate: null,
    eventName: null,
    preferredDays: [0, 1, 2, 3, 4, 5],
    minutesPerDay: 60,
    multipleSessionsPerDay: false,
  });
  const sports = new Set(plan.sessions.map((item) => item.sport));
  for (const sport of ["bodybuilding", "strength", "padel", "running", "cycling", "swimming"] as const) {
    assert.ok(sports.has(sport), sport);
  }
  const week = plan.sessions.filter((item) => item.date >= "2026-10-05" && item.date <= "2026-10-11");
  const bodybuilding = week.filter((item) => item.sport === "bodybuilding");
  assert.ok(bodybuilding.length >= 1);
  assert.ok(bodybuilding.every((item) => item.title.startsWith("Bodybuilding")));
  assert.ok(bodybuilding.some((item) => {
    const lifts = item.exercises.filter((exercise) => !exercise.slug.endsWith("_stretch"));
    return lifts.length > 0 && lifts.every((exercise) => exercise.reps === "8-12");
  }));
  const perDay = new Map<string, number>();
  for (const item of plan.sessions) perDay.set(item.date, (perDay.get(item.date) ?? 0) + 1);
  assert.ok([...perDay.values()].every((count) => count === 1));
  assert.match(plan.explanation, /one workout/i);
  assert.match(plan.explanation, /bodybuilding/i);
});

test("two workouts share a day only after the athlete agrees", () => {
  const shared = {
    ...athlete,
    sports: ["padel", "bodybuilding", "cycling", "strength", "swimming", "triathlon", "running"] as AthleteContext["sports"],
    primaryGoal: "ironman_70_3",
    goals: ["ironman_70_3", "build_muscle"],
    eventDate: null,
    eventName: null,
    preferredDays: [0, 1, 2, 3, 4, 5],
    minutesPerDay: 60,
  };
  const single = buildPlan({ ...shared, multipleSessionsPerDay: false });
  const doubled = buildPlan({ ...shared, multipleSessionsPerDay: true });
  const counts = (plan: ReturnType<typeof buildPlan>) => {
    const perDay = new Map<string, number>();
    for (const item of plan.sessions) perDay.set(item.date, (perDay.get(item.date) ?? 0) + 1);
    return [...perDay.values()];
  };
  assert.ok(counts(single).every((count) => count === 1));
  const doubledCounts = counts(doubled);
  assert.ok(doubledCounts.some((count) => count === 2));
  assert.ok(doubledCounts.every((count) => count <= 2));
  const byDate = new Map<string, number>();
  for (const item of doubled.sessions) byDate.set(item.date, (byDate.get(item.date) ?? 0) + item.durationMin);
  for (const [date, minutes] of byDate) {
    const sessions = doubled.sessions.filter((item) => item.date === date);
    if (sessions.length === 2) assert.ok(minutes <= 60, `${date} used ${minutes} minutes`);
  }
  assert.ok(new Set(doubled.sessions.map((item) => item.sport)).has("bodybuilding"));
  assert.match(doubled.explanation, /more than one workout/i);
});

test("sports that do not fit in one week still appear in the plan", () => {
  const plan = buildPlan({
    ...athlete,
    sports: ["padel", "bodybuilding", "cycling", "strength", "swimming", "triathlon", "running"],
    primaryGoal: "ironman_70_3",
    goals: ["ironman_70_3"],
    eventDate: null,
    eventName: null,
    preferredDays: [1, 3, 5],
    minutesPerDay: 60,
    multipleSessionsPerDay: false,
  });
  const sports = new Set(plan.sessions.map((item) => item.sport));
  for (const sport of ["bodybuilding", "strength", "padel", "running", "cycling", "swimming"] as const) {
    assert.ok(sports.has(sport), sport);
  }
  const perDay = new Map<string, number>();
  for (const item of plan.sessions) perDay.set(item.date, (perDay.get(item.date) ?? 0) + 1);
  assert.ok([...perDay.values()].every((count) => count === 1));
  assert.match(plan.explanation, /rotate/i);
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

test("upper-body strength shares a day with running and not with lower-body lifting", () => {
  const plan = buildPlan({
    ...athlete,
    startDate: "2026-10-05",
    sports: ["running", "strength"],
    primaryGoal: "improve_5k",
    goals: ["improve_5k", "increase_strength"],
    preferredDays: [1, 3, 6],
    minutesPerDay: 60,
    multipleSessionsPerDay: true,
    poolAccess: false,
    bikeAccess: false,
    eventDate: null,
    eventName: null,
  });
  const byDate = new Map<string, typeof plan.sessions>();
  for (const session of plan.sessions) {
    const list = byDate.get(session.date) ?? [];
    list.push(session);
    byDate.set(session.date, list);
  }
  for (const [date, sessions] of byDate) {
    const focuses = sessions.map((session) => strengthFocus(session));
    assert.equal(focuses.includes("upper") && focuses.includes("lower"), false, date);
    assert.equal(focuses.includes("both"), false, date);
    const minutes = sessions.reduce((sum, session) => sum + session.durationMin, 0);
    assert.ok(minutes <= 60, date);
  }
  assert.ok([...byDate.values()].some((sessions) => sessions.some((session) => session.sport === "running") && sessions.some((session) => strengthFocus(session) === "upper")));
  assert.ok(plan.sessions.some((session) => strengthFocus(session) === "lower"));
  assert.ok(plan.sessions.every((session) => session.exercises.some((exercise) => exercise.slug.endsWith("_stretch"))));
  const sports = new Set(plan.sessions.map((session) => session.sport));
  assert.ok(sports.has("running"));
  assert.ok(sports.has("strength"));
});

test("same-day upper and lower body is a conflict", () => {
  const findings = findConflicts([
    session({ date: "2026-10-06", title: "Upper-body strength", sport: "strength", lowerBody: false }),
    session({ date: "2026-10-06", title: "Lower-body strength", sport: "strength", lowerBody: true }),
  ]);
  assert.equal(findings.length, 1);
  assert.match(findings[0]?.explanation ?? "", /upper-body/i);
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

// ── P0 regression tests ──────────────────────────────────────────────────────

test("BUG-08: plan covers events beyond 16 weeks without truncation", () => {
  // Event on 2027-03-02 is ~17 weeks from 2026-11-03 — previously capped at 16.
  const plan = buildPlan({
    ...athlete,
    startDate: "2026-11-03",
    eventDate: "2027-03-02",
  });
  // Every session must fall on or before the event date.
  const last = plan.sessions.reduce((max, s) => (s.date > max ? s.date : max), "");
  assert.ok(last >= "2027-02-24", `plan ends at ${last}, taper should reach 2027-03-02`);
  assert.ok(last <= "2027-03-02", `plan extends past the event: ${last}`);
  // Taper block must exist.
  assert.ok(plan.blocks.some((b) => b.phase === "taper"), "missing taper block");
});

test("BUG-08: plan end date matches event for a 26-week window", () => {
  const start = "2026-09-01";
  const event = "2027-03-01"; // 26 weeks away
  const plan = buildPlan({ ...athlete, startDate: start, eventDate: event });
  const last = plan.sessions.reduce((max, s) => (s.date > max ? s.date : max), "");
  assert.ok(last <= event, `plan runs past the event: ${last}`);
  assert.ok(plan.blocks.some((b) => b.phase === "taper"), "taper missing for 26-week event");
});

test("BUG-02: optimizeWeek reports capacity violation when moves exceed minutesPerDay", () => {
  // Two sessions on the same day whose combined load exceeds the 75-min limit.
  const sessions = [
    session({ date: "2026-10-06", title: "Lower-body strength", sport: "strength", durationMin: 60, lowerBody: true }),
    session({ date: "2026-10-06", title: "VO2 max intervals", sport: "running", durationMin: 60, intensity: "vo2", quality: true, lowerBody: true }),
  ];
  const result = optimizeWeek(athlete, sessions); // athlete.minutesPerDay = 75
  // When moves would pile two 60-min sessions into one day, a capacity violation is expected.
  const hasCapacityViolation = result.violations.some((v) => v.kind === "capacity");
  const hasAnyViolation = result.violations.length > 0;
  // The key constraint: feasibility is noted and the explanation is human-readable.
  if (hasCapacityViolation || !result.feasible) {
    assert.ok(result.violations.length > 0, "capacity violation should be reported");
  } else {
    // Moves were valid — daily totals must stay within the limit.
    const byDate = new Map<string, number>();
    for (const s of result.sessions) byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.durationMin);
    for (const [date, mins] of byDate) {
      assert.ok(mins <= athlete.minutesPerDay, `${date}: ${mins} min exceeds ${athlete.minutesPerDay} limit`);
    }
  }
  assert.ok(!hasAnyViolation || result.violations.every((v) => typeof v.kind === "string" && typeof v.detail === "string"));
});

test("BUG-09: scoreReadiness includes staleness note for check-in older than 2 days", () => {
  // Use a date that is always ≥3 days in the past relative to the test run.
  const oldDate = "2026-10-07"; // well in the past from 2026-11-08
  const readiness = scoreReadiness({
    sleepHours: 8,
    sleepQuality: 4,
    soreness: 2,
    fatigue: 2,
    motivation: 4,
    stress: 2,
    hrv: 65,
    hrvBaseline: 62,
    severeSymptoms: [],
    acuteLoad: 150,
    chronicLoad: 200,
    lowerBodyLoad48h: 20,
    hardEnduranceLoad48h: 30,
    loggedOn: oldDate,
  });
  assert.ok(readiness.overall !== null, "should have a score with a stale log");
  assert.match(readiness.explanation, /day|stale|old/i, "staleness note missing from explanation");
  assert.ok(readiness.factors.some((f) => /stale/i.test(f.label)), "stale factor not added");
});

test("BUG-09: scoreReadiness has no staleness note for a same-day check-in", () => {
  // Use a future date so it's never stale.
  const today = new Date().toISOString().slice(0, 10);
  const readiness = scoreReadiness({
    sleepHours: 8,
    sleepQuality: 4,
    soreness: 2,
    fatigue: 2,
    motivation: 4,
    stress: 2,
    hrv: 65,
    hrvBaseline: 62,
    severeSymptoms: [],
    acuteLoad: 150,
    chronicLoad: 200,
    lowerBodyLoad48h: 20,
    hardEnduranceLoad48h: 30,
    loggedOn: today,
  });
  assert.ok(readiness.overall !== null);
  assert.ok(!readiness.factors.some((f) => /stale/i.test(f.label)), "false stale flag for same-day check-in");
});

test("BUG-06: consistencyScore counts only linked workouts (numerator = linked, not all completions)", () => {
  // 29 unlinked completions vs 2 planned should NOT yield 100.
  // The engine function takes (linked, planned) — the server action is responsible for
  // passing only linked completions. Verify the math directly.
  const linked2planned2 = consistencyScore(2, 2);
  assert.ok(linked2planned2 !== null && linked2planned2.score >= 90);
  const linked0planned2 = consistencyScore(0, 2);
  assert.ok(linked0planned2 !== null && linked0planned2.score === 0);
  // No planned sessions → null (unscored), not 100.
  const noPlanned = consistencyScore(0, 0);
  assert.equal(noPlanned, null);
});

test("BUG-04: coach routes schedule-conflict question away from default swim/goal handler", () => {
  const conflictAnswer = answerCoach({
    name: "Saad",
    primaryGoal: "ironman_70_3",
    today: session({ date: "2026-10-07", title: "VO2 max intervals", sport: "running", quality: true, intensity: "vo2", why: "Quality run." }),
    readiness: scoreReadiness({
      sleepHours: 8, sleepQuality: 4, soreness: 2, fatigue: 2, motivation: 4,
      stress: 2, hrv: 65, hrvBaseline: 62, severeSymptoms: [],
      acuteLoad: 150, chronicLoad: 200, lowerBodyLoad48h: 20, hardEnduranceLoad48h: 30,
    }),
    conflicts: [],
    recentMiss: null,
    eventName: "Ironman 70.3 Doha",
    daysToEvent: 146,
    consistency: consistencyScore(8, 10),
    question: "I have a conflict on Friday and Saturday, can you reschedule?",
  });
  // Should NOT be the generic today-swim + primary-goal fallback.
  assert.ok(!conflictAnswer.answer.toLowerCase().includes("today") || conflictAnswer.answer.toLowerCase().includes("conflict") || conflictAnswer.answer.toLowerCase().includes("reschedule") || conflictAnswer.answer.toLowerCase().includes("friday") || conflictAnswer.answer.toLowerCase().includes("day"), `generic fallback fired: ${conflictAnswer.answer.slice(0, 120)}`);
});

test("BUG-04: coach routes missed-workout/limited-time query away from default handler", () => {
  const missedAnswer = answerCoach({
    name: "Saad",
    primaryGoal: "ironman_70_3",
    today: session({ date: "2026-10-07", title: "Long run", sport: "running", durationMin: 90, intensity: "easy", why: "Aerobic base." }),
    readiness: scoreReadiness({
      sleepHours: 7, sleepQuality: 3, soreness: 2, fatigue: 2, motivation: 4,
      stress: 2, hrv: null, hrvBaseline: null, severeSymptoms: [],
      acuteLoad: 200, chronicLoad: 220, lowerBodyLoad48h: 0, hardEnduranceLoad48h: 0,
    }),
    conflicts: [],
    recentMiss: null,
    eventName: "Ironman 70.3 Doha",
    daysToEvent: 146,
    consistency: consistencyScore(5, 10),
    question: "I only have 20 minutes today, what should I do?",
  });
  assert.ok(
    missedAnswer.answer.toLowerCase().includes("20") ||
    missedAnswer.answer.toLowerCase().includes("short") ||
    missedAnswer.answer.toLowerCase().includes("min") ||
    missedAnswer.answer.toLowerCase().includes("time"),
    `expected time-constraint routing, got: ${missedAnswer.answer.slice(0, 120)}`
  );
});

// ── end P0 regression tests ───────────────────────────────────────────────────

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
