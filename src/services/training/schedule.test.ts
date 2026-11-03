import assert from "node:assert/strict";
import test from "node:test";
import { matchScheduleChanges, optimizeExplanation } from "./schedule";

test("schedule changes match each workout once, including duplicate titles", () => {
  const rows = [
    { id: "a", title: "Easy run", scheduled_date: "2026-11-03" },
    { id: "b", title: "Easy run", scheduled_date: "2026-11-03" },
    { id: "c", title: "Lower-body strength", scheduled_date: "2026-11-04" },
  ];
  const applied = matchScheduleChanges(rows, [
    { title: "Easy run", fromDate: "2026-11-03", toDate: "2026-11-05", reason: "Space the easy run." },
    { title: "Easy run", fromDate: "2026-11-03", toDate: "2026-11-06", reason: "Space the second easy run." },
    { title: "Lower-body strength", fromDate: "2026-11-04", toDate: "2026-11-04", reason: "Already placed." },
    { title: "Missing", fromDate: "2026-11-01", toDate: "2026-11-02", reason: "No row." },
  ]);
  assert.deepEqual(applied.map((move) => move.id), ["a", "b"]);
  assert.equal(applied[0]?.toDate, "2026-11-05");
  assert.equal(applied[1]?.toDate, "2026-11-06");
});

test("optimize copy follows whether the conflict actually cleared", () => {
  assert.match(optimizeExplanation({
    beforeCount: 1,
    afterCount: 0,
    changeCount: 2,
    engineExplanation: "engine",
  }), /2 sessions moved/);
  assert.match(optimizeExplanation({
    beforeCount: 1,
    afterCount: 1,
    changeCount: 1,
    engineExplanation: "engine",
  }), /Drag a workout/);
  assert.match(optimizeExplanation({
    beforeCount: 2,
    afterCount: 2,
    changeCount: 0,
    engineExplanation: "engine",
  }), /could not be separated/);
  assert.equal(optimizeExplanation({
    beforeCount: 0,
    afterCount: 0,
    changeCount: 0,
    engineExplanation: "This week already keeps hard sessions apart.",
  }), "This week already keeps hard sessions apart.");
});
