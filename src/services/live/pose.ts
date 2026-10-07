/**
 * Live training keeps the estimator behind this interface.
 * The browser session loads MediaPipe in mediapipe-estimator.ts.
 * Manual reps stay available when the model cannot see the body.
 * Form scores are omitted unless the model measured enough visible frames,
 * or the athlete explicitly saves the labeled squat placeholder.
 */

export const POSE_MODEL_NAME = "pose_landmarker_lite";

export interface ModelFormPayload {
  frameCount: number;
  modelName: string;
  reps: number;
  overall: number | null;
  metrics: Array<{ key: string; label: string; score: number; detail: string }>;
  best: string;
  improve: string;
}

export interface PoseLandmark {
  name: string;
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PoseFrame {
  timestampMs: number;
  landmarks: PoseLandmark[];
  source: "model";
}

export interface PoseEstimator {
  readonly id: string;
  readonly available: boolean;
  start(video: HTMLVideoElement): Promise<void>;
  stop(): void;
  subscribe(listener: (frame: PoseFrame) => void): () => void;
}

export class UnavailablePoseEstimator implements PoseEstimator {
  readonly id = "unavailable";
  readonly available = false;

  async start(): Promise<void> {
    return undefined;
  }

  stop(): void {
    return undefined;
  }

  subscribe(): () => void {
    return () => undefined;
  }
}

export interface FormMetric {
  key: string;
  label: string;
  score: number;
}

export interface FormBreakdown {
  source: "model" | "placeholder_demo";
  overall: number;
  metrics: FormMetric[];
  best: string;
  improve: string;
}

export interface ExerciseAnalyzer {
  slug: string;
  analyze(frames: PoseFrame[]): FormBreakdown | { status: "unavailable"; reason: string };
}

export interface RepCounter {
  update(frame: PoseFrame): { count: number; phase: "up" | "down" | "unknown" };
  reset(): void;
}

export interface FormScorer {
  score(metrics: FormMetric[]): number;
}

export interface MovementClassifier {
  classify(frames: PoseFrame[]): string | null;
}

export interface LiveSessionSummary {
  exerciseSlug: string;
  durationSeconds: number;
  manualReps: number;
  manualSets: number;
  cameraUsed: boolean;
  analysisSource: "unavailable" | "manual" | "placeholder_demo" | "model";
}

export interface SessionAnalyzer {
  summarize(input: LiveSessionSummary): {
    headline: string;
    measured: string[];
    unavailable: string[];
  };
}

export const sessionAnalyzer: SessionAnalyzer = {
  summarize(input) {
    const measured = [
      input.cameraUsed ? "Camera was used for this session." : "Camera was not used.",
      `Manual count: ${input.manualSets} sets, ${input.manualReps} reps.`,
      `Duration: ${input.durationSeconds} seconds.`,
    ];
    const unavailable =
      input.analysisSource === "model"
        ? []
        : ["Form was not scored from the camera on this session."];
    return {
      headline: input.analysisSource === "model" ? "Pose session saved" : "Session saved without a pose score",
      measured,
      unavailable,
    };
  },
};

export interface LiveExercise {
  slug: string;
  name: string;
  cues: string[];
  setup: string;
}

export const LIVE_EXERCISES: LiveExercise[] = [
  { slug: "squat", name: "Squat", setup: "Side-on, full body in frame, feet visible.", cues: ["Depth", "Knee tracking", "Torso angle", "Tempo"] },
  { slug: "deadlift", name: "Deadlift", setup: "Side-on, bar path visible.", cues: ["Bar path", "Hip hinge", "Lockout", "Tempo"] },
  { slug: "bench_press", name: "Bench press", setup: "Side-on or 45 degrees, bench and bar visible.", cues: ["Bar path", "Elbow angle", "Tempo"] },
  { slug: "overhead_press", name: "Overhead press", setup: "Front-on, head to hips in frame.", cues: ["Bar path", "Rib position", "Lockout"] },
  { slug: "lunge", name: "Lunge", setup: "Side-on, both feet visible.", cues: ["Knee tracking", "Depth", "Torso"] },
  { slug: "romanian_deadlift", name: "Romanian deadlift", setup: "Side-on, hinge visible.", cues: ["Hip hinge", "Back position", "Range"] },
  { slug: "push_up", name: "Push-up", setup: "Side-on, head to heels in frame.", cues: ["Body line", "Depth", "Tempo"] },
  { slug: "pull_up", name: "Pull-up", setup: "Front-on, bar and full body visible.", cues: ["Full hang", "Chin path", "Swing"] },
  { slug: "bicep_curl", name: "Biceps curl", setup: "Side-on, elbow visible.", cues: ["Elbow drift", "Range", "Swing"] },
  { slug: "plank", name: "Plank", setup: "Side-on, head to heels in frame.", cues: ["Hip position", "Shoulder stack"] },
];

/** Fixed layout sample. These numbers are not a measurement of the athlete. */
export const PLACEHOLDER_FORM: FormBreakdown = {
  source: "placeholder_demo",
  overall: 84,
  metrics: [
    { key: "depth", label: "Depth", score: 92 },
    { key: "knee_tracking", label: "Knee tracking", score: 78 },
    { key: "torso", label: "Torso stability", score: 85 },
    { key: "tempo", label: "Tempo", score: 81 },
  ],
  best: "Consistent squat depth.",
  improve: "Right knee showed increased medial movement during final repetitions.",
};

/** Server-safe fallback. The live session loads the MediaPipe estimator in the browser. */
export function createPoseEstimator(): PoseEstimator {
  return new UnavailablePoseEstimator();
}
