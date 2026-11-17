/**
 * Event results analysis and conservative training feedback.
 * Separates measured values from estimates. Does not invent VO2max/FTP/LT from thin data.
 */

import type { PlanningEvent } from "./multi-event";

export type EventResultInput = {
  targetTimeSeconds?: number | null;
  finishTimeSeconds?: number | null;
  actualDistanceM?: number | null;
  expectedDistanceM?: number | null;
  perceivedExertion?: number | null;
  avgHeartRate?: number | null;
  completionStatus: "finished" | "dnf" | "dns" | "partial";
  conditions?: string;
  trainingConsistencyPct?: number | null; // 0–100 if known
};

export type PerformanceAnalysis = {
  measured: {
    finishTimeSeconds: number | null;
    actualDistanceM: number | null;
    paceSecPerKm: number | null;
    avgHeartRate: number | null;
  };
  comparisons: Array<{ label: string; detail: string; kind: "measured" | "estimate" }>;
  trainingUpdates: Array<{
    domain: "running" | "cycling" | "swimming" | "strength" | "general";
    change: string;
    confidence: "low" | "moderate";
    estimate: boolean;
  }>;
  summary: string;
};

function paceSecPerKm(timeSec: number | null | undefined, distanceM: number | null | undefined): number | null {
  if (timeSec == null || distanceM == null || distanceM <= 0 || timeSec <= 0) return null;
  return timeSec / (distanceM / 1000);
}

function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

function formatClock(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.round(total % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function analyzeEventResult(event: PlanningEvent, input: EventResultInput): PerformanceAnalysis {
  const distance = input.actualDistanceM ?? input.expectedDistanceM ?? event.distanceM ?? event.runM ?? null;
  const finish = input.finishTimeSeconds ?? null;
  const actualPace = paceSecPerKm(finish, distance);
  const targetPace = paceSecPerKm(input.targetTimeSeconds ?? event.goalTimeSeconds, distance);

  const comparisons: PerformanceAnalysis["comparisons"] = [];
  const trainingUpdates: PerformanceAnalysis["trainingUpdates"] = [];

  if (input.completionStatus === "dns") {
    return {
      measured: { finishTimeSeconds: null, actualDistanceM: distance, paceSecPerKm: null, avgHeartRate: input.avgHeartRate ?? null },
      comparisons: [{ label: "Status", detail: "Did not start — no performance comparison.", kind: "measured" }],
      trainingUpdates: [],
      summary: "No race performance was recorded because the event was not started.",
    };
  }

  if (finish != null && (input.targetTimeSeconds ?? event.goalTimeSeconds)) {
    const target = input.targetTimeSeconds ?? event.goalTimeSeconds!;
    const delta = finish - target;
    const pct = Math.round((delta / target) * 1000) / 10;
    comparisons.push({
      label: "Target vs actual time",
      detail: `Target ${formatClock(target)} · Actual ${formatClock(finish)} (${delta >= 0 ? "+" : ""}${formatClock(Math.abs(delta))}, ${pct}%).`,
      kind: "measured",
    });
  } else if (finish != null) {
    comparisons.push({
      label: "Finish time",
      detail: `Recorded ${formatClock(finish)}. No target time was set for comparison.`,
      kind: "measured",
    });
  } else {
    comparisons.push({
      label: "Finish time",
      detail: "No finish time was entered — analysis is limited.",
      kind: "measured",
    });
  }

  if (actualPace != null && targetPace != null) {
    comparisons.push({
      label: "Pace",
      detail: `Expected ~${formatPace(targetPace)} · Actual ${formatPace(actualPace)}.`,
      kind: "measured",
    });
  } else if (actualPace != null) {
    comparisons.push({
      label: "Pace",
      detail: `Actual ${formatPace(actualPace)} from recorded time and distance.`,
      kind: "measured",
    });
  }

  if (input.trainingConsistencyPct != null) {
    comparisons.push({
      label: "Pre-event consistency",
      detail: `About ${input.trainingConsistencyPct}% of planned sessions were completed in the lead-up (from logs).`,
      kind: "measured",
    });
  }

  if (input.perceivedExertion != null) {
    comparisons.push({
      label: "Perceived exertion",
      detail: `Athlete-reported RPE ${input.perceivedExertion}/10.`,
      kind: "measured",
    });
  }

  if (input.avgHeartRate != null) {
    comparisons.push({
      label: "Average heart rate",
      detail: `${input.avgHeartRate} bpm (device or manual entry).`,
      kind: "measured",
    });
  }

  if (input.conditions) {
    comparisons.push({ label: "Conditions", detail: input.conditions, kind: "measured" });
  }

  // Conservative training updates — only when enough evidence exists.
  if (finish != null && actualPace != null && input.completionStatus === "finished" && (distance ?? 0) >= 5000) {
    if (event.sports.includes("running") || event.discipline === "running" || event.runM) {
      trainingUpdates.push({
        domain: "running",
        change: `Consider reviewing easy/long pace ranges using race pace ${formatPace(actualPace)} as one data point — not a lab threshold.`,
        confidence: (distance ?? 0) >= 10000 ? "moderate" : "low",
        estimate: true,
      });
    }
    if (event.sports.includes("cycling") || event.discipline === "cycling") {
      trainingUpdates.push({
        domain: "cycling",
        change: "Race result alone is insufficient to update FTP. Keep power targets unchanged until a validated test or sufficient power file exists.",
        confidence: "low",
        estimate: true,
      });
    }
    if (event.sports.includes("swimming") || event.discipline === "swimming") {
      trainingUpdates.push({
        domain: "swimming",
        change: "Use the recorded swim split (if available) as a pacing reference only — not a CSS/threshold claim.",
        confidence: "low",
        estimate: true,
      });
    }
  }

  if (event.discipline === "strength" && input.completionStatus === "finished") {
    trainingUpdates.push({
      domain: "strength",
      change: "Update competition lift benchmarks only from validated attempts recorded in the log — not from estimated totals.",
      confidence: "moderate",
      estimate: false,
    });
  }

  trainingUpdates.push({
    domain: "general",
    change: "No VO₂ max, lactate threshold, or FTP was inferred from this event alone.",
    confidence: "low",
    estimate: true,
  });

  const summary = finish != null
    ? `Result recorded for ${event.name}. Measured times and paces are shown separately from any training estimates.`
    : `Completion status ${input.completionStatus} for ${event.name} with limited timing data.`;

  return {
    measured: {
      finishTimeSeconds: finish,
      actualDistanceM: distance,
      paceSecPerKm: actualPace,
      avgHeartRate: input.avgHeartRate ?? null,
    },
    comparisons,
    trainingUpdates,
    summary,
  };
}
