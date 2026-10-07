"use client";

import { useState } from "react";
import { moveWorkout, setWorkoutStatus } from "@/server/actions";

export function WorkoutControls({ id, date }: { id: string; date: string }) {
  const [warning, setWarning] = useState<string | null>(null);
  const [nextDate, setNextDate] = useState(date);
  const [error, setError] = useState<string | null>(null);

  async function move(confirm: boolean) {
    setError(null);
    try {
      const result = await moveWorkout(id, nextDate, confirm);
      if (!result.ok) {
        setWarning(result.conflicts.map((conflict) => `${conflict.title}. ${conflict.explanation}`).join(" "));
        return;
      }
      setWarning(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The workout was not moved.");
    }
  }

  async function status(next: "skipped" | "missed" | "completed") {
    setError(null);
    try {
      await setWorkoutStatus(id, next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status was not saved.");
    }
  }

  return (
    <div className="mt-3 grid gap-2">
      <div className="flex flex-wrap gap-2">
        <input className="max-w-40" type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} />
        <button className="btn btn-ghost" type="button" onClick={() => move(false)}>Move</button>
        <button className="btn btn-ghost" type="button" onClick={() => status("missed")}>Missed</button>
        <button className="btn btn-ghost" type="button" onClick={() => status("skipped")}>Skip</button>
      </div>
      {warning ? (
        <div className="rounded-xl border border-live/40 bg-live/10 p-3 text-sm">
          <p className="font-bold">Training conflict detected</p>
          <p className="mt-1">{warning}</p>
          <button className="btn btn-primary mt-3" type="button" onClick={() => move(true)}>Move anyway</button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-live">{error}</p> : null}
    </div>
  );
}
