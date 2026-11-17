"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, Dumbbell, Footprints, Trophy, Waves } from "lucide-react";
import { TimeFields } from "@/components/time-fields";
import { clockFromParts, parsePaceList } from "@/lib/utils";
import {
  EVENT_CATEGORIES,
  RUNNING_PRESETS,
  TRIATHLON_PRESETS,
  categoryForEventType,
  distancesFromPreset,
  formatDistanceKm,
  type EventCategory,
  type EventPriority,
} from "@/services/events/catalog";
import { createPersonalEvent, recordEventResult, updatePersonalEvent } from "@/server/actions";

type EventFormValues = {
  id?: string;
  name?: string;
  category?: EventCategory;
  preset?: string;
  date?: string;
  location?: string;
  priority?: EventPriority;
  experienceLevel?: string;
  notes?: string;
  status?: "active" | "completed" | "cancelled";
  distanceM?: number | null;
  swimM?: number | null;
  bikeM?: number | null;
  runM?: number | null;
  goalHours?: string;
  goalMinutes?: string;
  goalSeconds?: string;
  eventType?: string;
};

export function PersonalEventForm({ initial }: { initial?: EventFormValues } = {}) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const initialCategory = initial?.category ?? (initial?.eventType ? categoryForEventType(initial.eventType) : "running");
  const [category, setCategory] = useState<EventCategory>(initialCategory);
  const [preset, setPreset] = useState(initial?.preset ?? defaultPreset(initialCategory, initial?.eventType));
  const [swimKm, setSwimKm] = useState(metresToKmInput(initial?.swimM));
  const [bikeKm, setBikeKm] = useState(metresToKmInput(initial?.bikeM));
  const [runKm, setRunKm] = useState(metresToKmInput(initial?.runM ?? initial?.distanceM));
  const [distanceKm, setDistanceKm] = useState(metresToKmInput(initial?.distanceM));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const preview = useMemo(() => distancesFromPreset({
    category,
    preset,
    distanceM: kmToMetres(distanceKm),
    swimM: kmToMetres(swimKm),
    bikeM: kmToMetres(bikeKm),
    runM: kmToMetres(runKm),
  }), [bikeKm, category, distanceKm, preset, runKm, swimKm]);

  function chooseCategory(next: EventCategory) {
    setCategory(next);
    const nextPreset = defaultPreset(next);
    setPreset(nextPreset);
    const distances = distancesFromPreset({ category: next, preset: nextPreset });
    setSwimKm(metresToKmInput(distances.swimM));
    setBikeKm(metresToKmInput(distances.bikeM));
    setRunKm(metresToKmInput(distances.runM));
    setDistanceKm(metresToKmInput(distances.distanceM));
  }

  function choosePreset(next: string) {
    setPreset(next);
    const distances = distancesFromPreset({ category, preset: next });
    setSwimKm(metresToKmInput(distances.swimM));
    setBikeKm(metresToKmInput(distances.bikeM));
    setRunKm(metresToKmInput(distances.runM));
    setDistanceKm(metresToKmInput(distances.distanceM));
  }

  return (
    <form
      className="app-card grid gap-4 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const form = event.currentTarget;
        const formData = new FormData(form);
        const goal = clockFromParts(formData.get("goalHours"), formData.get("goalMinutes"), formData.get("goalSeconds"));
        if (!goal.ok) {
          setError(goal.message);
          return;
        }
        const distances = distancesFromPreset({
          category,
          preset,
          distanceM: kmToMetres(String(formData.get("distanceKm") || distanceKm)),
          swimM: kmToMetres(String(formData.get("swimKm") || swimKm)),
          bikeM: kmToMetres(String(formData.get("bikeKm") || bikeKm)),
          runM: kmToMetres(String(formData.get("runKm") || runKm)),
        });
        setPending(true);
        setError("");
        setMessage("");
        try {
          const payload = {
            name: String(formData.get("name") || ""),
            category,
            preset,
            date: String(formData.get("date") || ""),
            distanceM: distances.distanceM,
            swimM: distances.swimM,
            bikeM: distances.bikeM,
            runM: distances.runM,
            goalTimeSeconds: goal.seconds,
            location: String(formData.get("location") || ""),
            priority: String(formData.get("priority") || "primary") as EventPriority,
            experienceLevel: String(formData.get("experienceLevel") || "") || null,
            notes: String(formData.get("notes") || ""),
            status: String(formData.get("status") || "active") as "active" | "completed" | "cancelled",
          };
          if (editing && initial?.id) {
            const result = await updatePersonalEvent({ id: initial.id, ...payload });
            setMessage(result.proposalCreated
              ? "Event updated. Review proposed plan changes on Home or Plan."
              : "Event updated.");
          } else {
            await createPersonalEvent(payload);
            form.reset();
            setMessage("Event saved. Rebuild your plan to integrate it into one schedule.");
          }
          router.refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "The event was not saved.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="flex items-start gap-2">
        <Trophy size={18} strokeWidth={1.75} className="mt-1 shrink-0 text-maroon" aria-hidden />
        <div>
          <h2 className="font-bold">{editing ? "Edit event" : "Add an event"}</h2>
          <p className="text-sm text-muted">What type of event are you training for?</p>
        </div>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">Event type</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {EVENT_CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`btn min-h-12 justify-start ${category === item.id ? "btn-primary" : "btn-ghost"}`}
              aria-pressed={category === item.id}
              onClick={() => chooseCategory(item.id)}
            >
              <CategoryIcon category={item.id} />
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>

      {category === "running" ? (
        <label>
          Distance preset
          <select value={preset} onChange={(event) => choosePreset(event.target.value)}>
            {RUNNING_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      ) : null}

      {category === "triathlon" ? (
        <label>
          Triathlon preset
          <select value={preset} onChange={(event) => choosePreset(event.target.value)}>
            {TRIATHLON_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      ) : null}

      <label>Event name<input name="name" required defaultValue={initial?.name ?? ""} placeholder="e.g. Doha 70.3" /></label>
      <label>Event date<input name="date" type="date" required defaultValue={initial?.date ?? ""} /></label>

      {category === "triathlon" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className="inline-flex items-center gap-1.5"><Waves size={14} strokeWidth={1.75} aria-hidden /> Swim (km)</span>
            <input name="swimKm" inputMode="decimal" value={swimKm} onChange={(event) => { setSwimKm(event.target.value); setPreset("triathlon_custom"); }} />
          </label>
          <label>
            <span className="inline-flex items-center gap-1.5"><Bike size={14} strokeWidth={1.75} aria-hidden /> Bike (km)</span>
            <input name="bikeKm" inputMode="decimal" value={bikeKm} onChange={(event) => { setBikeKm(event.target.value); setPreset("triathlon_custom"); }} />
          </label>
          <label>
            <span className="inline-flex items-center gap-1.5"><Footprints size={14} strokeWidth={1.75} aria-hidden /> Run (km)</span>
            <input name="runKm" inputMode="decimal" value={runKm} onChange={(event) => { setRunKm(event.target.value); setPreset("triathlon_custom"); }} />
          </label>
        </div>
      ) : category === "strength" ? (
        <p className="rounded-2xl bg-paper px-3 py-2 text-sm text-muted">Strength events use lift practice rather than a race distance.</p>
      ) : (
        <label>
          Distance (km)
          <input
            name="distanceKm"
            inputMode="decimal"
            value={distanceKm}
            onChange={(event) => {
              setDistanceKm(event.target.value);
              if (category === "running") setPreset("running_custom");
            }}
            placeholder="Optional"
          />
        </label>
      )}

      <p className="text-xs text-muted">
        Stored as {formatDistanceKm(preview.distanceM)}
        {preview.swimM || preview.bikeM || preview.runM
          ? ` · swim ${formatDistanceKm(preview.swimM)} · bike ${formatDistanceKm(preview.bikeM)} · run ${formatDistanceKm(preview.runM)}`
          : ""}
      </p>

      <label>
        Priority
        <select name="priority" defaultValue={initial?.priority ?? "primary"}>
          <option value="primary">Primary event</option>
          <option value="secondary">Secondary event</option>
          <option value="practice">Practice event</option>
        </select>
      </label>
      <TimeFields name="goal" legend="Target finish time" />
      <label>
        Experience level
        <select name="experienceLevel" defaultValue={initial?.experienceLevel ?? ""}>
          <option value="">Use profile default</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </label>
      <label>Location (optional)<input name="location" defaultValue={initial?.location ?? ""} /></label>
      <label>Notes<textarea name="notes" defaultValue={initial?.notes ?? ""} placeholder="Course notes, travel, heat, cutoffs…" /></label>
      {editing ? (
        <label>
          Status
          <select name="status" defaultValue={initial?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      ) : null}

      {message ? <p className="text-sm font-semibold text-maroon" role="status">{message}</p> : null}
      {error ? <p className="text-sm text-live" role="alert">{error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : editing ? "Save event changes" : "Save event"}
      </button>
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
      if (pending) return;
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
      {error ? <p className="text-sm text-live" role="alert">{error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>Save result</button>
    </form>
  );
}

function CategoryIcon({ category }: { category: EventCategory }) {
  const props = { size: 16, strokeWidth: 1.75, "aria-hidden": true as const };
  if (category === "running") return <Footprints {...props} />;
  if (category === "triathlon") return <Trophy {...props} />;
  if (category === "cycling") return <Bike {...props} />;
  if (category === "swimming") return <Waves {...props} />;
  if (category === "strength") return <Dumbbell {...props} />;
  return <Trophy {...props} />;
}

function defaultPreset(category: EventCategory, eventType?: string) {
  if (eventType) {
    if (RUNNING_PRESETS.some((row) => row.id === eventType)) return eventType;
    if (TRIATHLON_PRESETS.some((row) => row.id === eventType)) return eventType;
  }
  if (category === "running") return "running_5k";
  if (category === "triathlon") return "sprint_triathlon";
  if (category === "cycling") return "cycling_event";
  if (category === "swimming") return "swimming_event";
  if (category === "strength") return "strength_competition";
  return "custom";
}

function metresToKmInput(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  const km = value / 1000;
  return Number.isInteger(km) ? String(km) : String(Math.round(km * 100) / 100);
}

function kmToMetres(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 1000 * 100) / 100;
}
