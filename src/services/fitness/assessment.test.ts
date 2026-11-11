import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { continuousCalibrationNote, mergeHybrid, scoreBenchmarks, scoreSelfReport } from "./assessment";

describe("fitness assessment", () => {
  it("scores a partial self-report with reduced confidence", () => {
    const result = scoreSelfReport({
      experience: "intermediate",
      weeklyHours: 6,
      longestWorkoutMin: 90,
      runningCapability: "can run 45 min easy",
      swimmingCapability: null,
      cyclingCapability: null,
      strengthExperience: "2 years gym",
      limitations: [],
      raceResults: null,
    });
    assert.equal(result.level, 1);
    assert.ok(result.confidence < 0.7);
    assert.ok(result.missing.includes("Swimming capability"));
  });

  it("prefers submaximal benchmarks in the summary", () => {
    const result = scoreBenchmarks([
      { sport: "running", testSlug: "comfortable_30min", value: 30, unit: "min", isMaximal: false },
    ]);
    assert.match(result.summary, /submaximal/i);
  });

  it("merges hybrid assessment", () => {
    const self = scoreSelfReport({
      experience: "beginner",
      weeklyHours: null,
      longestWorkoutMin: null,
      runningCapability: null,
      swimmingCapability: null,
      cyclingCapability: null,
      strengthExperience: null,
      limitations: ["knee"],
      raceResults: null,
    });
    const bench = scoreBenchmarks([]);
    const hybrid = mergeHybrid(self, bench);
    assert.equal(hybrid.source, "derived");
    assert.ok(hybrid.missing.length > 0);
  });

  it("keeps continuous calibration provisional with few samples", () => {
    assert.ok(continuousCalibrationNote(2).confidence < continuousCalibrationNote(10).confidence);
  });
});
