import assert from "node:assert/strict";
import test from "node:test";
import { estimateVo2From5kSeconds, recommendationLabel, readinessTone } from "./fitness";

test("estimateVo2From5kSeconds returns a plausible value for a solid 5K", () => {
  const vo2 = estimateVo2From5kSeconds(20 * 60);
  assert.ok(vo2 != null);
  assert.ok(vo2 > 45 && vo2 < 60);
});

test("estimateVo2From5kSeconds rejects nonsense times", () => {
  assert.equal(estimateVo2From5kSeconds(null), null);
  assert.equal(estimateVo2From5kSeconds(5 * 60), null);
  assert.equal(estimateVo2From5kSeconds(90 * 60), null);
});

test("readinessTone and recommendationLabel cover empty states", () => {
  assert.equal(readinessTone(null), "none");
  assert.equal(readinessTone(80), "good");
  assert.equal(readinessTone(60), "ok");
  assert.equal(readinessTone(40), "low");
  assert.equal(recommendationLabel("easy_only"), "Easy only");
  assert.equal(recommendationLabel("push_ok"), "Push ok");
  assert.equal(recommendationLabel(null), "Log a check-in");
});
