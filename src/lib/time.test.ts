import assert from "node:assert/strict";
import test from "node:test";
import { clockFromParts, parsePaceList } from "./utils";

test("clockFromParts turns hours, minutes, and seconds into a total", () => {
  assert.deepEqual(clockFromParts("2", "15", "3"), { ok: true, seconds: 8103 });
  assert.deepEqual(clockFromParts("", "", ""), { ok: true, seconds: null });
  assert.deepEqual(clockFromParts("0", "0", "0"), { ok: true, seconds: null });
  assert.equal(clockFromParts("0", "70", "0").ok, false);
  assert.equal(clockFromParts("1", "2", "3.5").ok, false);
});

test("parsePaceList reads minute and second splits", () => {
  assert.deepEqual(parsePaceList("5:30, 5:28, 1:05:00"), { ok: true, seconds: [330, 328, 3900] });
  assert.equal(parsePaceList("330, 328").ok, false);
  assert.deepEqual(parsePaceList(""), { ok: true, seconds: [] });
});
