"use client";

import { useState } from "react";
import { logRecovery } from "@/server/actions";
import { SafetyBanner } from "@/components/states";

const symptoms = [
  ["chest_pain", "Chest pain"],
  ["fainting", "Fainting"],
  ["severe_pain", "Severe pain"],
  ["shortness_of_breath_at_rest", "Breathless at rest"],
] as const;

export function RecoveryForm() {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [pending, setPending] = useState(false);

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
    <form action={submit} className="grid gap-3">
      {blocked ? <SafetyBanner /> : null}
      <label>How did you sleep? Hours<input name="sleepHours" inputMode="decimal" required defaultValue="7.5" /></label>
      <Scale name="sleepQuality" label="Sleep quality (1 poor, 5 excellent)" />
      <Scale name="soreness" label="How sore are you? (1 fresh, 5 very sore)" />
      <Scale name="fatigue" label="How fatigued do you feel? (1 fresh, 5 exhausted)" />
      <Scale name="motivation" label="How motivated are you? (1 low, 5 high)" />
      <Scale name="stress" label="Stress (1 calm, 5 high)" />
      <label>Resting heart rate<input name="restingHr" inputMode="numeric" /></label>
      <label>HRV<input name="hrv" inputMode="decimal" /></label>
      <fieldset className="grid gap-2">
        <legend className="font-bold">Stop-training symptoms</legend>
        {symptoms.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 font-medium">
            <input className="h-5 w-5" name={key} type="checkbox" /> {label}
          </label>
        ))}
      </fieldset>
      <label>Notes<textarea name="notes" /></label>
      {saved && !blocked ? <p className="text-sm">Check-in saved. Readiness on Home uses this entry.</p> : null}
      {error ? <p className="text-sm text-live">{error}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">Save check-in</button>
    </form>
  );
}

function Scale({ name, label }: { name: string; label: string }) {
  return (
    <label>{label}
      <input name={name} type="range" min="1" max="5" defaultValue="3" />
    </label>
  );
}
