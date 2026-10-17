"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TimeFields } from "@/components/time-fields";
import { clockFromParts, parsePaceList } from "@/lib/utils";
import { createPersonalEvent, recordEventResult } from "@/server/actions";

export function PersonalEventForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form className="app-card grid gap-3 p-4" onSubmit={async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const goal = clockFromParts(formData.get("goalHours"), formData.get("goalMinutes"), formData.get("goalSeconds"));
      if (!goal.ok) {
        setError(goal.message);
        return;
      }
      setPending(true);
      setError("");
      try {
        await createPersonalEvent({
          name: String(formData.get("name") || ""),
          eventType: String(formData.get("eventType") || ""),
          date: String(formData.get("date") || ""),
          distanceM: formData.get("distanceM") ? Number(formData.get("distanceM")) : null,
          goalTimeSeconds: goal.seconds,
          location: String(formData.get("location") || ""),
        });
        form.reset();
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The event was not saved.");
      } finally {
        setPending(false);
      }
    }}>
      <h2 className="font-bold">Add an event</h2>
      <label>Name<input name="name" required /></label>
      <label>Type<input name="eventType" placeholder="Ironman 70.3" required /></label>
      <label>Date<input name="date" type="date" required /></label>
      <label>Distance (m)<input name="distanceM" inputMode="decimal" /></label>
      <TimeFields name="goal" legend="Goal time" />
      <label>Location<input name="location" /></label>
      {error ? <p className="text-sm text-live">{error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>Save event</button>
    </form>
  );
}

export function FinishResultForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form className="mt-3 grid gap-2" onSubmit={async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const finish = clockFromParts(formData.get("finishHours"), formData.get("finishMinutes"), formData.get("finishSeconds"));
      if (!finish.ok) {
        setError(finish.message);
        return;
      }
      if (finish.seconds == null) {
        setError("Enter the finish time in hours, minutes, and seconds.");
        return;
      }
      const splits = parsePaceList(String(formData.get("splits") || ""));
      if (!splits.ok) {
        setError(splits.message);
        return;
      }
      setPending(true);
      setError("");
      try {
        await recordEventResult({
          eventId,
          athleteId: String(formData.get("athleteId") || ""),
          finishSeconds: finish.seconds,
          splits: splits.seconds,
        });
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The result was not saved.");
      } finally {
        setPending(false);
      }
    }}>
      <label>Athlete id<input name="athleteId" required /></label>
      <TimeFields name="finish" legend="Finish time" />
      <label>Kilometre splits<input name="splits" placeholder="5:30, 5:28, 5:35" /></label>
      {error ? <p className="text-sm text-live">{error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>Save result</button>
    </form>
  );
}
