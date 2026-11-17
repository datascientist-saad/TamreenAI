import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recommendEventPriority } from "./priority";
import { evaluateEventCompatibility } from "./compatibility";
import { individualizeTaper, isInTaperWindow } from "./taper";
import { buildDatedEventPhases, currentPhaseForDate } from "./periodization";
import {
  applyEventDaysToSessions,
  buildEventDaySession,
  proposeEventDayReplacements,
  proposeTaperAdaptations,
} from "./adaptation";
import { buildPostEventRecovery } from "./recovery";
import { buildEventNutritionPlan } from "./nutrition";
import { analyzeEventResult } from "./results-analysis";
import { recalculateForEvent, adaptationsToProposedChanges } from "./recalculate";
import { toPlanningEvents } from "./multi-event";

const half = {
  id: "e1",
  name: "Doha Half",
  startsOn: "2027-03-14",
  priority: "primary" as const,
  discipline: "running",
  eventType: "running_half",
  distanceM: 21097.5,
  swimM: null,
  bikeM: null,
  runM: 21097.5,
  goalTimeSeconds: 5600,
  sports: ["running"] as Array<"running" | "cycling" | "swimming" | "strength">,
};

describe("event priority", () => {
  it("recommends practice for a short local race when an A event exists nearby", () => {
    const result = recommendEventPriority({
      distanceM: 5000,
      discipline: "running",
      templateSlug: "running_5k",
      eventDate: "2027-02-20",
      today: "2027-01-01",
      otherEvents: [{ startsOn: "2027-03-14", priority: "primary", distanceM: 21097.5, name: "Half" }],
    });
    assert.notEqual(result.recommended, "primary");
    assert.ok(result.factors.length > 0);
  });

  it("recommends primary for ironman 70.3 without a conflicting A event", () => {
    const result = recommendEventPriority({
      distanceM: 113000,
      swimM: 1900,
      bikeM: 90000,
      runM: 21100,
      discipline: "triathlon",
      templateSlug: "ironman_70_3",
      eventDate: "2027-06-01",
      today: "2027-01-01",
      otherEvents: [],
    });
    assert.equal(result.recommended, "primary");
    assert.equal(result.label, "A");
  });

  it("does not auto-promote every long race to A when another A is close", () => {
    const result = recommendEventPriority({
      distanceM: 42195,
      discipline: "running",
      templateSlug: "running_marathon",
      eventDate: "2027-03-01",
      today: "2027-01-01",
      otherEvents: [{ startsOn: "2027-03-20", priority: "primary", name: "70.3" }],
    });
    assert.equal(result.recommended, "secondary");
  });
});

describe("event compatibility", () => {
  it("marks same-day events as High Conflict", () => {
    const events = toPlanningEvents([
      { id: "a", name: "A", starts_on: "2027-04-01", priority: "primary", status: "active", discipline: "running", distance_m: 10000 },
      { id: "b", name: "B", starts_on: "2027-04-01", priority: "secondary", status: "active", discipline: "running", distance_m: 5000 },
    ], "2027-01-01");
    const report = evaluateEventCompatibility(events);
    assert.equal(report.status, "High Conflict");
    assert.ok(report.findings.some((f) => f.title.includes("Same-day")));
  });

  it("returns Compatible for well-spaced events", () => {
    const events = toPlanningEvents([
      { id: "a", name: "10K", starts_on: "2027-01-10", priority: "practice", status: "active", discipline: "running", distance_m: 10000 },
      { id: "b", name: "Half", starts_on: "2027-03-01", priority: "secondary", status: "active", discipline: "running", distance_m: 21000 },
      { id: "c", name: "70.3", starts_on: "2027-06-01", priority: "primary", status: "active", discipline: "triathlon", swim_m: 1900, bike_m: 90000, run_m: 21100 },
    ], "2026-12-01");
    const report = evaluateEventCompatibility(events);
    assert.equal(report.status, "Compatible");
  });
});

describe("taper engine", () => {
  it("keeps practice tapers minimal", () => {
    const taper = individualizeTaper({
      templateSlug: "running_half",
      discipline: "running",
      distanceM: 21097,
      priority: "practice",
      daysUntilEvent: 20,
    });
    assert.equal(taper.minimal, true);
    assert.ok(taper.taperDays <= 2);
  });

  it("individualizes half marathon taper inside guideline range", () => {
    const taper = individualizeTaper({
      templateSlug: "running_half",
      discipline: "running",
      distanceM: 21097,
      priority: "primary",
      daysUntilEvent: 40,
      readinessOverall: 70,
    });
    assert.ok(taper.taperDays >= 7 && taper.taperDays <= 14);
    assert.ok(isInTaperWindow("2027-03-10", "2027-03-14", taper.taperDays));
  });
});

