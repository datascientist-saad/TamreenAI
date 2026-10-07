import assert from "node:assert/strict";
import test from "node:test";
import type { PoseFrame } from "./pose";
import { createRepState, jointAngle, sampleFrame, scoreMovement, updateRep } from "./geometry";

test("joint angle is 90 degrees at a corner and 180 on a straight line", () => {
  const right = jointAngle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 });
  const straight = jointAngle({ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 });
  assert.ok(right != null && Math.abs(right - 90) < 0.01);
  assert.ok(straight != null && Math.abs(straight - 180) < 0.01);
});

test("a squat rep counts once when the knee folds and stands back up", () => {
  const angles = [170, 100, 110, 105, 170, 100, 168];
  let state = createRepState();
  angles.forEach((angle, index) => {
    state = updateRep("squat", state, sampleFrame(legFrame(index * 200, angle)));
  });
  assert.equal(state.count, 2);
  assert.equal(state.phase, "up");
});

test("a single-frame angle spike does not count as a rep", () => {
  let state = createRepState();
  for (const angle of [170, 20, 170]) {
    state = updateRep("squat", state, sampleFrame(legFrame(state.count, angle)));
  }
  assert.equal(state.count, 0);
});

test("a plank does not count reps", () => {
  let state = createRepState();
  for (let index = 0; index < 8; index += 1) {
    state = updateRep("plank", state, sampleFrame(legFrame(index, index % 2 ? 90 : 170)));
  }
  assert.equal(state.count, 0);
});

test("form score stays empty until the body is visible for enough frames", () => {
  const thin = scoreMovement("squat", [0, 1, 2, 3, 4].map((index) => sampleFrame(legFrame(index * 200, index === 2 ? 95 : 170))));
  assert.equal(thin.overall, null);
  assert.equal(thin.metrics.length, 0);
  assert.equal(thin.reps, 1);
});

test("a visible squat produces a 2D depth score and omits knee cave without both legs", () => {
  const samples = squatSeries([170, 170, 100, 95, 96, 98, 170, 168, 170, 169, 168, 170]).map((frame) => sampleFrame(frame));
  const reading = scoreMovement("squat", samples);
  assert.ok(reading.overall != null && reading.overall >= 0 && reading.overall <= 100);
  const depth = reading.metrics.find((metric) => metric.key === "depth");
  assert.ok(depth && depth.score >= 90);
  assert.equal(reading.metrics.some((metric) => metric.key === "knee_tracking"), false);
  assert.equal(reading.reps, 1);
});

test("knees inside the ankles are described as knee cave", () => {
  const wide = scoreMovement("squat", bottomAngles().map((angle, index) => sampleFrame(legFrame(index * 400, angle, true, 0.32, 0.68, 0.3, 0.7))));
  const cave = scoreMovement("squat", bottomAngles().map((angle, index) => sampleFrame(legFrame(index * 400, angle, true, 0.46, 0.54, 0.3, 0.7))));
  const wideKnees = wide.metrics.find((metric) => metric.key === "knee_tracking");
  const caveKnees = cave.metrics.find((metric) => metric.key === "knee_tracking");
  assert.ok(wideKnees && caveKnees);
  assert.ok(caveKnees.score < wideKnees.score);
  assert.match(caveKnees.detail, /inside the ankles/);
  assert.doesNotMatch(wideKnees.detail, /inside the ankles/);
});

test("landmarks below the visibility cutoff produce no score", () => {
  const frames = squatSeries([170, 100, 95, 170, 168, 170, 169, 168, 170, 170, 169, 168]).map((frame) => ({
    ...frame,
    landmarks: frame.landmarks.map((landmark) => ({ ...landmark, visibility: 0.2 })),
  }));
  const reading = scoreMovement("squat", frames.map((frame) => sampleFrame(frame)));
  assert.equal(reading.trackedFrames, 0);
  assert.equal(reading.overall, null);
  assert.equal(reading.inFrame, false);
});

function bottomAngles(): number[] {
  return [170, 170, 110, 95, 96, 98, 170, 168, 170, 169, 168, 170];
}

function squatSeries(angles: number[], bothLegs = false): PoseFrame[] {
  return angles.map((angle, index) => legFrame(index * 400, angle, bothLegs));
}

function legFrame(timestampMs: number, angle: number, bothLegs = false, leftKneeX = 0.42, rightKneeX = 0.58, leftAnkleX?: number, rightAnkleX?: number): PoseFrame {
  const left = legPoints(angle, { x: leftKneeX, y: 0.55 });
  const right = legPoints(angle, { x: rightKneeX, y: 0.55 });
  const landmarks = [
    { name: "left_hip", ...left.hip },
    { name: "left_knee", ...left.knee },
    { name: "left_ankle", x: leftAnkleX ?? left.ankle.x, y: left.ankle.y },
    { name: "left_shoulder", x: left.hip.x, y: left.hip.y - 0.2 },
  ];
  if (bothLegs) {
    landmarks.push(
      { name: "right_hip", ...right.hip },
      { name: "right_knee", ...right.knee },
      { name: "right_ankle", x: rightAnkleX ?? right.ankle.x, y: right.ankle.y },
      { name: "right_shoulder", x: right.hip.x, y: right.hip.y - 0.2 },
    );
  }
  return {
    timestampMs,
    source: "model",
    landmarks: landmarks.map((landmark) => ({ ...landmark, visibility: 0.95 })),
  };
}

function legPoints(angle: number, knee: { x: number; y: number }) {
  const rad = (angle * Math.PI) / 180;
  const len = 0.18;
  return {
    hip: { x: knee.x, y: knee.y - len },
    knee,
    ankle: { x: knee.x + Math.sin(rad) * len, y: knee.y - Math.cos(rad) * len },
  };
}
