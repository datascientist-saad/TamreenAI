import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWeeklyReview } from "./review";

describe("weekly review", () => {
  it("requires approval for major load changes", () => {
    const review = buildWeeklyReview({
      planned: 6,
      completed: 6,
      missed: 0,
      skipped: 0,
      loadPlanned: 400,
      loadCompleted: 410,
      avgFatigue: 2,
      avgSleep: 7.5,
      nutritionAdherence: 0.8,
      sports: [{ sport: "running", minutes: 120 }],
      upcomingEvent: null,
    });
    assert.ok(review.proposedAdjustments.some((row) => row.title.includes("progression") && row.requiresApproval));
  });

  it("does not invent nutrition adherence", () => {
    const review = buildWeeklyReview({
      planned: 4,
      completed: 2,
      missed: 2,
      skipped: 0,
      loadPlanned: 200,
      loadCompleted: 100,
      avgFatigue: null,
      avgSleep: null,
      nutritionAdherence: null,
      sports: [],
      upcomingEvent: "T100",
    });
    assert.ok(review.limitations.some((line) => /nutrition/i.test(line)));
  });
});
