import assert from "node:assert/strict";
import test from "node:test";
import { liveSlugForLibrary, workoutHasLiveCamera } from "./catalog";

test("camera slug follows the library movement only when live support is on", () => {
  assert.equal(liveSlugForLibrary("back_squat", true), "squat");
  assert.equal(liveSlugForLibrary("back_squat", false), null);
  assert.equal(liveSlugForLibrary("lat_pulldown", true), "pull_up");
  assert.equal(liveSlugForLibrary("plank", true), "plank");
  assert.equal(liveSlugForLibrary("calf_raise", false), null);
  assert.equal(liveSlugForLibrary("hip_flexor_stretch", false), null);
  assert.equal(liveSlugForLibrary("not_a_movement", true), null);
});

test("a workout has a camera only when one of its exercises can be tracked", () => {
  assert.equal(workoutHasLiveCamera([
    { exercise_library: { slug: "back_squat", live_supported: true } },
    { exercise_library: { slug: "calf_raise", live_supported: false } },
  ]), true);
  assert.equal(workoutHasLiveCamera([
    { exercise_library: [{ slug: "hamstring_stretch", live_supported: false }] },
  ]), false);
  assert.equal(workoutHasLiveCamera(null), false);
});
