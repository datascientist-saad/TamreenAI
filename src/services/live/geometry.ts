import type { PoseFrame, PoseLandmark } from "./pose";

/** Frames with a visible working joint required before a form score is shown. */
export const MIN_POSE_FRAMES = 12;
const MIN_VISIBILITY = 0.6;
const SPIKE_DEGREES = 100;

export const POSE_LANDMARK_NAMES = [
  "nose",
  "left_eye_inner",
  "left_eye",
  "left_eye_outer",
  "right_eye_inner",
  "right_eye",
  "right_eye_outer",
  "left_ear",
  "right_ear",
  "mouth_left",
  "mouth_right",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_pinky",
  "right_pinky",
  "left_index",
  "right_index",
  "left_thumb",
  "right_thumb",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
] as const;

export const BODY_CONNECTIONS: Array<[string, string]> = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
  ["left_ankle", "left_heel"],
  ["left_heel", "left_foot_index"],
  ["left_ankle", "left_foot_index"],
  ["right_ankle", "right_heel"],
  ["right_heel", "right_foot_index"],
  ["right_ankle", "right_foot_index"],
];

export interface MovementSample {
  t: number;
  knee: number | null;
  elbow: number | null;
  hip: number | null;
  torso: number | null;
  line: number | null;
  kneeSpan: number | null;
  ankleSpan: number | null;
  elbowDrift: number | null;
}

export interface RepState {
  count: number;
  phase: "up" | "down" | "unknown";
  lastAngle: number | null;
  downAt: number | null;
  repDurationsMs: number[];
}

export interface FormMetricReading {
  key: string;
  label: string;
  score: number;
  detail: string;
}

export interface MovementReading {
  trackedFrames: number;
  reps: number;
  phase: "up" | "down" | "unknown";
  inFrame: boolean;
  cue: string;
  overall: number | null;
  metrics: FormMetricReading[];
  best: string;
  improve: string;
}

type Signal = "knee" | "elbow" | "hip" | "none";

const RULES: Record<string, { signal: Signal; downBelow: number; upAbove: number }> = {
  squat: { signal: "knee", downBelow: 115, upAbove: 155 },
  lunge: { signal: "knee", downBelow: 115, upAbove: 155 },
  push_up: { signal: "elbow", downBelow: 100, upAbove: 150 },
  bench_press: { signal: "elbow", downBelow: 100, upAbove: 150 },
  bicep_curl: { signal: "elbow", downBelow: 70, upAbove: 150 },
  deadlift: { signal: "hip", downBelow: 140, upAbove: 160 },
  romanian_deadlift: { signal: "hip", downBelow: 140, upAbove: 160 },
  pull_up: { signal: "elbow", downBelow: 90, upAbove: 150 },
  overhead_press: { signal: "elbow", downBelow: 110, upAbove: 160 },
  plank: { signal: "none", downBelow: 0, upAbove: 0 },
};