describe("periodization", () => {
  it("does not compress months of prep into a few days", () => {
    const { phases } = buildDatedEventPhases({
      eventDate: "2027-03-16",
      today: "2027-03-14",
      templateSlug: "running_marathon",
      discipline: "running",
      distanceM: 42195,
      priority: "primary",
    });
    assert.ok(phases.some((p) => p.phase === "event"));
    assert.ok(phases.some((p) => p.phase === "taper"));
    assert.ok(!phases.some((p) => p.phase === "base"));
    const current = currentPhaseForDate(phases, "2027-03-14");
    assert.ok(current);
  });

  it("includes recovery and return after the event", () => {
    const { phases } = buildDatedEventPhases({
      eventDate: "2027-06-01",
      today: "2027-01-01",
      templateSlug: "ironman_70_3",
      discipline: "triathlon",
      distanceM: 113000,
      swimM: 1900,
      bikeM: 90000,
      runM: 21100,
      priority: "primary",
    });
    assert.ok(phases.some((p) => p.phase === "recovery"));
    assert.ok(phases.some((p) => p.phase === "return"));
  });
});

describe("event-day replacement", () => {
  it("builds an event session that replaces regular training", () => {
    const session = buildEventDaySession(half, "2027-03-14");
    assert.equal(session.isEventSession, true);
    assert.equal(session.intensity, "race");
    assert.equal(session.title, "Doha Half");
  });

  it("proposes removal of non-event workouts on event day", () => {
    const proposals = proposeEventDayReplacements(
      [
        { id: "w1", date: "2027-03-14", sport: "running", title: "Long run", durationMin: 90, intensity: "moderate", importance: "key", status: "planned" },
        { id: "w2", date: "2027-03-14", sport: "strength", title: "Lower body", durationMin: 60, intensity: "tempo", importance: "supporting", status: "planned", lowerBody: true },
      ],
      [half],
    );
    assert.ok(proposals.some((p) => p.adaptationType === "event_day_replace" && p.originalWorkoutId === "w1"));
    assert.ok(proposals.some((p) => p.proposed?.isEventSession));
  });

  it("applies event days into a session list without stacking regular work", () => {
    const base = [
      {
        date: "2027-03-14",
        sport: "running",
        title: "Long run",
        objective: "",
        durationMin: 90,
        intensity: "moderate",
        expectedLoad: 80,
        importance: "key",
        recoveryHours: 24,
        why: "long",
        lowerBody: true,
        quality: false,
        phase: "build",
        structure: {},
        zones: {},
        exercises: [],
      },
      {
        date: "2027-03-13",
        sport: "running",
        title: "Easy run",
        objective: "",
        durationMin: 40,
        intensity: "easy",
        expectedLoad: 30,
        importance: "supporting",
        recoveryHours: 12,
        why: "easy",
        lowerBody: true,
        quality: false,
        phase: "build",
        structure: {},
        zones: {},
        exercises: [],
      },
    ];
    const next = applyEventDaysToSessions(base, [half]);
    assert.equal(next.filter((s) => s.date === "2027-03-14").length, 1);
    assert.equal(next.find((s) => s.date === "2027-03-14")?.title, "Doha Half");
    assert.ok((next.find((s) => s.date === "2027-03-14")?.structure as { isEventSession?: boolean }).isEventSession);
  });

  it("never proposes changes to completed workouts", () => {
    const proposals = proposeEventDayReplacements(
      [{ id: "done", date: "2027-03-14", sport: "running", title: "Done", durationMin: 40, intensity: "easy", importance: "supporting", status: "completed" }],
      [half],
    );
    assert.ok(!proposals.some((p) => p.originalWorkoutId === "done"));
  });
});

describe("taper adaptations", () => {
  it("reduces hard sessions inside the taper window", () => {
    const proposals = proposeTaperAdaptations(
      [
        { id: "hard", date: "2027-03-10", sport: "running", title: "Intervals", durationMin: 70, intensity: "vo2", importance: "key", status: "planned", quality: true },
        { id: "strength", date: "2027-03-11", sport: "strength", title: "Heavy lower", durationMin: 60, intensity: "tempo", importance: "key", status: "planned", lowerBody: true },
      ],
      half,
      { templateSlug: "running_half" },
    );
    assert.ok(proposals.length >= 1);
    assert.ok(proposals.every((p) => p.originalWorkoutId !== null));
  });
});

