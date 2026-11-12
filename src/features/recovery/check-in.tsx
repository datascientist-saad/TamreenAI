"use client";

import { useMemo, useState } from "react";
import { SafetyBanner } from "@/components/states";
import { logRecovery } from "@/server/actions";
import { cn } from "@/lib/utils";

const symptoms = [
  ["chest_pain", "Chest pain"],
  ["fainting", "Fainting"],
  ["severe_pain", "Severe pain"],
  ["shortness_of_breath_at_rest", "Breathless at rest"],
] as const;

const feelingScales = [
  { name: "sleepQuality", label: "Sleep quality", low: "Poor", high: "Excellent", invert: false },
  { name: "soreness", label: "Soreness", low: "Fresh", high: "Very sore", invert: true },
  { name: "fatigue", label: "Fatigue", low: "Fresh", high: "Exhausted", invert: true },
  { name: "motivation", label: "Motivation", low: "Low", high: "High", invert: false },
  { name: "stress", label: "Stress", low: "Calm", high: "High", invert: true },
] as const;

export function RecoveryForm({
  defaults,
}: {
  defaults?: {
    sleepHours?: number | null;
    restingHr?: number | null;
    hrv?: number | null;
    sourceDay?: string | null;
  };
} = {}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [pending, setPending] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({
    sleepQuality: 3,
    soreness: 3,
    fatigue: 3,
    motivation: 3,
    stress: 3,
  });

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    const severe = symptoms.filter(([key]) => formData.get(key) === "on").map(([key]) => key);
    try {
      await logRecovery({
        sleepHours: Number(formData.get("sleepHours")),
        sleepQuality: Number(formData.get("sleepQuality")),
        soreness: Number(formData.get("soreness")),
        fatigue: Number(formData.get("fatigue")),
        motivation: Number(formData.get("motivation")),
        stress: Number(formData.get("stress")),
        restingHr: formData.get("restingHr") ? Number(formData.get("restingHr")) : null,
        hrv: formData.get("hrv") ? Number(formData.get("hrv")) : null,
        notes: String(formData.get("notes") || ""),
        severeSymptoms: [...severe],
      });
      setBlocked(severe.length > 0);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The check-in was not saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className="grid gap-4">
      {blocked ? <SafetyBanner /> : null}
      {defaults?.sourceDay ? (
        <p className="rounded-2xl bg-paper px-3 py-2 text-sm text-muted">
          Sleep, resting heart rate, and HRV start from WHOOP on {defaults.sourceDay}. Edit anything that does not match how you feel.
        </p>
      ) : null}

      <section className="grid gap-3 rounded-2xl border border-line bg-card p-4">
        <div>
          <h3 className="font-bold">Sleep</h3>
          <p className="text-sm text-muted">Hours first, then how restored you feel.</p>
        </div>
        <label>
          Hours asleep
          <input name="sleepHours" inputMode="decimal" required defaultValue={defaults?.sleepHours ?? 7.5} />
        </label>
        <ScalePicker
          name="sleepQuality"
          label="Sleep quality"
          low="Poor"
          high="Excellent"
          value={scores.sleepQuality}
          onChange={(value) => setScores((prev) => ({ ...prev, sleepQuality: value }))}
        />
      </section>

      <section className="grid gap-3 rounded-2xl border border-line bg-card p-4">
        <div>
          <h3 className="font-bold">How you feel</h3>
          <p className="text-sm text-muted">Tap a score from 1 to 5. These drive readiness.</p>
        </div>
        {feelingScales.filter((item) => item.name !== "sleepQuality").map((item) => (
          <ScalePicker
            key={item.name}
            name={item.name}
            label={item.label}
            low={item.low}
            high={item.high}
            value={scores[item.name]}
            invert={item.invert}
            onChange={(value) => setScores((prev) => ({ ...prev, [item.name]: value }))}
          />
        ))}
      </section>

      <section className="grid gap-3 rounded-2xl border border-line bg-card p-4">
        <div>
          <h3 className="font-bold">Body signals</h3>
          <p className="text-sm text-muted">Optional. Use wearable values or type them in.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            Resting heart rate
            <input name="restingHr" inputMode="numeric" placeholder="bpm" defaultValue={defaults?.restingHr ?? ""} />
          </label>
          <label>
            HRV
            <input name="hrv" inputMode="decimal" placeholder="ms" defaultValue={defaults?.hrv ?? ""} />
          </label>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-line bg-card p-4">
        <div>
          <h3 className="font-bold">Stop-training symptoms</h3>
          <p className="text-sm text-muted">Check any that apply. Tamreen will pause training guidance.</p>
        </div>
        <div className="grid gap-2">
          {symptoms.map(([key, label]) => (
            <label key={key} className="rounded-xl bg-paper px-3 py-2 font-medium">
              <input className="h-5 w-5" name={key} type="checkbox" /> {label}
            </label>
          ))}
        </div>
        <label>
          Notes
          <textarea name="notes" placeholder="Anything else that changes today&apos;s training?" />
        </label>
      </section>

      {saved && !blocked ? <p className="text-sm font-semibold text-maroon">Check-in saved. Readiness on Home uses this entry.</p> : null}
      {error ? <p className="text-sm text-live">{error}</p> : null}

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 -mx-1 bg-gradient-to-t from-paper via-paper to-transparent px-1 pb-2 pt-4 md:static md:bg-none md:p-0">
        <button className="btn btn-primary w-full" disabled={pending} type="submit">
          {pending ? "Saving…" : "Save check-in"}
        </button>
      </div>
    </form>
  );
}

function ScalePicker({
  name,
  label,
  low,
  high,
  value,
  onChange,
  invert = false,
}: {
  name: string;
  label: string;
  low: string;
  high: string;
  value: number;
  onChange: (value: number) => void;
  invert?: boolean;
}) {
  const tone = useMemo(() => {
    if (invert) return value <= 2 ? "good" : value === 3 ? "ok" : "low";
    return value >= 4 ? "good" : value === 3 ? "ok" : "low";
  }, [invert, value]);

  return (
    <fieldset className="grid gap-2">
      <legend className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
        <span>{label}</span>
        <span className={cn("metric text-base font-bold", tone === "good" && "text-maroon", tone === "low" && "text-live")}>{value}</span>
      </legend>
      <input type="hidden" name={name} value={value} />
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={cn(
              "min-h-12 rounded-xl border text-sm font-bold transition",
              value === score ? "border-maroon bg-maroon text-white" : "border-line bg-paper text-ink",
            )}
            aria-pressed={value === score}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}