export function jointAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number | null {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag < 1e-6) return null;
  const cos = Math.min(1, Math.max(-1, (abx * cbx + aby * cby) / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function createRepState(): RepState {
  return { count: 0, phase: "unknown", lastAngle: null, downAt: null, repDurationsMs: [] };
}

export function sampleFrame(frame: PoseFrame): MovementSample {
  const knee = meanAngle(frame, [
    ["left_hip", "left_knee", "left_ankle"],
    ["right_hip", "right_knee", "right_ankle"],
  ]);
  const elbow = meanAngle(frame, [
    ["left_shoulder", "left_elbow", "left_wrist"],
    ["right_shoulder", "right_elbow", "right_wrist"],
  ]);
  const hip = meanAngle(frame, [
    ["left_shoulder", "left_hip", "left_knee"],
    ["right_shoulder", "right_hip", "right_knee"],
  ]);
  const line = meanAngle(frame, [
    ["left_shoulder", "left_hip", "left_ankle"],
    ["right_shoulder", "right_hip", "right_ankle"],
  ]);
  return {
    t: frame.timestampMs,
    knee,
    elbow,
    hip,
    torso: torsoLean(frame),
    line,
    kneeSpan: span(frame, "left_knee", "right_knee"),
    ankleSpan: span(frame, "left_ankle", "right_ankle"),
    elbowDrift: elbowDrift(frame),
  };
}

export function updateRep(slug: string, state: RepState, sample: MovementSample): RepState {
  const rule = RULES[slug];
  const angle = signalAngle(slug, sample);
  if (!rule || rule.signal === "none" || angle == null) return state;
  if (state.lastAngle != null && Math.abs(angle - state.lastAngle) > SPIKE_DEGREES) {
    return { ...state, lastAngle: angle };
  }
  if (state.phase !== "down" && angle < rule.downBelow) {
    return { ...state, phase: "down", lastAngle: angle, downAt: sample.t };
  }
  if (state.phase === "down" && angle > rule.upAbove) {
    const duration = state.downAt == null ? null : Math.max(0, sample.t - state.downAt);
    return {
      count: state.count + 1,
      phase: "up",
      lastAngle: angle,
      downAt: null,
      repDurationsMs: duration == null ? state.repDurationsMs : [...state.repDurationsMs, duration],
    };
  }
  return { ...state, lastAngle: angle };
}

export function scoreMovement(slug: string, samples: MovementSample[]): MovementReading {
  let state = createRepState();
  for (const sample of samples) state = updateRep(slug, state, sample);
  const tracked = samples.filter((sample) => isTracked(slug, sample));
  const inFrame = samples.length > 0 && isTracked(slug, samples[samples.length - 1]!);
  const cue = liveCue(slug, state.phase, inFrame);
  if (tracked.length < MIN_POSE_FRAMES) {
    return {
      trackedFrames: tracked.length,
      reps: state.count,
      phase: state.phase,
      inFrame,
      cue,
      overall: null,
      metrics: [],
      best: "",
      improve: "",
    };
  }
  const metrics = metricsFor(slug, tracked, state);
  if (!metrics.length) {
    return {
      trackedFrames: tracked.length,
      reps: state.count,
      phase: state.phase,
      inFrame,
      cue,
      overall: null,
      metrics: [],
      best: "",
      improve: "",
    };
  }
  const overall = Math.round(metrics.reduce((sum, metric) => sum + metric.score, 0) / metrics.length);
  const bestMetric = metrics.reduce((left, right) => (left.score >= right.score ? left : right));
  const worstMetric = metrics.reduce((left, right) => (left.score <= right.score ? left : right));
  return {
    trackedFrames: tracked.length,
    reps: state.count,
    phase: state.phase,
    inFrame,
    cue,
    overall,
    metrics,
    best: bestMetric.detail,
    improve: worstMetric.detail,
  };
}

export function liveCue(slug: string, phase: RepState["phase"], inFrame: boolean): string {
  if (!inFrame) return "Step back so your whole body stays in frame.";
  if (slug === "plank") return "Hold a straight line from shoulders to ankles.";
  if (phase === "down") return "Drive back up with control.";
  if (slug === "squat" || slug === "lunge") return "Lower until your thighs are near parallel.";
  if (slug === "deadlift" || slug === "romanian_deadlift") return "Hinge at the hips, then stand tall.";
  if (slug === "push_up" || slug === "bench_press") return "Lower until the elbows bend past a right angle.";
  if (slug === "bicep_curl") return "Curl until the elbow flexes, then straighten the arm.";
  if (slug === "pull_up") return "Pull until the elbows flex, then lower to straight arms.";
  if (slug === "overhead_press") return "Press until the elbows lock out overhead.";
  return "Move through the full range you can control.";
}

function metricsFor(slug: string, samples: MovementSample[], state: RepState): FormMetricReading[] {
  const metrics: FormMetricReading[] = [];
  const rule = RULES[slug];
  if (!rule) return metrics;
  if (rule.signal === "knee") {
    const depth = depthMetric(samples, state.count > 0 || state.phase === "down");
    if (depth) metrics.push(depth);
    const knees = kneeMetric(samples);
    if (knees) metrics.push(knees);
  }
  if (rule.signal === "hip") {
    const hinge = hingeMetric(samples, state.count > 0 || state.phase === "down");
    if (hinge) metrics.push(hinge);
  }
  if (rule.signal === "elbow") {
    const range = elbowRangeMetric(slug, samples, state.count > 0 || state.phase === "down");
    if (range) metrics.push(range);
    if (slug === "overhead_press" || slug === "bench_press") {
      const lockout = lockoutMetric(samples, state.count > 0);
      if (lockout) metrics.push(lockout);
    }
    if (slug === "bicep_curl") {
      const drift = driftMetric(samples);
      if (drift) metrics.push(drift);
    }
  }
  if (slug === "squat" || slug === "deadlift" || slug === "romanian_deadlift" || slug === "overhead_press") {
    const torso = torsoMetric(samples);
    if (torso) metrics.push(torso);
  }
  if (slug === "push_up" || slug === "plank") {
    const line = lineMetric(samples, slug === "plank" ? "hip_position" : "body_line", slug === "plank" ? "Hip position" : "Body line");
    if (line) metrics.push(line);
  }
  const tempo = tempoMetric(state.repDurationsMs);
  if (tempo && slug !== "plank") metrics.push(tempo);
  return metrics;
}

function depthMetric(samples: MovementSample[], sawBottom: boolean): FormMetricReading | null {
  const angles = samples.map((sample) => sample.knee).filter((angle): angle is number => angle != null);
  if (!sawBottom || !angles.length) return null;
  const minKnee = Math.min(...angles);
  const score = clampScore(((160 - minKnee) / 70) * 100);
  return {
    key: "depth",
    label: "Depth",
    score,
    detail: `Lowest knee angle in frame was ${Math.round(minKnee)}°. A deeper squat is a smaller angle.`,
  };
}

function kneeMetric(samples: MovementSample[]): FormMetricReading | null {
  const usable = samples.filter((sample) => sample.knee != null && sample.kneeSpan != null && sample.ankleSpan != null && sample.ankleSpan > 0.04);
  if (!usable.length) return null;
  const bottom = usable.reduce((left, right) => ((left.knee ?? 180) <= (right.knee ?? 180) ? left : right));
  const ratio = (bottom.kneeSpan ?? 0) / (bottom.ankleSpan ?? 1);
  const score = ratio >= 1 ? 96 : ratio >= 0.82
    ? Math.round(70 + ((ratio - 0.82) / 0.18) * 26)
    : Math.round(Math.max(15, (ratio / 0.82) * 70));
  const inside = ratio < 0.82;
  return {
    key: "knee_tracking",
    label: "Knee tracking",
    score: clampScore(score),
    detail: inside
      ? `At the bottom, knee width was ${Math.round(ratio * 100)}% of ankle width. Knees moved inside the ankles.`
      : `At the bottom, knee width was ${Math.round(ratio * 100)}% of ankle width.`,
  };
}

function hingeMetric(samples: MovementSample[], sawBottom: boolean): FormMetricReading | null {
  const angles = samples.map((sample) => sample.hip).filter((angle): angle is number => angle != null);
  if (!sawBottom || !angles.length) return null;
  const minHip = Math.min(...angles);
  return {
    key: "hinge",
    label: "Hip hinge",
    score: clampScore(((170 - minHip) / 80) * 100),
    detail: `Smallest hip angle in frame was ${Math.round(minHip)}°.`,
  };
}

function elbowRangeMetric(slug: string, samples: MovementSample[], sawBottom: boolean): FormMetricReading | null {
  const angles = samples.map((sample) => sample.elbow).filter((angle): angle is number => angle != null);
  if (!sawBottom || !angles.length) return null;
  const minElbow = Math.min(...angles);
  const label = slug === "push_up" || slug === "bench_press" ? "Depth" : "Range";
  return {
    key: slug === "push_up" || slug === "bench_press" ? "depth" : "range",
    label,
    score: clampScore(((160 - minElbow) / 110) * 100),
    detail: `Smallest elbow angle in frame was ${Math.round(minElbow)}°.`,
  };
}

function lockoutMetric(samples: MovementSample[], finishedRep: boolean): FormMetricReading | null {
  const angles = samples.map((sample) => sample.elbow).filter((angle): angle is number => angle != null);
  if (!finishedRep || !angles.length) return null;
  const maxElbow = Math.max(...angles);
  return {
    key: "lockout",
    label: "Lockout",
    score: clampScore(((maxElbow - 140) / 40) * 100),
    detail: `Straightest elbow angle in frame was ${Math.round(maxElbow)}°.`,
  };
}

function driftMetric(samples: MovementSample[]): FormMetricReading | null {
  const drifts = samples.map((sample) => sample.elbowDrift).filter((value): value is number => value != null);
  if (drifts.length < MIN_POSE_FRAMES) return null;
  const mean = drifts.reduce((sum, value) => sum + value, 0) / drifts.length;
  return {
    key: "elbow_drift",
    label: "Elbow drift",
    score: clampScore(100 - mean * 500),
    detail: `The elbow stayed about ${Math.round(mean * 100)}% of the frame away from the shoulder.`,
  };
}

function torsoMetric(samples: MovementSample[]): FormMetricReading | null {
  const leans = samples.map((sample) => sample.torso).filter((value): value is number => value != null);
  if (leans.length < MIN_POSE_FRAMES) return null;
  const spread = stdev(leans) ?? 0;
  return {
    key: "torso",
    label: "Torso stability",
    score: clampScore(100 - spread * 5),
    detail: `Torso angle varied by about ${Math.round(spread)}° while the body was visible.`,
  };
}

function lineMetric(samples: MovementSample[], key: string, label: string): FormMetricReading | null {
  const lines = samples.map((sample) => sample.line).filter((value): value is number => value != null);
  if (lines.length < MIN_POSE_FRAMES) return null;
  const deviation = lines.reduce((sum, value) => sum + Math.abs(180 - value), 0) / lines.length;
  return {
    key,
    label,
    score: clampScore(100 - deviation * 2),
    detail: `Shoulder, hip, and ankle sat about ${Math.round(deviation)}° off a straight line.`,
  };
}

function tempoMetric(durations: number[]): FormMetricReading | null {
  if (durations.length < 2) return null;
  const mean = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  if (mean <= 0) return null;
  const spread = stdev(durations) ?? 0;
  const cv = spread / mean;
  return {
    key: "tempo",
    label: "Tempo",
    score: clampScore(100 - cv * 80),
    detail: `${durations.length} reps were timed from the camera. The spread was ${Math.round(spread)} ms.`,
  };
}

function signalAngle(slug: string, sample: MovementSample): number | null {
  const rule = RULES[slug];
  if (!rule || rule.signal === "none") return null;
  if (rule.signal === "knee") return sample.knee;
  if (rule.signal === "elbow") return sample.elbow;
  return sample.hip;
}

function isTracked(slug: string, sample: MovementSample): boolean {
  const rule = RULES[slug];
  if (!rule || rule.signal === "none") return sample.line != null || sample.torso != null;
  return signalAngle(slug, sample) != null;
}

function meanAngle(frame: PoseFrame, triples: Array<[string, string, string]>): number | null {
  const angles = triples
    .map(([a, b, c]) => {
      const pa = usable(frame, a);
      const pb = usable(frame, b);
      const pc = usable(frame, c);
      if (!pa || !pb || !pc) return null;
      return jointAngle(pa, pb, pc);
    })
    .filter((angle): angle is number => angle != null);
  if (!angles.length) return null;
  return angles.reduce((sum, angle) => sum + angle, 0) / angles.length;
}

function torsoLean(frame: PoseFrame): number | null {
  const leans = [
    lean(usable(frame, "left_shoulder"), usable(frame, "left_hip")),
    lean(usable(frame, "right_shoulder"), usable(frame, "right_hip")),
  ].filter((value): value is number => value != null);
  if (!leans.length) return null;
  return leans.reduce((sum, value) => sum + value, 0) / leans.length;
}

function lean(shoulder: PoseLandmark | null, hip: PoseLandmark | null): number | null {
  if (!shoulder || !hip) return null;
  const dx = shoulder.x - hip.x;
  const dy = shoulder.y - hip.y;
  const mag = Math.hypot(dx, dy);
  if (mag < 1e-4) return null;
  const cos = Math.min(1, Math.max(-1, -dy / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

function span(frame: PoseFrame, left: string, right: string): number | null {
  const a = usable(frame, left);
  const b = usable(frame, right);
  if (!a || !b) return null;
  return Math.abs(a.x - b.x);
}

function elbowDrift(frame: PoseFrame): number | null {
  const drifts = [
    pairDrift(usable(frame, "left_shoulder"), usable(frame, "left_elbow")),
    pairDrift(usable(frame, "right_shoulder"), usable(frame, "right_elbow")),
  ].filter((value): value is number => value != null);
  if (!drifts.length) return null;
  return drifts.reduce((sum, value) => sum + value, 0) / drifts.length;
}

function pairDrift(anchor: PoseLandmark | null, joint: PoseLandmark | null): number | null {
  if (!anchor || !joint) return null;
  return Math.abs(anchor.x - joint.x);
}

function usable(frame: PoseFrame, name: string): PoseLandmark | null {
  const found = frame.landmarks.find((landmark) => landmark.name === name);
  if (!found) return null;
  if (found.visibility != null && found.visibility < MIN_VISIBILITY) return null;
  return found;
}

function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(100, Math.max(0, value)));
}
