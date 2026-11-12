/** Daniels oxygen-cost approximation for a steady race pace (ml/kg/min). */
export function estimateVo2From5kSeconds(seconds: number | null | undefined): number | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 12 * 60 || seconds > 60 * 60) return null;
  const velocity = 5000 / (seconds / 60);
  const vo2 = -4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity;
  if (!Number.isFinite(vo2) || vo2 < 20 || vo2 > 90) return null;
  return Math.round(vo2 * 10) / 10;
}

export function readinessTone(score: number | null | undefined): "good" | "ok" | "low" | "none" {
  if (score == null || !Number.isFinite(score)) return "none";
  if (score >= 75) return "good";
  if (score >= 55) return "ok";
  return "low";
}

export function recommendationLabel(value: string | null | undefined): string {
  if (!value) return "Log a check-in";
  const labels: Record<string, string> = {
    push_ok: "Push ok",
    normal: "Train as planned",
    easy_only: "Easy only",
    rest: "Rest today",
    modify: "Modify the session",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export type HealthMetricSlug =
  | "vo2_max"
  | "max_hr"
  | "resting_hr"
  | "hrv"
  | "body_weight"
  | "body_fat_pct"
  | "cycling_ftp";

export const FITNESS_METRIC_META: Record<
  HealthMetricSlug,
  { label: string; unit: string; step?: string; inputMode?: "decimal" | "numeric" }
> = {
  vo2_max: { label: "VO₂ max", unit: "ml/kg/min", step: "0.1", inputMode: "decimal" },
  max_hr: { label: "Max HR", unit: "bpm", inputMode: "numeric" },
  resting_hr: { label: "Resting HR", unit: "bpm", inputMode: "numeric" },
  hrv: { label: "HRV", unit: "ms", step: "0.1", inputMode: "decimal" },
  body_weight: { label: "Weight", unit: "kg", step: "0.1", inputMode: "decimal" },
  body_fat_pct: { label: "Body fat", unit: "%", step: "0.1", inputMode: "decimal" },
  cycling_ftp: { label: "FTP", unit: "W", inputMode: "numeric" },
};