describe("recovery engine", () => {
  it("extends recovery and seeks care for concerning symptoms", () => {
    const plan = buildPostEventRecovery(half, "2027-03-14", {
      completed: true,
      completionStatus: "finished",
      fatigueLevel: 5,
      painOrInjury: true,
      concerningSymptoms: ["chest_pain"],
    });
    assert.equal(plan.seekCare, true);
    assert.ok(plan.medicalGuidance.length > 20);
    assert.ok(plan.recoveryDays >= 7);
  });

  it("keeps recovery short for a low-fatigue practice race", () => {
    const practice = { ...half, priority: "practice" as const, distanceM: 5000, runM: 5000 };
    const plan = buildPostEventRecovery(practice, "2027-03-14", {
      completed: true,
      completionStatus: "finished",
      fatigueLevel: 2,
      difficulty: 3,
      readyToResume: true,
    });
    assert.ok(plan.recoveryDays <= 2);
    assert.equal(plan.seekCare, false);
  });
});

describe("event nutrition", () => {
  it("does not prescribe carb loading for every event", () => {
    const short = buildEventNutritionPlan({
      event: { ...half, distanceM: 5000, runM: 5000, priority: "practice" },
      phase: "taper",
      daysUntil: 2,
    });
    assert.equal(short.carbLoadingRecommended, false);
  });

  it("justifies carb loading for longer A endurance events near race week", () => {
    const plan = buildEventNutritionPlan({
      event: half,
      phase: "taper",
      daysUntil: 2,
    });
    assert.equal(plan.carbLoadingRecommended, true);
    assert.ok(plan.sections.some((s) => s.id === "during"));
  });
});

describe("results analysis", () => {
  it("separates measured values from estimates and avoids inventing FTP/VO2", () => {
    const analysis = analyzeEventResult(half, {
      targetTimeSeconds: 5600,
      finishTimeSeconds: 5750,
      actualDistanceM: 21097.5,
      completionStatus: "finished",
      perceivedExertion: 8,
    });
    assert.ok(analysis.measured.paceSecPerKm != null);
    assert.ok(analysis.trainingUpdates.some((u) => u.change.toLowerCase().includes("vo₂") || u.change.toLowerCase().includes("ftp")));
    assert.ok(analysis.comparisons.some((c) => c.kind === "measured"));
  });
});

describe("recalculation pipeline", () => {
  it("produces event-day adaptations and compatibility for create", () => {
    const result = recalculateForEvent({
      today: "2027-02-01",
      trigger: "event_create",
      athlete: { experienceLevel: "intermediate", readinessOverall: 72 },
      events: [half],
      subjectEventId: "e1",
      templateSlug: "running_half",
      upcomingWorkouts: [
        { id: "w1", date: "2027-03-14", sport: "running", title: "Long run", durationMin: 100, intensity: "moderate", importance: "key", status: "planned" },
        { id: "w2", date: "2027-03-10", sport: "running", title: "Intervals", durationMin: 70, intensity: "vo2", importance: "key", status: "planned", quality: true },
      ],
    });
    assert.ok(result.adaptations.length >= 1);
    assert.ok(result.phases.some((p) => p.phase === "event"));
    assert.ok(result.nutrition);
    const changes = adaptationsToProposedChanges(result.adaptations);
    assert.equal(changes.length, result.adaptations.length);
  });

  it("Scenario B: secondary races do not force High Conflict with a distant A event", () => {
    const events = toPlanningEvents([
      { id: "10k", name: "10K", starts_on: "2026-12-06", priority: "secondary", status: "active", discipline: "running", distance_m: 10000 },
      { id: "half", name: "Half", starts_on: "2027-01-17", priority: "secondary", status: "active", discipline: "running", distance_m: 21097 },
      { id: "im", name: "70.3", starts_on: "2027-03-14", priority: "primary", status: "active", discipline: "triathlon", swim_m: 1900, bike_m: 90000, run_m: 21100 },
    ], "2026-11-17");
    const report = evaluateEventCompatibility(events);
    assert.notEqual(report.status, "High Conflict");
  });
});
