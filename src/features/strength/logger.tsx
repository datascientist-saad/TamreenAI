"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { displayToKg, kgToDisplay } from "@/lib/utils";
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
  const [sets, setSets] = useState<DraftSet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const volume = useMemo(
    () => sets.reduce((sum, set) => sum + (set.warmup ? 0 : set.reps * set.weightKg), 0),
    [sets],
  );

  function addSet(formData: FormData) {
    const name = String(formData.get("exercise") || "");
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
      await logStrength({
        workoutId,
        title,
        rpe: Number(formData.get("sessionRpe") || 7),
        fatigue: Number(formData.get("fatigue") || 5),
        notes: String(formData.get("sessionNotes") || ""),
        sets,
      });
      router.push("/records");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The session was not saved.");
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      {exercises.map((exercise) => {
        const recommended = exercise.last
          ? Math.round((exercise.last.weightKg * 1.025) / 2.5) * 2.5
          : null;
        return (
          <article key={exercise.name} className="app-card p-4">
            <h2 className="text-xl font-bold">{exercise.name}</h2>
            <p className="text-sm text-muted">{exercise.sets} sets · {exercise.reps} reps</p>
            {exercise.last ? (
              <p className="mt-2 text-sm">
                Last session: <span className="metric font-bold">{kgToDisplay(exercise.last.weightKg, weightUnit)} × {exercise.last.reps}</span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">No earlier set is stored for this lift.</p>
            )}
            {recommended != null ? (
              <p className="text-sm">
                Recommended: <span className="metric font-bold">{kgToDisplay(recommended, weightUnit)} × {exercise.last?.reps}</span>
                <span className="block text-muted">A 2.5% step from the last working set, rounded to 2.5 kg. It is a progression suggestion, not a tested maximum.</span>
              </p>
            ) : null}
            {exercise.why ? (
              <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-sm">
                <span className="font-bold">Why Tamreen chose this. </span>
                {exercise.why}
              </p>
            ) : null}
          </article>
        );
      })}
      <form action={addSet} className="app-card grid gap-3 p-4 md:grid-cols-2">
        <label>Exercise
          <select name="exercise" defaultValue={exercises[0]?.name}>
            {exercises.map((exercise) => <option key={exercise.name}>{exercise.name}</option>)}
          </select>
        </label>
        <label>Weight ({weightUnit})<input name="weight" inputMode="decimal" required /></label>
        <label>Reps<input name="reps" inputMode="numeric" required /></label>
        <label>RPE<input name="rpe" inputMode="decimal" placeholder="1–10" /></label>
        <label>RIR<input name="rir" inputMode="decimal" placeholder="reps in reserve" /></label>
        <label>Rest (sec)<input name="rest" inputMode="numeric" /></label>
        <label>Tempo<input name="tempo" placeholder="3-1-1" /></label>
        <label className="flex items-center gap-2">Warm-up set<input className="h-5 w-5" name="warmup" type="checkbox" /></label>
        <label className="md:col-span-2">Set note<input name="notes" /></label>
        <button className="btn btn-ghost" type="submit">Add set</button>
      </form>
      <ul className="grid gap-2">
        {sets.map((set, index) => (
          <li key={`${set.exerciseName}-${index}`} className="app-card flex items-center justify-between px-4 py-3 text-sm">
            <span>{set.warmup ? "Warm-up" : `Set ${index + 1}`} · {set.exerciseName}</span>
            <span className="metric">{kgToDisplay(set.weightKg, weightUnit)} × {set.reps}{set.rpe ? ` @ ${set.rpe}` : ""}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">Working volume {Math.round(volume)} kg. Volume stays in kilograms in the database.</p>
      <form action={save} className="grid gap-3">
        <label>Session RPE<input name="sessionRpe" defaultValue="7" inputMode="decimal" /></label>
        <label>Fatigue (1–10)<input name="fatigue" defaultValue="5" inputMode="decimal" /></label>
        <label>Notes<textarea name="sessionNotes" /></label>
        {error ? <p className="text-sm text-live">{error}</p> : null}
        <button className="btn btn-primary" disabled={pending || sets.length === 0} type="submit">{pending ? "Saving" : "Save strength session"}</button>
      </form>
    </div>
  );
}
