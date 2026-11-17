"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Timer } from "lucide-react";
import { displayToKg, kgToDisplay } from "@/lib/utils";
import { PostWorkoutFeedback, feedbackFromForm } from "@/features/training/post-workout-feedback";
import { logStrength } from "@/server/actions";

export interface LoggerExercise {
  id: string | null;
  name: string;
  sets: number;
  reps: string;
  why: string;
  last: { weightKg: number; reps: number } | null;
}

interface DraftSet {
  exerciseName: string;
  exerciseId: string | null;
  reps: number;
  weightKg: number;
  rpe: number | null;
  rir: number | null;
  restSeconds: number | null;
  tempo: string | null;
  warmup: boolean;
  notes: string;
}

export function StrengthLogger({
  workoutId,
  title,
  exercises,
  weightUnit,
}: {
  workoutId: string | null;
  title: string;
  exercises: LoggerExercise[];
  weightUnit: "kg" | "lb";
}) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [sets, setSets] = useState<DraftSet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const volume = useMemo(
    () => sets.reduce((sum, set) => sum + (set.warmup ? 0 : set.reps * set.weightKg), 0),
    [sets],
  );
  const active = exercises[activeIndex] ?? exercises[0];
  const doneForActive = sets.filter((set) => set.exerciseName === active?.name && !set.warmup).length;
  const recommended = active?.last
    ? Math.round((active.last.weightKg * 1.025) / 2.5) * 2.5
    : null;

  function addSet(formData: FormData) {
    const name = String(formData.get("exercise") || active?.name || "");
    const exercise = exercises.find((item) => item.name === name) ?? exercises[0];
    const displayWeight = Number(formData.get("weight") || 0);
    const reps = Number(formData.get("reps") || 0);
    if (!exercise || !Number.isFinite(reps) || reps <= 0) return;
    setSets((current) => [
      ...current,
      {
        exerciseName: exercise.name,
        exerciseId: exercise.id,
        reps,
        weightKg: Math.round(displayToKg(displayWeight, weightUnit) * 10) / 10,
        rpe: formData.get("rpe") ? Number(formData.get("rpe")) : null,
        rir: formData.get("rir") ? Number(formData.get("rir")) : null,
        restSeconds: formData.get("rest") ? Number(formData.get("rest")) : null,
        tempo: String(formData.get("tempo") || "") || null,
        warmup: formData.get("warmup") === "on",
        notes: String(formData.get("notes") || ""),
      },
    ]);
  }

  async function save(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const feedback = feedbackFromForm(formData);
      await logStrength({
        workoutId,
        title,
        rpe: Number(formData.get("sessionRpe") || feedback.difficulty || 7),
        fatigue: Number(formData.get("fatigue") || 5),
        notes: String(formData.get("sessionNotes") || ""),
        sets,
        completedAsPlanned: feedback.completedAsPlanned,
        fatigueAfter: feedback.fatigueAfter,
        painReported: feedback.painReported,
        athleteFeedback: feedback.athleteFeedback,
      });
      router.push("/records");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The session was not saved.");
      setPending(false);
    }
  }

  if (!active) return null;

  return (
    <div className="grid gap-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {exercises.map((exercise, index) => {
          const logged = sets.some((set) => set.exerciseName === exercise.name && !set.warmup);
          return (
            <button
              key={exercise.name}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={
                index === activeIndex
                  ? "btn btn-primary btn-sm shrink-0"
                  : "btn btn-ghost btn-sm shrink-0"
              }
            >
              {logged ? <Check size={14} strokeWidth={2} aria-hidden /> : null}
              {index + 1}. {exercise.name}
            </button>
          );
        })}
      </div>

      <article className="app-card grid gap-3 p-4">
        <div>
          <p className="eyebrow">Current exercise</p>
          <h2 className="mt-1 text-xl font-bold">{active.name}</h2>
          <p className="metric mt-1 text-sm text-muted">
            Target {active.sets} × {active.reps}
            {active.last ? ` · Last ${kgToDisplay(active.last.weightKg, weightUnit)} × ${active.last.reps}` : ""}
          </p>
          {recommended != null ? (
            <p className="mt-1 text-sm">
              Suggested <span className="metric font-bold">{kgToDisplay(recommended, weightUnit)}</span>
              <span className="text-muted"> (+2.5% from last working set)</span>
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-elevated px-3 py-2 text-sm">
          <Timer size={16} className="text-maroon" strokeWidth={1.75} aria-hidden />
          <span className="font-semibold">{doneForActive}/{active.sets} working sets logged</span>
        </div>

        {active.why ? (
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-muted">Coach note</summary>
            <p className="mt-1 text-sm text-muted">{active.why}</p>
          </details>
        ) : null}
      </article>

      <form action={addSet} className="app-card grid gap-3 p-4 sm:grid-cols-2">
        <input type="hidden" name="exercise" value={active.name} />
        <label>Weight ({weightUnit})
          <input name="weight" inputMode="decimal" required defaultValue={recommended != null ? String(kgToDisplay(recommended, weightUnit)) : undefined} />
        </label>
        <label>Reps
          <input name="reps" inputMode="numeric" required defaultValue={String(Number.parseInt(active.reps, 10) || "")} />
        </label>
        <label>RPE<input name="rpe" inputMode="decimal" placeholder="1–10" /></label>
        <label>Rest (sec)<input name="rest" inputMode="numeric" placeholder="90" /></label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input className="h-5 w-5" name="warmup" type="checkbox" />
          Warm-up set
        </label>
        <button className="btn btn-primary sm:col-span-2" type="submit">Log set</button>
      </form>

      {sets.length ? (
        <ul className="app-card divide-y divide-line">
          {sets.map((set, index) => (
            <li key={`${set.exerciseName}-${index}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="min-w-0 truncate">
                {set.warmup ? "WU" : `Set`} · {set.exerciseName}
              </span>
              <span className="metric shrink-0 font-bold">
                {kgToDisplay(set.weightKg, weightUnit)} × {set.reps}
                {set.rpe ? ` @${set.rpe}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="caption">Working volume {Math.round(volume)} kg (stored in kg).</p>

      {!finishing ? (
        <button
          className="btn btn-ghost"
          type="button"
          disabled={sets.length === 0}
          onClick={() => setFinishing(true)}
        >
          Finish session
        </button>
      ) : (
        <form action={save} className="app-card grid gap-3 p-4">
          <h3 className="section-title">Finish {title}</h3>
          <label>Session RPE<input name="sessionRpe" defaultValue="7" inputMode="decimal" /></label>
          <label>Fatigue (1–10)<input name="fatigue" defaultValue="5" inputMode="decimal" /></label>
          <label>Notes<textarea name="sessionNotes" /></label>
          <PostWorkoutFeedback />
          {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={pending || sets.length === 0} aria-busy={pending} type="submit">
              {pending ? "Saving…" : "Save session"}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setFinishing(false)}>Keep logging</button>
          </div>
        </form>
      )}
    </div>
  );
}
