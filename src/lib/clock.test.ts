import assert from "node:assert/strict";
import test from "node:test";
import { clockToSeconds, emptyClock } from "./clock";

test("a blank time is not stored as zero seconds", () => {
  assert.deepEqual(clockToSeconds(emptyClock(), false), { seconds: null });
});

test("a 5K is entered as minutes and seconds", () => {
  assert.deepEqual(clockToSeconds({ hours: "", minutes: "25", seconds: "30" }, false), { seconds: 1530 });
});

test("a marathon is entered as hours, minutes, and seconds", () => {
  assert.deepEqual(clockToSeconds({ hours: "3", minutes: "45", seconds: "0" }, true), { seconds: 13500 });
});

test("seconds at 60 are rejected", () => {
  const result = clockToSeconds({ hours: "", minutes: "20", seconds: "60" }, false);
  assert.equal("error" in result, true);
});
