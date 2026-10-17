import assert from "node:assert/strict";
import test from "node:test";
import { adjustedWeek, originalWeek, sampleAdjustment, strengthWorkout } from "./fixtures";

test("sample adjustment uses the illustrative explanation", () => {
  assert.equal(
    sampleAdjustment,
    "Your hard run moved to Thursday to allow more recovery after Wednesday’s lower-body strength session.",
  );
});

test("accepting the sample week moves the hard run off Wednesday", () => {
  assert.equal(originalWeek.filter((session) => session.date.startsWith("7 Oct") && session.title === "Hard run").length, 1);
  assert.equal(adjustedWeek.some((session) => session.weekday === "Thu" && session.title === "Hard run"), true);
  assert.equal(adjustedWeek.some((session) => session.weekday === "Wed" && session.title === "Hard run"), false);
});

test("strength sample includes sets, reps, and weight", () => {
  assert.ok(strengthWorkout.sets.every((set) => set.sets && set.reps && set.weight));
});
