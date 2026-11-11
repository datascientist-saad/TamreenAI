/**
 * Hybrid fitness assessment helpers.
 * Level 1 self-report, Level 2 optional benchmarks, Level 3 continuous calibration metadata.
 */

export type AssessmentLevel = 1 | 2 | 3;

export interface SelfReportInput {
  experience: "beginner" | "intermediate" | "advanced" | "elite";
  weeklyHours: number | null;
  longestWorkoutMin: number | null;
  runningCapability: string | null;
  swimmingCapability: string | null;
  cyclingCapability: string | null;
  strengthExperience: string | null;
  limitations: string[];
  raceResults: string | null;
}

export interface BenchmarkInput {
  sport: string;
  testSlug: string;
  value: number | null;
  unit: string | null;
  isMaximal: boolean;
  notes?: string;
}

export interface AssessmentResult {
  level: AssessmentLevel;
  summary: string;
  confidence: number;
  source: "athlete" | "benchmark" | "derived";
  payload: Record<string, unknown>;
  missing: string[];
  limitations: string[];
}

export function scoreSelfReport(input: SelfReportInput): AssessmentResult {
  const missing: string[] = [];
  if (input.weeklyHours == null) missing.push("Recent weekly training volume");
  if (input.longestWorkoutMin == null) missing.push("Longest recent workout");
  if (!input.runningCapability) missing.push("Running capability");
  if (!input.swimmingCapability) missing.push("Swimming capability");
  if (!input.cyclingCapability) missing.push("Cycling capability");
  if (!input.strengthExperience) missing.push("Strength experience");

  const filled = 6 - missing.length;
  const confidence = Math.max(0.2, Math.min(0.75, 0.25 + filled * 0.08));
  const summary = [
    `Self-reported ${input.experience} athlete.`,
    input.weeklyHours != null ? `About ${input.weeklyHours} training hours/week.` : "Weekly volume unknown.",
    input.limitations.length ? `Limitations noted: ${input.limitations.join(", ")}.` : "No limitations listed.",
  ].join(" ");

  return {
    level: 1,
    summary,
    confidence,
    source: "athlete",
    payload: { ...input },
    missing,
    limitations: [
      "Self-report is not a measured fitness test.",
      "Missing fields reduce confidence and keep prescriptions conservative.",
    ],
  };
}

export function scoreBenchmarks(benchmarks: BenchmarkInput[]): AssessmentResult {
  const usable = benchmarks.filter((row) => row.value != null && Number.isFinite(row.value));
  const maximal = usable.filter((row) => row.isMaximal);
  const confidence = Math.max(0.35, Math.min(0.9, 0.4 + usable.length * 0.08 - maximal.length * 0.02));
  const missing = usable.length ? [] : ["No benchmark values recorded"];
  return {
    level: 2,
    summary: usable.length
      ? `${usable.length} benchmark result(s) recorded${maximal.length ? ` (${maximal.length} maximal — use caution for beginners)` : " (submaximal preferred)"}.`
      : "No usable benchmarks yet.",
    confidence: usable.length ? confidence : 0.2,
    source: usable.length ? "benchmark" : "athlete",
    payload: { benchmarks },
    missing,
    limitations: [
      "Beginners should prefer submaximal tests.",
      "Benchmark confidence depends on test conditions and recency.",
    ],
  };
}

export function mergeHybrid(self: AssessmentResult, bench: AssessmentResult): AssessmentResult {
  const confidence = Math.min(0.92, self.confidence * 0.45 + bench.confidence * 0.55 + 0.05);
  return {
    level: self.missing.length && !bench.payload.benchmarks ? 1 : 2,
    summary: `${self.summary} ${bench.summary}`,
    confidence,
    source: "derived",
    payload: { selfReport: self.payload, benchmarks: bench.payload },
    missing: [...new Set([...self.missing, ...bench.missing])],
    limitations: [...self.limitations, ...bench.limitations, "Hybrid estimate blends self-report with optional tests."],
  };
}

export function continuousCalibrationNote(sampleSize: number): { confidence: number; limitation: string } {
  if (sampleSize < 3) {
    return { confidence: 0.25, limitation: "Fewer than three completed sessions — keep estimates provisional." };
  }
  if (sampleSize < 8) {
    return { confidence: 0.45, limitation: "Early calibration from limited sessions." };
  }
  return { confidence: Math.min(0.85, 0.5 + sampleSize * 0.02), limitation: "Longitudinal calibration improves with consistent logging." };
}
