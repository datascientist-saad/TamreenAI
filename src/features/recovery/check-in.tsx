"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Brain,
  Droplets,
  HeartPulse,
  Moon,
  Scale,
  Wind,
} from "lucide-react";
import { SafetyBanner } from "@/components/states";
import { logRecovery } from "@/server/actions";
import { cn } from "@/lib/utils";

const symptoms = [
  ["chest_pain", "Chest pain"],
  ["fainting", "Fainting"],
  ["severe_pain", "Severe pain"],
  ["shortness_of_breath_at_rest", "Breathless at rest"],
] as const;

type CheckInDefaults = {
  sleepHours?: number | null;
  sleepQuality?: number | null;
  soreness?: number | null;
  fatigue?: number | null;
  motivation?: number | null;
  stress?: number | null;
  restingHr?: number | null;
  hrv?: number | null;
  notes?: string | null;
  loggedOn?: string | null;
  sourceDay?: string | null;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  vo2Max?: number | null;
  sleepScore?: number | null;
};

export function RecoveryForm({ defaults }: { defaults?: CheckInDefaults } = {}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [pending, setPending] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({
    sleepQuality: defaults?.sleepQuality ?? 3,
    soreness: defaults?.soreness ?? 3,
    fatigue: defaults?.fatigue ?? 3,
    motivation: defaults?.motivation ?? 3,
    stress: defaults?.stress ?? 3,
    energy: 3,
    mood: 3,
    wellbeing: 3,
  });

  async function submit(formData: FormData) {
    if (pending) return;
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
        notes: [
          String(formData.get("notes") || "").trim(),
          formData.get("painNote") ? `Discomfort: ${String(formData.get("painNote")).trim()}` : "",
          `Mood ${scores.mood}/5 · Energy ${scores.energy}/5 · Wellbeing ${scores.wellbeing}/5`,
        ].filter(Boolean).join("\n"),
        severeSymptoms: [...severe],
      });
      setBlocked(severe.length > 0);
      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The check-in was not saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className="grid gap-4">
      {blocked ? <SafetyBanner /> : null}
      {defaults?.loggedOn ? (
        <p className="rounded-2xl bg-paper px-3 py-2 text-sm text-muted" role="status">
          Editing today&apos;s check-in from {defaults.loggedOn}. Saving updates the same day — it does not create a duplicate.
        </p>
      ) : null}
      {defaults?.sourceDay ? (
        <p className="rounded-2xl bg-paper px-3 py-2 text-sm text-muted">
          Sleep, resting heart rate, and HRV start from WHOOP on {defaults.sourceDay}. Edit anything that does not match how you feel.
        </p>
      ) : null}

      <Section icon={Scale} title="Body metrics" hint="Optional. Previous values shown when available.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            Weight (kg)
            <input name="weightKg" inputMode="decimal" placeholder={defaults?.weightKg == null ? "—" : String(defaults.weightKg)} disabled />
            <span className="text-xs font-medium text-muted">Update under Fitness metrics for trends.</span>
          </label>
          <label>
            Body fat %
            <input name="bodyFatPct" inputMode="decimal" placeholder={defaults?.bodyFatPct == null ? "—" : String(defaults.bodyFatPct)} disabled />
            <span className="text-xs font-medium text-muted">Shown for context only.</span>
          </label>
        </div>
      </Section>

      <Section icon={Moon} title="Recovery" hint="Tap 1–5. These drive readiness.">
        <label>
          Hours asleep
          <input name="sleepHours" inputMode="decimal" required defaultValue={defaults?.sleepHours ?? 7.5} />
        </label>
        <ScalePicker name="sleepQuality" label="Sleep quality" low="Poor" high="Excellent" value={scores.sleepQuality} onChange={(value) => setScores((prev) => ({ ...prev, sleepQuality: value }))} />
        <ScalePicker name="soreness" label="Muscle soreness" low="Fresh" high="Very sore" value={scores.soreness} invert onChange={(value) => setScores((prev) => ({ ...prev, soreness: value }))} />
        <ScalePicker name="fatigue" label="Fatigue" low="Fresh" high="Exhausted" value={scores.fatigue} invert onChange={(value) => setScores((prev) => ({ ...prev, fatigue: value }))} />
        <ScalePicker name="stress" label="Perceived stress" low="Calm" high="High" value={scores.stress} invert onChange={(value) => setScores((prev) => ({ ...prev, stress: value }))} />
        <ScalePicker name="energy" label="Energy level" low="Low" high="High" value={scores.energy} onChange={(value) => setScores((prev) => ({ ...prev, energy: value }))} />
      </Section>

      <Section icon={HeartPulse} title="Health metrics" hint="Optional. Manual or wearable.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="inline-flex items-center gap-1.5"><HeartPulse size={14} strokeWidth={1.75} aria-hidden /> Resting heart rate</span>
            <input name="restingHr" inputMode="numeric" placeholder="bpm" defaultValue={defaults?.restingHr ?? ""} />
          </label>
          <label>
            <span className="inline-flex items-center gap-1.5"><Activity size={14} strokeWidth={1.75} aria-hidden /> HRV</span>
            <input name="hrv" inputMode="decimal" placeholder="ms" defaultValue={defaults?.hrv ?? ""} />
          </label>
          <label>
            <span className="inline-flex items-center gap-1.5"><Wind size={14} strokeWidth={1.75} aria-hidden /> VO₂ max</span>
            <input name="vo2Max" inputMode="decimal" placeholder={defaults?.vo2Max == null ? "—" : String(defaults.vo2Max)} disabled />
            <span className="text-xs font-medium text-muted">Edit under Fitness metrics.</span>
          </label>
          <label>
            <span className="inline-flex items-center gap-1.5"><Droplets size={14} strokeWidth={1.75} aria-hidden /> Sleep score</span>
            <input name="sleepScore" inputMode="numeric" placeholder={defaults?.sleepScore == null ? "—" : String(defaults.sleepScore)} disabled />
            <span className="text-xs font-medium text-muted">From wearable when connected.</span>
          </label>
        </div>
      </Section>

      <Section icon={Brain} title="Subjective feedback" hint="Optional. Helps adaptive scheduling.">
        <ScalePicker name="mood" label="Mood" low="Low" high="Great" value={scores.mood} onChange={(value) => setScores((prev) => ({ ...prev, mood: value }))} />
        <ScalePicker name="motivation" label="Training motivation" low="Low" high="High" value={scores.motivation} onChange={(value) => setScores((prev) => ({ ...prev, motivation: value }))} />
        <ScalePicker name="wellbeing" label="General wellbeing" low="Low" high="High" value={scores.wellbeing} onChange={(value) => setScores((prev) => ({ ...prev, wellbeing: value }))} />
        <label>
          Pain or discomfort
          <input name="painNote" placeholder="Optional — area and severity" defaultValue="" />
        </label>
        <label>
          Notes
          <textarea name="notes" placeholder="Anything else that changes today's training?" defaultValue={defaults?.notes ?? ""} />
        </label>
      </Section>

      <Section icon={HeartPulse} title="Stop-training symptoms" hint="Check any that apply. Tamreen pauses guidance.">
        <div className="grid gap-2">
          {symptoms.map(([key, label]) => (
            <label key={key} className="rounded-xl bg-paper px-3 py-2 font-medium">
              <input className="h-5 w-5" name={key} type="checkbox" /> {label}
            </label>
          ))}
        </div>
      </Section>

      {saved && !blocked ? <p className="text-sm font-semibold text-maroon" role="status">Check-in saved. Home readiness and Body refresh automatically.</p> : null}
      {error ? <p className="text-sm text-live" role="alert">{error}</p> : null}

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-30 -mx-1 bg-gradient-to-t from-paper via-paper to-transparent px-1 pb-2 pt-4 md:static md:z-auto md:bg-none md:p-0">
        <button className="btn btn-primary w-full" disabled={pending} aria-busy={pending} type="submit">
          {pending ? "Saving…" : saved ? "Saved · Update again" : "Save check-in"}
        </button>
      </div>
    </form>
  );
}

function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Moon;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start gap-2">
        <Icon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-maroon" aria-hidden />
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="text-sm text-muted">{hint}</p>
        </div>
      </div>
      {children}
    </section>
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
              "min-h-12 rounded-xl border text-sm font-bold transition active:scale-95",
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
