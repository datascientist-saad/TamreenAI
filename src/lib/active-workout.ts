/** Client-side draft for an in-progress strength session. */

const STORAGE_KEY = "tamreen-active-workout";

export type ActiveWorkoutDraft = {
  workoutId: string;
  title: string;
  sport?: string;
  activeIndex: number;
  sets: Array<{
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
  }>;
  updatedAt: string;
};

export function readActiveWorkout(): ActiveWorkoutDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveWorkoutDraft;
    if (!parsed?.workoutId || !Array.isArray(parsed.sets)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeActiveWorkout(draft: ActiveWorkoutDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function clearActiveWorkout(workoutId?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!workoutId) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const current = readActiveWorkout();
    if (!current || current.workoutId === workoutId) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function activeWorkoutHref(draft: ActiveWorkoutDraft): string {
  return `/train/${draft.workoutId}`;
}
