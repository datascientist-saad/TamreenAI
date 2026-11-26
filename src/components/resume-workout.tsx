"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Play } from "lucide-react";
import { activeWorkoutHref, clearActiveWorkout, readActiveWorkout, type ActiveWorkoutDraft } from "@/lib/active-workout";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("tamreen-active-workout", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("tamreen-active-workout", onStoreChange);
  };
}

function getSnapshot(): ActiveWorkoutDraft | null {
  const draft = readActiveWorkout();
  return draft && draft.sets.length > 0 ? draft : null;
}

function getServerSnapshot(): ActiveWorkoutDraft | null {
  return null;
}

export function ResumeWorkoutBanner({ className }: { className?: string }) {
  const draft = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!draft) return null;

  return (
    <div className={className ?? "app-card flex flex-wrap items-center justify-between gap-3 border-l-2 border-l-maroon p-4"}>
      <div className="min-w-0">
        <p className="eyebrow">In progress</p>
        <p className="font-bold">{draft.title}</p>
        <p className="caption">{draft.sets.length} set{draft.sets.length === 1 ? "" : "s"} logged</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className="btn btn-primary btn-sm" href={activeWorkoutHref(draft)}>
          <Play size={14} strokeWidth={1.75} aria-hidden />
          Resume workout
        </Link>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (!window.confirm("Discard this in-progress workout? Logged sets that are not saved will be lost.")) return;
            clearActiveWorkout(draft.workoutId);
            window.dispatchEvent(new Event("tamreen-active-workout"));
          }}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

export function useActiveWorkoutId(): string | null {
  const draft = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return draft?.workoutId ?? null;
}
