"use client";

import { useState } from "react";
import { deleteHealthMeasurement, saveHealthMeasurement } from "@/server/mvp-actions";

const quickMetrics = [
  ["resting_hr", "Resting HR", "bpm"],
  ["hrv", "HRV", "ms"],
  ["vo2_max", "VO₂ max", "ml/kg/min"],
  ["sleep_score", "Sleep score", "score"],
  ["body_weight", "Weight", "kg"],
  ["fatigue", "Fatigue (1-5)", "1-5"],
  ["energy", "Energy (1-5)", "1-5"],
  ["muscle_soreness", "Soreness (1-5)", "1-5"],
] as const;

export function HealthEntryForm({ consent }: { consent: boolean }) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  if (!consent) {
    return <p className="text-sm text-muted">Confirm health-data consent on onboarding or profile before saving measurements.</p>;
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError("");
        setSaved(false);
        const valueRaw = String(form.get("value") || "").trim();
        const result = await saveHealthMeasurement({
          metricSlug: String(form.get("metricSlug") || ""),
          value: valueRaw ? Number(valueRaw) : null,
          unit: String(form.get("unit") || ""),
          method: String(form.get("method") || "") || null,
          source: (String(form.get("source") || "manual") as "manual" | "lab" | "estimate" | "whoop" | "device" | "other"),
          notes: String(form.get("notes") || ""),
        });
        setPending(false);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setSaved(true);
        event.currentTarget.reset();
      }}
    >
      <label>Metric
        <select name="metricSlug" required defaultValue="resting_hr">
          {quickMetrics.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
          <option value="max_hr">Max HR</option>
          <option value="blood_pressure_systolic">BP systolic</option>
          <option value="blood_pressure_diastolic">BP diastolic</option>
          <option value="cycling_ftp">Cycling FTP</option>
          <option value="run_threshold_pace">Run threshold pace (sec/km)</option>
          <option value="swim_threshold_pace">Swim threshold pace (sec/100m)</option>
          <option value="sleep_duration">Sleep duration (h)</option>
          <option value="sleep_quality">Sleep quality (1-5)</option>
          <option value="body_height">Height</option>
          <option value="body_fat_pct">Body fat %</option>
          <option value="waist_cm">Waist cm</option>
          <option value="stress">Stress (1-5)</option>
          <option value="readiness">Readiness (1-5)</option>
          <option value="daily_steps">Steps</option>
          <option value="hydration_ml">Hydration ml</option>
          <option value="activity_level">Activity level (1-5)</option>
        </select>
      </label>
      <label>Value<input name="value" inputMode="decimal" required /></label>
      <label>Unit<input name="unit" defaultValue="bpm" required /></label>
      <label>Method / source detail<input name="method" placeholder="RMSSD, lab test, subjective…" /></label>
      <label>Source
        <select name="source" defaultValue="manual">
          <option value="manual">Manual</option>
          <option value="lab">Laboratory</option>
          <option value="estimate">Estimate</option>
          <option value="device">Device (manual copy)</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>Notes<textarea name="notes" /></label>
      {error ? <p className="text-sm text-live">{error}</p> : null}
      {saved ? <p className="text-sm">Saved.</p> : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save measurement"}</button>
    </form>
  );
}

export function DeleteMeasurementButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      className="text-xs font-bold text-muted"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await deleteHealthMeasurement(id);
        setPending(false);
        window.location.reload();
      }}
    >
      Delete
    </button>
  );
}
