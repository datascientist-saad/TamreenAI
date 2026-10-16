import assert from "node:assert/strict";
import test from "node:test";
import { trainingWindow } from "./progress";

test("progress counts completed work and future planned sessions only", () => {
  const result = trainingWindow({
    today: "2026-10-16",
    start: "2026-10-01",
    end: "2026-11-01",
    workouts: [
      { status: "completed", scheduled_date: "2026-10-02" },
      { status: "planned", scheduled_date: "2026-10-10" },
      { status: "planned", scheduled_date: "2026-10-16" },
      { status: "planned", scheduled_date: "2026-10-20" },
      { status: "skipped", scheduled_date: "2026-10-18" },
      { status: "completed", scheduled_date: "2026-11-05" },
    ],
  });
  assert.deepEqual(result, { daysLeft: 16, done: 1, remaining: 2 });
});

test("a past horizon does not invent days left", () => {
  const result = trainingWindow({
    today: "2026-10-16",
    start: "2026-10-01",
    end: "2026-10-10",
    workouts: [{ status: "completed", scheduled_date: "2026-10-04" }],
  });
  assert.equal(result.daysLeft, 0);
  assert.equal(result.done, 1);
  assert.equal(result.remaining, 0);
});
