import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyDate,
  dayBeforeEvent,
  detectScheduleOverlaps,
  isSportAllowedOnDate,
  localDateFromStart,
  allowedSportsDuringTaper,
} from "./policy";
import { applyEventDaysToSessions, proposeTaperAdaptations } from "./adaptation";
import {
  buildRaceDayTimeline,
  buildRacePrepSnapshot,
  computeKitProgress,
  formatLocalStartTime,
  formatRaceCountdown,
  resolveRacePrepPhase,
} from "./race-prep";

const race15k = {
  id: "r1",
  name: "Saturday 15K",
  startsOn: "2027-04-10",
  priority: "primary" as const,
  discipline: "running",
  distanceM: 15000,
  sports: ["running"] as Array<"running" | "cycling" | "swimming" | "strength">,
  templateSlug: "running_10k",
};

describe("event scheduling policy", () => {
  it("marks the day before every race as recovery-only", () => {
    const friday = dayBeforeEvent(race15k);
    assert.equal(friday, "2027-04-09");
    const protection = classifyDate(friday, [race15k]);
    assert.equal(protection.role, "recovery_only");
    assert.deepEqual(protection.allowedSports, ["recovery", "mobility"]);
    assert.equal(protection.suppressReminders, true);
  });

  it("reserves race day for the event and suppresses reminders", () => {
    const protection = classifyDate("2027-04-10", [race15k]);
    assert.equal(protection.role, "event");
    assert.equal(protection.suppressReminders, true);
  });

  it("pauses unrelated sports during a priority running taper", () => {
    const allowed = allowedSportsDuringTaper(race15k);
    assert.ok(allowed.includes("running"));
    assert.ok(allowed.includes("recovery"));
    assert.ok(!allowed.includes("cycling"));
    assert.ok(!allowed.includes("swimming"));
    assert.ok(!allowed.includes("strength"));
    assert.equal(isSportAllowedOnDate("cycling", "2027-04-06", race15k, 7), false);
    assert.equal(isSportAllowedOnDate("running", "2027-04-06", race15k, 7), true);
  });

  it("applies recovery day and event day into plan sessions", () => {
    const sessions = [
      {
        date: "2027-04-09",
        sport: "strength",
        title: "Friday strength",
        objective: "",
        durationMin: 60,
        intensity: "tempo",
        expectedLoad: 50,
        importance: "key",
        recoveryHours: 24,
        why: "strength",
        lowerBody: true,
        quality: true,
        phase: "build",
        structure: {},
        zones: {},
        exercises: [],
      },
      {
        date: "2027-04-10",
        sport: "cycling",
        title: "Saturday ride",
        objective: "",
        durationMin: 75,
        intensity: "moderate",
        expectedLoad: 60,
        importance: "key",
        recoveryHours: 24,
        why: "ride",
        lowerBody: true,
        quality: false,
        phase: "build",
        structure: {},
        zones: {},
        exercises: [],
      },
    ];
    const next = applyEventDaysToSessions(sessions, [race15k]);
    assert.ok(next.some((row) => row.date === "2027-04-09" && row.sport === "recovery"));
    assert.ok(!next.some((row) => row.date === "2027-04-09" && row.sport === "strength"));
    assert.equal(next.filter((row) => row.date === "2027-04-10").length, 1);
    assert.equal(next.find((row) => row.date === "2027-04-10")?.title, "Saturday 15K");
  });

  it("proposes pausing unrelated taper sessions and recovery-day replacements", () => {
    const proposals = proposeTaperAdaptations(
      [
        { id: "s1", date: "2027-04-09", sport: "strength", title: "Lower", durationMin: 55, intensity: "tempo", importance: "key", status: "planned", lowerBody: true },
        { id: "c1", date: "2027-04-07", sport: "cycling", title: "Ride", durationMin: 60, intensity: "moderate", importance: "supporting", status: "planned" },
        { id: "r1", date: "2027-04-06", sport: "running", title: "Easy", durationMin: 40, intensity: "easy", importance: "supporting", status: "planned" },
      ],
      race15k,
      { templateSlug: "running_10k" },
    );
    assert.ok(proposals.some((row) => row.idempotencyKey.startsWith("recovery-day:") && row.originalWorkoutId === "s1"));
    assert.ok(proposals.some((row) => row.adaptationType === "remove" && row.originalWorkoutId === "c1"));
  });

  it("detects same-day and recovery-overlap conflicts", () => {
    const findings = detectScheduleOverlaps([
      race15k,
      { ...race15k, id: "r2", name: "Other 10K", startsOn: "2027-04-10", priority: "secondary" },
    ]);
    assert.ok(findings.some((row) => row.title.includes("Same-day")));
  });

  it("derives local calendar date from starts_at + timezone", () => {
    // 2027-04-10 22:00 UTC is still April 10 in Qatar (UTC+3) → April 11 01:00
    const local = localDateFromStart("2027-04-10T22:00:00.000Z", "2027-04-10", "Asia/Qatar");
    assert.equal(local, "2027-04-11");
  });
});

