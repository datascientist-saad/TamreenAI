"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logRide, logRun, logSwim } from "@/server/actions";

function useSave() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return { error, pending, setError, setPending };
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function RunForm({ workoutId, title }: { workoutId: string | null; title: string }) {
  const router = useRouter();
  const state = useSave();
  async function submit(formData: FormData) {
    state.setPending(true);
    state.setError(null);
    const splits = String(formData.get("splits") || "")
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((part) => part > 0);
    try {
      const result = await logRun({
        workoutId,
        title: String(formData.get("title") || title),
        sessionType: String(formData.get("sessionType") || "easy"),
        distanceM: Number(formData.get("distanceM")),
        durationSeconds: Number(formData.get("durationSeconds")),
        avgHr: numberOrNull(formData.get("avgHr")),
        hrStart: numberOrNull(formData.get("hrStart")),
        hrEnd: numberOrNull(formData.get("hrEnd")),
        cadence: numberOrNull(formData.get("cadence")),
        elevationM: numberOrNull(formData.get("elevationM")),
        splits,
        rpe: Number(formData.get("rpe") || 5),
        notes: String(formData.get("notes") || ""),
      });
      router.push(`/runs/${result.id}`);
    } catch (caught) {
      state.setError(caught instanceof Error ? caught.message : "The run was not saved.");
      state.setPending(false);
    }
  }
  return (
    <form action={submit} className="grid gap-3">
      <label>Title<input name="title" defaultValue={title} required /></label>
      <label>Type
        <select name="sessionType" defaultValue="easy">
          {["easy", "recovery", "long", "tempo", "threshold", "intervals", "vo2", "race", "brick"].map((type) => <option key={type}>{type}</option>)}
        </select>
      </label>
      <label>Distance (metres)<input name="distanceM" inputMode="decimal" required /></label>
      <label>Duration (seconds)<input name="durationSeconds" inputMode="numeric" required /></label>
      <label>Average heart rate<input name="avgHr" inputMode="numeric" /></label>
      <label>Heart rate at start<input name="hrStart" inputMode="numeric" /></label>
      <label>Heart rate at finish<input name="hrEnd" inputMode="numeric" /></label>
      <label>Cadence<input name="cadence" inputMode="numeric" /></label>
      <label>Elevation (m)<input name="elevationM" inputMode="decimal" /></label>
      <label>Splits, seconds per km, comma separated<input name="splits" placeholder="330, 328, 335" /></label>
      <label>RPE<input name="rpe" defaultValue="5" inputMode="decimal" /></label>
      <label>Notes<textarea name="notes" /></label>
      {state.error ? <p className="text-sm text-live">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={state.pending} type="submit">Save run</button>
    </form>
  );
}

export function RideForm({ workoutId, title }: { workoutId: string | null; title: string }) {
  const router = useRouter();
  const state = useSave();
  async function submit(formData: FormData) {
    state.setPending(true);
    state.setError(null);
    try {
      await logRide({
        workoutId,
        title: String(formData.get("title") || title),
        sessionType: String(formData.get("sessionType") || "endurance"),
        distanceM: Number(formData.get("distanceM")),
        durationSeconds: Number(formData.get("durationSeconds")),
        avgPower: numberOrNull(formData.get("avgPower")),
        normalizedPower: numberOrNull(formData.get("normalizedPower")),
        ftp: numberOrNull(formData.get("ftp")),
        cadence: numberOrNull(formData.get("cadence")),
        avgHr: numberOrNull(formData.get("avgHr")),
        elevationM: numberOrNull(formData.get("elevationM")),
        rpe: Number(formData.get("rpe") || 5),
        notes: String(formData.get("notes") || ""),
      });
      router.push("/analytics?metric=cycling");
      router.refresh();
    } catch (caught) {
      state.setError(caught instanceof Error ? caught.message : "The ride was not saved.");
      state.setPending(false);
    }
  }
  return (
    <form action={submit} className="grid gap-3">
      <label>Title<input name="title" defaultValue={title} required /></label>
      <label>Type
        <select name="sessionType" defaultValue="endurance">
          {["endurance", "tempo", "sweet_spot", "threshold", "vo2", "recovery", "brick"].map((type) => <option key={type}>{type}</option>)}
        </select>
      </label>
      <label>Distance (metres)<input name="distanceM" inputMode="decimal" required /></label>
      <label>Duration (seconds)<input name="durationSeconds" inputMode="numeric" required /></label>
      <label>Average power<input name="avgPower" inputMode="numeric" /></label>
      <label>Normalized power<input name="normalizedPower" inputMode="numeric" /></label>
      <label>FTP (watts)<input name="ftp" inputMode="numeric" /></label>
      <label>Cadence<input name="cadence" inputMode="numeric" /></label>
      <label>Heart rate<input name="avgHr" inputMode="numeric" /></label>
      <label>Elevation (m)<input name="elevationM" inputMode="decimal" /></label>
      <label>RPE<input name="rpe" defaultValue="5" /></label>
      <label>Notes<textarea name="notes" /></label>
      {state.error ? <p className="text-sm text-live">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={state.pending} type="submit">Save ride</button>
    </form>
  );
}

export function SwimForm({ workoutId, title }: { workoutId: string | null; title: string }) {
  const router = useRouter();
  const state = useSave();
  async function submit(formData: FormData) {
    state.setPending(true);
    state.setError(null);
    try {
      await logSwim({
        workoutId,
        title: String(formData.get("title") || title),
        sessionType: String(formData.get("sessionType") || "endurance"),
        distanceM: Number(formData.get("distanceM")),
        durationSeconds: Number(formData.get("durationSeconds")),
        laps: numberOrNull(formData.get("laps")),
        strokeRate: numberOrNull(formData.get("strokeRate")),
        strokeCount: numberOrNull(formData.get("strokeCount")),
        swolf: numberOrNull(formData.get("swolf")),
        rpe: Number(formData.get("rpe") || 5),
        notes: String(formData.get("notes") || ""),
      });
      router.push("/analytics?metric=swimming");
      router.refresh();
    } catch (caught) {
      state.setError(caught instanceof Error ? caught.message : "The swim was not saved.");
      state.setPending(false);
    }
  }
  return (
    <form action={submit} className="grid gap-3">
      <label>Title<input name="title" defaultValue={title} required /></label>
      <label>Type
        <select name="sessionType" defaultValue="endurance">
          {["technique", "endurance", "threshold", "speed", "open_water"].map((type) => <option key={type}>{type}</option>)}
        </select>
      </label>
      <label>Distance (metres)<input name="distanceM" inputMode="decimal" required /></label>
      <label>Duration (seconds)<input name="durationSeconds" inputMode="numeric" required /></label>
      <label>Laps<input name="laps" inputMode="numeric" /></label>
      <label>Stroke rate<input name="strokeRate" inputMode="numeric" /></label>
      <label>Stroke count<input name="strokeCount" inputMode="numeric" /></label>
      <label>SWOLF<input name="swolf" inputMode="decimal" /></label>
      <label>RPE<input name="rpe" defaultValue="5" /></label>
      <label>Notes<textarea name="notes" /></label>
      {state.error ? <p className="text-sm text-live">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={state.pending} type="submit">Save swim</button>
    </form>
  );
}
