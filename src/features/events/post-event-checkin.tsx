"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeEventCheckIn } from "@/server/actions";

export function PostEventCheckInForm({ eventId, eventName }: { eventId: string; eventName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  return (
    <form
      className="app-card grid gap-3 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const form = event.currentTarget;
        const data = new FormData(form);
        const finishH = Number(data.get("finishHours") || 0);
        const finishM = Number(data.get("finishMinutes") || 0);
        const finishS = Number(data.get("finishSeconds") || 0);
        const hasFinish = finishH > 0 || finishM > 0 || finishS > 0;
        const finishTimeSeconds = hasFinish ? finishH * 3600 + finishM * 60 + finishS : null;
        const distanceKm = String(data.get("actualDistanceKm") || "").trim();
        const symptoms = data.getAll("symptoms").map(String);
        setPending(true);
        setError("");
        setMessage("");
        try {
          const result = await completeEventCheckIn({
            eventId,
            completed: data.get("completed") === "yes",
            completionStatus: String(data.get("completionStatus") || "finished") as "finished" | "dnf" | "dns" | "partial",
            actualDistanceM: distanceKm ? Number(distanceKm) * 1000 : null,
            finishTimeSeconds,
            avgHeartRate: data.get("avgHr") ? Number(data.get("avgHr")) : null,
            perceivedExertion: data.get("rpe") ? Number(data.get("rpe")) : null,
            fatigueLevel: data.get("fatigue") ? Number(data.get("fatigue")) : null,
            muscleSoreness: data.get("soreness") ? Number(data.get("soreness")) : null,
            painOrInjury: data.get("pain") === "on",
            sleepQuality: data.get("sleep") ? Number(data.get("sleep")) : null,
            readyToResume: data.get("ready") === "yes" ? true : data.get("ready") === "no" ? false : null,
            concerningSymptoms: symptoms,
            conditions: String(data.get("conditions") || ""),
            comments: String(data.get("comments") || ""),
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setMessage(
            result.seekCare
              ? "Check-in saved. Please seek appropriate medical guidance before hard training."
              : `Check-in saved. Recovery window ~${result.recoveryDays} days.`,
          );
          router.refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Check-in was not saved.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div>
        <h2 className="font-bold">Post-event check-in</h2>
        <p className="text-sm text-muted">{eventName} — report how it went so recovery can adapt.</p>
      </div>

      <label>
        Did you complete the event?
        <select name="completed" defaultValue="yes" required>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
      <label>
        Completion status
        <select name="completionStatus" defaultValue="finished">
          <option value="finished">Finished</option>
          <option value="partial">Partial</option>
          <option value="dnf">DNF</option>
          <option value="dns">DNS</option>
        </select>
      </label>
      <label>
        Actual distance (km)
        <input name="actualDistanceKm" inputMode="decimal" placeholder="Optional" />
      </label>
      <fieldset className="grid grid-cols-3 gap-2">
        <legend className="text-sm font-semibold">Finish time</legend>
        <label>Hours<input name="finishHours" inputMode="numeric" placeholder="0" /></label>
        <label>Minutes<input name="finishMinutes" inputMode="numeric" placeholder="0" /></label>
        <label>Seconds<input name="finishSeconds" inputMode="numeric" placeholder="0" /></label>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>Difficulty (1–10)<input name="rpe" type="number" min={1} max={10} /></label>
        <label>Fatigue (1–5)<input name="fatigue" type="number" min={1} max={5} /></label>
        <label>Muscle soreness (1–5)<input name="soreness" type="number" min={1} max={5} /></label>
        <label>Sleep quality (1–5)<input name="sleep" type="number" min={1} max={5} /></label>
        <label>Avg heart rate<input name="avgHr" type="number" min={30} max={250} placeholder="Optional" /></label>
        <label>
          Ready to resume?
          <select name="ready" defaultValue="">
            <option value="">Not sure</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="pain" />
        Pain or injury symptoms
      </label>
      <fieldset className="grid gap-1 text-sm">
        <legend className="font-semibold">Concerning symptoms</legend>
        {[
          ["chest_pain", "Chest pain"],
          ["fainting", "Fainting"],
          ["severe_pain", "Severe pain"],
          ["suspected_injury", "Suspected injury"],
          ["shortness_of_breath_at_rest", "Shortness of breath at rest"],
        ].map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input type="checkbox" name="symptoms" value={value} />
            {label}
          </label>
        ))}
      </fieldset>
      <label>Conditions<textarea name="conditions" placeholder="Heat, wind, rain…" /></label>
      <label>Comments<textarea name="comments" placeholder="Optional notes" /></label>
      {message ? <p className="text-sm font-semibold text-maroon" role="status">{message}</p> : null}
      {error ? <p className="text-sm text-live" role="alert">{error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save check-in"}
      </button>
    </form>
  );
}