describe("race prep timing", () => {
  it("does not invent timeline times when start is unknown", () => {
    const timeline = buildRaceDayTimeline({ startsAt: null });
    assert.ok(timeline.every((item) => item.at == null || item.id === "add_start"));
    assert.ok(timeline.some((item) => item.action === "Add start time"));
  });

  it("rebuilds meal and travel anchors when start moves to evening", () => {
    const morning = buildRaceDayTimeline({
      startsAt: "2027-04-10T06:00:00.000Z",
      timeZone: "UTC",
      travelMinutes: 30,
      arrivalBufferMin: 45,
    });
    const evening = buildRaceDayTimeline({
      startsAt: "2027-04-10T19:00:00.000Z",
      timeZone: "UTC",
      travelMinutes: 30,
      arrivalBufferMin: 45,
    });
    assert.ok(evening.some((item) => item.id === "lunch"));
    assert.ok(!morning.some((item) => item.id === "lunch"));
    const breakfastMorning = morning.find((item) => item.id === "breakfast")?.at;
    const breakfastEvening = evening.find((item) => item.id === "breakfast")?.at;
    assert.ok(breakfastMorning && breakfastEvening);
    assert.notEqual(breakfastMorning, breakfastEvening);
    const timed = morning.filter((item) => item.at);
    for (let i = 1; i < timed.length; i += 1) {
      assert.ok(Date.parse(timed[i - 1]!.at!) <= Date.parse(timed[i]!.at!));
    }
  });

  it("preserves completed checklist items across phase changes", () => {
    const snap = buildRacePrepSnapshot({
      event: { ...race15k, startsAt: "2027-04-10T19:00:00.000Z", timezone: "UTC" },
      today: "2027-04-10",
      checklist: [
        { id: "collect_bib", label: "Collect bib", section: "prepare", done: true, doneAt: "2027-04-08T10:00:00.000Z" },
        { id: "pack_kit", label: "Pack kit", section: "prepare", done: false },
      ],
    });
    assert.equal(snap.phase, "race_day");
    assert.equal(snap.checklist.find((item) => item.id === "collect_bib")?.done, true);
  });

  it("maps phases for before / day-before / race day / after", () => {
    assert.equal(resolveRacePrepPhase({ today: "2027-04-01", eventDate: "2027-04-10", hasResult: false, hasRecoveryCheckIn: false }), "prepare");
    assert.equal(resolveRacePrepPhase({ today: "2027-04-09", eventDate: "2027-04-10", hasResult: false, hasRecoveryCheckIn: false }), "fuel");
    assert.equal(resolveRacePrepPhase({ today: "2027-04-10", eventDate: "2027-04-10", hasResult: false, hasRecoveryCheckIn: false }), "race_day");
    assert.equal(resolveRacePrepPhase({ today: "2027-04-11", eventDate: "2027-04-10", hasResult: false, hasRecoveryCheckIn: false }), "result");
  });

  it("formats local start and countdown for a 6:00 a.m. Doha 15K", () => {
    const startsAt = "2027-04-10T03:00:00.000Z"; // 6:00 a.m. Asia/Qatar
    const label = formatLocalStartTime(startsAt, "Asia/Qatar");
    assert.match(label ?? "", /Sat,\s*6:00\s*a\.m\./i);

    const far = formatRaceCountdown({
      startsAt,
      eventDate: "2027-04-10",
      timeZone: "Asia/Qatar",
      now: new Date("2027-04-08T03:00:00.000Z"),
    });
    assert.equal(far.label, "2 days left");
    assert.equal(far.within24h, false);

    const near = formatRaceCountdown({
      startsAt,
      eventDate: "2027-04-10",
      timeZone: "Asia/Qatar",
      now: new Date("2027-04-09T20:00:00.000Z"),
    });
    assert.equal(near.within24h, true);
    assert.match(near.label, /\d+h|\d+ min/);

    const missing = formatRaceCountdown({
      startsAt: null,
      eventDate: "2027-04-10",
      timeZone: "Asia/Qatar",
      now: new Date("2027-04-08T12:00:00.000Z"),
    });
    assert.equal(missing.label, "2 days left");
  });

  it("tracks kit packing as N of 5 and advances next task", () => {
    const snap = buildRacePrepSnapshot({
      event: {
        ...race15k,
        name: "Doha 15K",
        startsAt: "2027-04-10T03:00:00.000Z",
        timezone: "Asia/Qatar",
      },
      today: "2027-04-08",
      checklist: [
        { id: "collect_bib", label: "Collect bib", section: "prepare", done: true },
        { id: "confirm_transport", label: "Confirm transport", section: "prepare", done: true },
        { id: "pack_kit", label: "Pack kit", section: "prepare", done: true },
        { id: "choose_breakfast", label: "Choose race breakfast", section: "fuel", done: false },
        { id: "pack_fuel", label: "Pack fuel", section: "fuel", done: false },
      ],
    });
    assert.equal(snap.kitProgress.done, 3);
    assert.equal(snap.kitProgress.total, 5);
    assert.equal(snap.kitProgress.label, "3 of 5 packed");
    assert.equal(snap.kitProgress.next?.id, "pack_fuel");
    assert.match(snap.countdownLabel, /days left/);
    assert.match(snap.startLabel ?? "", /a\.m\./i);

    const four = computeKitProgress(
      snap.checklist.map((item) => (item.id === "pack_fuel" ? { ...item, done: true } : item)),
    );
    assert.equal(four.done, 4);
    assert.equal(four.label, "4 of 5 packed");
    assert.equal(four.next?.id, "choose_breakfast");

    const ready = computeKitProgress(
      snap.checklist.map((item) =>
        item.id === "choose_breakfast" || item.id === "pack_fuel" ? { ...item, done: true } : item,
      ),
    );
    assert.equal(ready.done, 5);
    assert.equal(ready.label, "Kit ready");
    assert.equal(ready.ready, true);
    assert.equal(ready.next, null);
  });

  it("rebuilds countdown when wave moves to evening while keeping kit done", () => {
    const morning = buildRacePrepSnapshot({
      event: { ...race15k, startsAt: "2027-04-10T03:00:00.000Z", timezone: "Asia/Qatar" },
      today: "2027-04-10",
      checklist: [
        { id: "collect_bib", label: "Collect bib", section: "prepare", done: true },
        { id: "pack_kit", label: "Pack kit", section: "prepare", done: true },
        { id: "pack_fuel", label: "Pack fuel", section: "fuel", done: true },
      ],
    });
    const evening = buildRacePrepSnapshot({
      event: { ...race15k, startsAt: "2027-04-10T16:00:00.000Z", timezone: "Asia/Qatar" },
      today: "2027-04-10",
      checklist: morning.checklist,
    });
    assert.equal(evening.checklist.find((item) => item.id === "collect_bib")?.done, true);
    assert.equal(evening.checklist.find((item) => item.id === "pack_fuel")?.done, true);
    assert.ok(evening.timeline.some((item) => item.id === "lunch"));
    assert.notEqual(morning.startTimeLabel, evening.startTimeLabel);
  });
});
