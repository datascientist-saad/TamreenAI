"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clockToSeconds, emptyClock, type ClockParts } from "@/lib/clock";
import { formatClock } from "@/lib/utils";
import { saveOnboarding } from "@/server/actions";
import { goals, sports } from "./schema";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const goalGroups = [
  ["Strength", ["build_muscle", "lose_fat", "recomposition", "increase_strength"]],
  ["Running", ["improve_5k", "improve_10k", "half_marathon", "marathon"]],
  ["Triathlon", ["sprint_triathlon", "olympic_triathlon", "ironman_70_3", "ironman"]],
  ["Other", ["improve_cycling", "improve_swimming", "general_hybrid", "custom"]],
] as const;

export function OnboardingWizard({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(initialName);
  const [picked, setPicked] = useState<string[]>(["running", "strength"]);
  const [goal, setGoal] = useState("general_hybrid");
  const [customGoal, setCustomGoal] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [experience, setExperience] = useState<"beginner" | "intermediate" | "advanced" | "elite">("intermediate");
  const [preferred, setPreferred] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [minutes, setMinutes] = useState(60);
  const [gym, setGym] = useState(true);
  const [pool, setPool] = useState(false);
  const [bike, setBike] = useState(false);
  const [equipmentTouched, setEquipmentTouched] = useState(false);
  const [marks, setMarks] = useState({
    fiveK: emptyClock(),
    tenK: emptyClock(),
    half: emptyClock(),
    marathon: emptyClock(),
    swim100: emptyClock(),
    swim400: emptyClock(),
    weeklyRunKm: "",
    weeklyBikeKm: "",
    weeklySwimM: "",
    ftp: "",
    squat: "",
    bench: "",
    deadlift: "",
  });

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
    const clockError = markError();
    if (clockError) {
      setError(clockError);
      return;
    }
    setStep(2);
  }

  const goalLabel = goals.find(([slug]) => slug === goal)?.[1] ?? goal;
  const sportLabels = sports.filter(([slug]) => picked.includes(slug)).map(([, label]) => label);
  const runs = picked.includes("running") || picked.includes("triathlon");
  const rides = picked.includes("cycling") || picked.includes("triathlon");
  const swims = picked.includes("swimming") || picked.includes("triathlon");
  const lifts = picked.includes("strength") || picked.includes("bodybuilding");

  function setClock(key: "fiveK" | "tenK" | "half" | "marathon" | "swim100" | "swim400", next: ClockParts) {
    setMarks((current) => ({ ...current, [key]: next }));
  }

  function markError() {
    const clocks: Array<[ClockParts, boolean, string]> = [];
    if (runs) {
      clocks.push([marks.fiveK, false, "5K"], [marks.tenK, false, "10K"], [marks.half, true, "Half marathon"], [marks.marathon, true, "Marathon"]);
    }
    if (swims) clocks.push([marks.swim100, false, "100 m swim"], [marks.swim400, false, "400 m swim"]);
    for (const [parts, withHours, label] of clocks) {
      const result = clockToSeconds(parts, withHours);
      if ("error" in result) return `${label}: ${result.error}`;
    }
    return null;
  }

  function benchmarks() {
    const payload: Record<string, number> = {};
    const clocks: Array<[ClockParts, boolean, string]> = [
      [marks.fiveK, false, "fiveKSeconds"],
      [marks.tenK, false, "tenKSeconds"],
      [marks.half, true, "halfSeconds"],
      [marks.marathon, true, "marathonSeconds"],
      [marks.swim100, false, "swim100Seconds"],
      [marks.swim400, false, "swim400Seconds"],
    ];
    for (const [parts, withHours, key] of clocks) {
      const result = clockToSeconds(parts, withHours);
      if ("seconds" in result && result.seconds) payload[key] = result.seconds;
    }
    const numbers: Array<[string, string]> = [
      ["weeklyRunKm", marks.weeklyRunKm],
      ["weeklyBikeKm", marks.weeklyBikeKm],
      ["weeklySwimM", marks.weeklySwimM],
      ["ftpWatts", marks.ftp],
      ["squatKg", marks.squat],
      ["benchKg", marks.bench],
      ["deadliftKg", marks.deadlift],
    ];
    for (const [key, raw] of numbers) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const value = Number(trimmed);
      if (value > 0) payload[key] = value;
    }
    return Object.keys(payload).length ? payload : undefined;
  }

  function markSummary() {
    const lines: string[] = [];
    const clocks: Array<[ClockParts, boolean, string]> = [];
    if (runs) clocks.push([marks.fiveK, false, "5K"], [marks.tenK, false, "10K"], [marks.half, true, "Half"], [marks.marathon, true, "Marathon"]);
    if (swims) clocks.push([marks.swim100, false, "100 m"], [marks.swim400, false, "400 m"]);
    for (const [parts, withHours, label] of clocks) {
      const result = clockToSeconds(parts, withHours);
      if ("seconds" in result && result.seconds) lines.push(`${label} ${formatClock(result.seconds)}`);
    }
    return lines.join(" · ");
  }

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
          <fieldset className="grid gap-4">
            <legend className="font-bold">Primary goal</legend>
            {goalGroups.map(([group, slugs]) => (
              <div key={group} className="grid gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{group}</p>
                {slugs.map((slug) => {
                  const label = goals.find(([id]) => id === slug)?.[1] ?? slug;
                  return (
                    <ChoiceRow key={slug} selected={goal === slug} onClick={() => setGoal(slug)}>
                      {label}
                    </ChoiceRow>
                  );
                })}
              </div>
            ))}
          </fieldset>
          {goal === "custom" ? (
            <label>Custom goal
              <input value={customGoal} onChange={(event) => setCustomGoal(event.target.value)} maxLength={160} placeholder="Name the goal" />
            </label>
          ) : null}
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
          <div className="grid gap-2">
            <p className="font-bold">Equipment</p>
            <ChoiceRow selected={gym} onClick={() => { setEquipmentTouched(true); setGym((value) => !value); }}>Gym</ChoiceRow>
            <ChoiceRow selected={bike} onClick={() => { setEquipmentTouched(true); setBike((value) => !value); }}>Bike</ChoiceRow>
            <ChoiceRow selected={pool} onClick={() => { setEquipmentTouched(true); setPool((value) => !value); }}>Pool</ChoiceRow>
          </div>
          {runs || rides || swims || lifts ? (
            <div className="grid gap-4">
              <div>
                <p className="font-bold">Personal bests</p>
                <p className="mt-1 text-sm text-muted">Optional. Use minutes and seconds, and add hours for a half or marathon. Leave a race blank if you do not know it. A blank is not a score.</p>
              </div>
              {runs ? (
                <>
                  <TimeEntry label="5K" withHours={false} value={marks.fiveK} onChange={(next) => setClock("fiveK", next)} />
                  <TimeEntry label="10K" withHours={false} value={marks.tenK} onChange={(next) => setClock("tenK", next)} />
                  <TimeEntry label="Half marathon" withHours value={marks.half} onChange={(next) => setClock("half", next)} />
                  <TimeEntry label="Marathon" withHours value={marks.marathon} onChange={(next) => setClock("marathon", next)} />
                  <label>Weekly running, km
                    <input inputMode="decimal" value={marks.weeklyRunKm} onChange={(event) => setMarks((current) => ({ ...current, weeklyRunKm: event.target.value }))} placeholder="Leave blank if unknown" />
                  </label>
                </>
              ) : null}
              {rides ? (
                <>
                  <label>FTP, watts
                    <input inputMode="numeric" value={marks.ftp} onChange={(event) => setMarks((current) => ({ ...current, ftp: event.target.value }))} placeholder="Leave blank if unknown" />
                  </label>
                  <label>Weekly cycling, km
                    <input inputMode="decimal" value={marks.weeklyBikeKm} onChange={(event) => setMarks((current) => ({ ...current, weeklyBikeKm: event.target.value }))} placeholder="Leave blank if unknown" />
                  </label>
                </>
              ) : null}
              {swims ? (
                <>
                  <TimeEntry label="100 m swim" withHours={false} value={marks.swim100} onChange={(next) => setClock("swim100", next)} />
                  <TimeEntry label="400 m swim" withHours={false} value={marks.swim400} onChange={(next) => setClock("swim400", next)} />
                  <label>Weekly swimming, metres
                    <input inputMode="numeric" value={marks.weeklySwimM} onChange={(event) => setMarks((current) => ({ ...current, weeklySwimM: event.target.value }))} placeholder="Leave blank if unknown" />
                  </label>
                </>
              ) : null}
              {lifts ? (
                <>
                  <label>Squat, kg
                    <input inputMode="decimal" value={marks.squat} onChange={(event) => setMarks((current) => ({ ...current, squat: event.target.value }))} placeholder="Leave blank if unknown" />
                  </label>
                  <label>Bench, kg
                    <input inputMode="decimal" value={marks.bench} onChange={(event) => setMarks((current) => ({ ...current, bench: event.target.value }))} placeholder="Leave blank if unknown" />
                  </label>
                  <label>Deadlift, kg
                    <input inputMode="decimal" value={marks.deadlift} onChange={(event) => setMarks((current) => ({ ...current, deadlift: event.target.value }))} placeholder="Leave blank if unknown" />
                  </label>
                </>
              ) : null}
            </div>
          ) : null}
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
            <Row label="Marks" value={markSummary() || "None entered"} />
          </dl>
          <p className="text-muted">Tamreen rules place the sessions. When a server key is configured, the coaching model rewrites the explanation only. Injuries can be added later. Chest pain, fainting, severe pain, or breathlessness at rest are reasons to stop and get care.</p>
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
                  customGoal,
                  benchmarks: benchmarks(),
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

function TimeEntry({
  label,
  withHours,
  value,
  onChange,
}: {
  label: string;
  withHours: boolean;
  value: ClockParts;
  onChange: (next: ClockParts) => void;
}) {
  const units = withHours
    ? [["hours", "hr"], ["minutes", "min"], ["seconds", "sec"]] as const
    : [["minutes", "min"], ["seconds", "sec"]] as const;
  return (
    <fieldset className="grid gap-2">
      <legend className="font-semibold">{label}</legend>
      <div className={`grid gap-2 ${withHours ? "grid-cols-3" : "grid-cols-2"}`}>
        {units.map(([key, unit]) => (
          <label key={key} className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            {unit}
            <input
              inputMode="numeric"
              value={value[key]}
              placeholder="—"
              aria-label={`${label} ${unit}`}
              onChange={(event) => onChange({ ...value, [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ChoiceRow({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-left text-[0.95rem] font-semibold ${selected ? "border-[#8a1538] bg-[#8a1538] text-white" : "border-line bg-card text-ink"}`}
    >
      <span>{children}</span>
      <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-white" : "border-current opacity-40"}`}>
        {selected ? <span className="h-2.5 w-2.5 rounded-full bg-white" /> : null}
      </span>
    </button>
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
