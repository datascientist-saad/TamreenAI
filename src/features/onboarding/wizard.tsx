"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveOnboarding } from "@/server/actions";
import { goals, sports } from "./schema";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function OnboardingWizard({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(initialName);
  const [picked, setPicked] = useState<string[]>(["running", "strength"]);
  const [goal, setGoal] = useState("general_hybrid");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [experience, setExperience] = useState<"beginner" | "intermediate" | "advanced" | "elite">("intermediate");
  const [preferred, setPreferred] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [minutes, setMinutes] = useState(60);
  const [gym, setGym] = useState(true);
  const [pool, setPool] = useState(false);
  const [bike, setBike] = useState(false);
  const [equipmentTouched, setEquipmentTouched] = useState(false);

  function toggleSport(slug: string) {
    setPicked((current) => (current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]));
  }

  function next() {
    setError("");
    if (step === 0) {
      if (!name.trim()) {
        setError("Add your name.");
        return;
      }
      if (!picked.length) {
        setError("Choose at least one sport.");
        return;
      }
      if ((eventName.trim() && !eventDate) || (!eventName.trim() && eventDate)) {
        setError("Add both the event name and the date, or leave both blank.");
        return;
      }
      if (!equipmentTouched) {
        const swim = picked.includes("swimming") || picked.includes("triathlon");
        const cycle = picked.includes("cycling") || picked.includes("triathlon");
        setPool(swim);
        setBike(cycle);
      }
      setStep(1);
      return;
    }
    if (!preferred.length) {
      setError("Choose at least one training day.");
      return;
    }
    if (minutes < 15 || minutes > 360) {
      setError("Minutes per day need to be between 15 and 360.");
      return;
    }
    setStep(2);
  }

  const goalLabel = goals.find(([slug]) => slug === goal)?.[1] ?? goal;
  const sportLabels = sports.filter(([slug]) => picked.includes(slug)).map(([, label]) => label);

  return (
    <div className="mx-auto grid w-full max-w-lg gap-5 px-4 py-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Step {step + 1} of 3</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          {step === 0 ? "What are you training for?" : step === 1 ? "When can you train?" : "Generate the plan"}
        </h1>
      </div>
      {step === 0 ? (
        <div className="grid gap-4">
          <label>Name
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
          </label>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="mb-2 font-bold">Sports</legend>
            {sports.map(([slug, label]) => (
              <button key={slug} type="button" className={`btn min-h-11 ${picked.includes(slug) ? "btn-primary" : "btn-ghost"}`} onClick={() => toggleSport(slug)} aria-pressed={picked.includes(slug)}>{label}</button>
            ))}
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="font-bold">Primary goal</legend>
            {goals.map(([slug, label]) => (
              <label key={slug} className="flex min-h-11 items-center justify-between rounded-2xl border border-line px-3 py-2 font-medium">
                <span>{label}</span>
                <input type="radio" name="goal" checked={goal === slug} onChange={() => setGoal(slug)} />
              </label>
            ))}
          </fieldset>
          <label>Event name, optional
            <input value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder="Leave blank if you are not racing" />
          </label>
          <label>Event date
            <input value={eventDate} onChange={(event) => setEventDate(event.target.value)} type="date" />
          </label>
        </div>
      ) : null}
      {step === 1 ? (
        <div className="grid gap-4">
          <label>Experience
            <select value={experience} onChange={(event) => setExperience(event.target.value as typeof experience)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="elite">Elite</option>
            </select>
          </label>
          <div>
            <p className="mb-2 font-bold">Days</p>
            <div className="flex flex-wrap gap-2">
              {dayLabels.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={`btn min-h-11 min-w-14 ${preferred.includes(index) ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setPreferred((current) => (current.includes(index) ? current.filter((day) => day !== index) : [...current, index].sort()))}
                  aria-pressed={preferred.includes(index)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label>Minutes each day
            <input value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} type="number" min={15} max={360} />
          </label>
          <label className="flex min-h-11 items-center gap-3 font-medium">
            <input type="checkbox" checked={gym} onChange={(event) => { setEquipmentTouched(true); setGym(event.target.checked); }} /> Gym
          </label>
          <label className="flex min-h-11 items-center gap-3 font-medium">
            <input type="checkbox" checked={bike} onChange={(event) => { setEquipmentTouched(true); setBike(event.target.checked); }} /> Bike
          </label>
          <label className="flex min-h-11 items-center gap-3 font-medium">
            <input type="checkbox" checked={pool} onChange={(event) => { setEquipmentTouched(true); setPool(event.target.checked); }} /> Pool
          </label>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="grid gap-3 text-sm">
          <dl className="divide-y divide-line border-y border-line">
            <Row label="Name" value={name.trim()} />
            <Row label="Sports" value={sportLabels.join(", ")} />
            <Row label="Goal" value={goalLabel} />
            <Row label="Event" value={eventName.trim() ? `${eventName.trim()} · ${eventDate}` : "None. Progress uses the current block."} />
            <Row label="Schedule" value={`${preferred.length} days · ${minutes} min`} />
            <Row label="Equipment" value={[gym ? "Gym" : null, bike ? "Bike" : null, pool ? "Pool" : null].filter(Boolean).join(", ") || "None selected"} />
          </dl>
          <p className="text-muted">Tamreen rules place the sessions. When a server key is configured, the coaching model rewrites the explanation only. Benchmarks and injuries can be added later. Chest pain, fainting, severe pain, or breathlessness at rest are reasons to stop and get care.</p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-live">{error}</p> : null}
      <div className="flex gap-2">
        {step > 0 ? <button className="btn btn-ghost min-h-11" type="button" onClick={() => { setError(""); setStep(step - 1); }}>Back</button> : null}
        {step < 2 ? (
          <button className="btn btn-primary min-h-11 flex-1" type="button" onClick={next}>Continue</button>
        ) : (
          <button
            className="btn btn-primary min-h-11 flex-1"
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await saveOnboarding({
                  fullName: name.trim(),
                  experience,
                  sports: picked as Array<"strength" | "bodybuilding" | "running" | "cycling" | "swimming" | "triathlon">,
                  primaryGoal: goal,
                  goals: [goal],
                  preferredDays: preferred,
                  minutesPerDay: minutes,
                  gymAccess: gym,
                  poolAccess: pool,
                  bikeAccess: bike,
                  event: eventName.trim() && eventDate ? {
                    name: eventName.trim(),
                    eventType: goal,
                    date: eventDate,
                    distanceM: null,
                    goalTimeSeconds: null,
                  } : null,
                });
                router.push("/home");
                router.refresh();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "The plan could not be saved.");
                setPending(false);
              }
            }}
          >
            {pending ? "Building the plan" : "Generate plan"}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
