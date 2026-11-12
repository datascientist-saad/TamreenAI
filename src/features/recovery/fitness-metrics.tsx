"use client";

import { useState } from "react";
import { saveFitnessMetrics } from "@/server/actions";
import { FITNESS_METRIC_META } from "@/lib/fitness";

export function FitnessMetricsForm({
  defaults,
  estimatedVo2,
}: {
  defaults: {
    vo2Max: number | null;
    maxHr: number | null;
    restingHr: number | null;
    hrv: number | null;
    bodyWeight: number | null;
    bodyFat: number | null;
    ftpWatts: number | null;
  };
  estimatedVo2: number | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [vo2, setVo2] = useState(defaults.vo2Max == null ? "" : String(defaults.vo2Max));
  const [source, setSource] = useState<"manual" | "estimate" | "lab" | "device">("manual");

  function numberOrNull(value: FormDataEntryValue | null): number | null {
    if (value == null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await saveFitnessMetrics({
        vo2Max: numberOrNull(formData.get("vo2Max")),
        maxHr: numberOrNull(formData.get("maxHr")),
        restingHr: numberOrNull(formData.get("restingHr")),
        hrv: numberOrNull(formData.get("hrv")),
        bodyWeight: numberOrNull(formData.get("bodyWeight")),
        bodyFat: numberOrNull(formData.get("bodyFat")),
        ftpWatts: numberOrNull(formData.get("ftpWatts")),
        source,
      });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Those metrics were not saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          {FITNESS_METRIC_META.vo2_max.label}
          <div className="flex gap-2">
            <input
              name="vo2Max"
              inputMode="decimal"
              step="0.1"
              placeholder={FITNESS_METRIC_META.vo2_max.unit}
              value={vo2}
              onChange={(event) => {
                setVo2(event.target.value);
                setSource("manual");
              }}
            />
            {estimatedVo2 != null ? (
              <button
                type="button"
                className="btn btn-ghost shrink-0 px-3"
                onClick={() => {
                  setVo2(String(estimatedVo2));
                  setSource("estimate");
                }}
              >
                Use ~{estimatedVo2}
              </button>
            ) : null}
          </div>
          {estimatedVo2 != null ? (
            <span className="text-xs font-medium text-muted">Estimated from your reported 5K.</span>
          ) : null}
        </label>
        <label>
          {FITNESS_METRIC_META.max_hr.label}
          <input name="maxHr" inputMode="numeric" placeholder="bpm" defaultValue={defaults.maxHr ?? ""} />
        </label>
        <label>
          {FITNESS_METRIC_META.resting_hr.label}
          <input name="restingHr" inputMode="numeric" placeholder="bpm" defaultValue={defaults.restingHr ?? ""} />
        </label>
        <label>
          {FITNESS_METRIC_META.hrv.label}
          <input name="hrv" inputMode="decimal" step="0.1" placeholder="ms" defaultValue={defaults.hrv ?? ""} />
        </label>
        <label>
          {FITNESS_METRIC_META.body_weight.label}
          <input name="bodyWeight" inputMode="decimal" step="0.1" placeholder="kg" defaultValue={defaults.bodyWeight ?? ""} />
        </label>
        <label>
          {FITNESS_METRIC_META.body_fat_pct.label}
          <input name="bodyFat" inputMode="decimal" step="0.1" placeholder="%" defaultValue={defaults.bodyFat ?? ""} />
        </label>
        <label className="sm:col-span-2">
          {FITNESS_METRIC_META.cycling_ftp.label}
          <input name="ftpWatts" inputMode="numeric" placeholder="W" defaultValue={defaults.ftpWatts ?? ""} />
        </label>
      </div>
      {saved ? <p className="text-sm font-semibold text-maroon">Fitness metrics saved.</p> : null}
      {error ? <p className="text-sm text-live">{error}</p> : null}
      <button className="btn btn-ghost w-full sm:w-fit" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save fitness metrics"}
      </button>
    </form>
  );
}
