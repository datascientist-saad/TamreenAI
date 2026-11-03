"use client";

import { useState } from "react";
import { TimeFields } from "@/components/time-fields";
import type { OnboardingDraft } from "@/lib/onboarding-draft";
import { blankOnboardingDraft } from "@/lib/onboarding-draft";
import { goalGroups, goalOptions, sportGroups, sportLabels, type SportSlug } from "@/lib/sports";
import { clockFromParts, clockParts } from "@/lib/utils";
import { saveOnboarding } from "@/server/actions";

const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayLong = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function readForm(form: HTMLFormElement) {
  const values: Record<string, string> = {};
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea").forEach((control) => {
    if (!control.name || control.disabled) return;
    values[control.name] = control.value;
  });
  return values;
}

function numberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function OnboardingWizard({
  initialStep = 0,
  draft = blankOnboardingDraft(),
}: {
  initialStep?: number;
  draft?: OnboardingDraft;
}) {
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 0), 6));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sportsPicked, setSports] = useState<string[]>(draft.sports);
  const [goalPicked, setGoals] = useState<string[]>(draft.goals.length ? draft.goals : draft.primaryGoal ? [draft.primaryGoal] : []);
  const [primary, setPrimary] = useState(draft.primaryGoal && (draft.goals.includes(draft.primaryGoal) || !draft.goals.length) ? draft.primaryGoal : draft.goals[0] ?? "");
  const [preferred, setPreferred] = useState<number[]>(draft.preferredDays);
  const [training, setTraining] = useState(draft.training);
  const [doubles, setDoubles] = useState<boolean | null>(null);
  const [gym, setGym] = useState(draft.gymAccess);
  const [pool, setPool] = useState(draft.poolAccess);
  const [bike, setBike] = useState(draft.bikeAccess);
  const [redFlag, setRedFlag] = useState(draft.redFlag);
  const five = clockParts(draft.benchmarks.fiveKSeconds);
  const ten = clockParts(draft.benchmarks.tenKSeconds);
  const half = clockParts(draft.benchmarks.halfSeconds);
  const marathon = clockParts(draft.benchmarks.marathonSeconds);
  const swim100 = clockParts(draft.benchmarks.swim100Seconds);
  const swim400 = clockParts(draft.benchmarks.swim400Seconds);
  const goalTime = clockParts(draft.goalTimeSeconds);
  const selectedDays = dayLong.filter((_, index) => preferred.includes(index));
  const selectedSports = sportsPicked.map((slug) => sportLabels[slug as SportSlug] ?? slug);

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  function chooseGoal(slug: string) {
    const selected = goalPicked.includes(slug);
    if (!selected) {
      setGoals([...goalPicked, slug]);
      if (!goalPicked.includes(primary)) setPrimary(slug);
      return;
    }
    if (primary !== slug) {
      setPrimary(slug);
      return;
    }
    const next = goalPicked.filter((item) => item !== slug);
    if (!next.length) return;
    setGoals(next);
    setPrimary(next[0]);
  }

  return (
    <form noValidate className="mx-auto grid max-w-xl gap-4 px-4 py-6" onSubmit={async (event) => {
      event.preventDefault();
      const answers = readForm(event.currentTarget);
      const text = (name: string) => answers[name] ?? "";
      if (step === 0) {
        if (!text("fullName").trim()) {
          setError("Enter your name.");
          return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text("dob"))) {
          setError("Enter your date of birth.");
          return;
        }
        const height = numberOrNull(text("height"));
        const weight = numberOrNull(text("weight"));
        if (height == null || height < 50 || height > 260) {
          setError("Enter your height in centimetres.");
          return;
        }
        if (weight == null || weight < 20 || weight > 400) {
          setError("Enter your weight in kilograms.");
          return;
        }
      }
      if (step < 6) {
        if (step === 1 && sportsPicked.length === 0) {
          setError("Choose at least one sport.");
          return;
        }
        if (step === 2 && goalPicked.length === 0) {
          setError("Choose at least one goal.");
          return;
        }
        if (step === 4 && preferred.length === 0) {
          setError("Choose at least one day you can train.");
          return;
        }
        if (step === 4) {
          const minutes = numberOrNull(text("minutes"));
          if (minutes == null || minutes < 15 || minutes > 360) {
            setError("Enter the minutes you can train, from 15 to 360.");
            return;
          }
        }
        setError("");
        setStep(step + 1);
        return;
      }
      setPending(true);
      setError("");
      const num = (name: string) => numberOrNull(text(name));
      const clock = (name: string, label: string) => {
        const parsed = clockFromParts(text(`${name}Hours`), text(`${name}Minutes`), text(`${name}Seconds`));
        if (!parsed.ok) return parsed.message ? `${label}: ${parsed.message}` : `${label} could not be read.`;
        return parsed.seconds;
      };
      if (preferred.length === 0) {
        setError("Choose at least one day you can train.");
        setPending(false);
        return;
      }
      if (sportsPicked.length === 0) {
        setError("Choose at least one sport.");
        setPending(false);
        return;
      }
      if (goalPicked.length === 0) {
        setError("Choose at least one goal.");
        setPending(false);
        return;
      }
      const height = num("height");
      const weight = num("weight");
      if (!text("fullName").trim() || !/^\d{4}-\d{2}-\d{2}$/.test(text("dob")) || height == null || weight == null) {
        setError("Name, date of birth, height, and weight are still required.");
        setPending(false);
        setStep(0);
        return;
      }
      const minutes = num("minutes");
      if (minutes == null || minutes < 15 || minutes > 360) {
        setError("Enter the minutes you can train, from 15 to 360.");
        setPending(false);
        setStep(4);
        return;
      }
      if (training && (!text("eventName").trim() || !/^\d{4}-\d{2}-\d{2}$/.test(text("eventDate")))) {
        setError("Add the event name and date, or turn the event off.");
        setPending(false);
        return;
      }
      if (doubles === null) {
        setError("Say whether you are comfortable with more than one workout on the same day.");
        setPending(false);
        return;
      }
      const fiveK = clock("fiveK", "5K personal best");
      const tenK = clock("tenK", "10K personal best");
      const halfTime = clock("half", "Half marathon");
      const marathonTime = clock("marathon", "Marathon");
      const swim100Time = clock("swim100", "100 m pace");
      const swim400Time = clock("swim400", "400 m pace");
      const goalTimeSeconds = training ? clock("goalTime", "Goal time") : null;
      const clockError = [fiveK, tenK, halfTime, marathonTime, swim100Time, swim400Time, goalTimeSeconds].find((value) => typeof value === "string");
      if (typeof clockError === "string") {
        setError(clockError);
        setPending(false);
        return;
      }
      const primaryGoal = goalPicked.includes(primary) ? primary : goalPicked[0];
      try {
        const result = await saveOnboarding({
          fullName: text("fullName").trim(),
          dateOfBirth: text("dob"),
          sex: (text("sex") || "prefer_not_to_say") as "female" | "male" | "other" | "prefer_not_to_say",
          heightCm: height,
          weightKg: weight,
          bodyFat: num("bodyFat"),
          experience: (text("experience") || "intermediate") as "beginner" | "intermediate" | "advanced" | "elite",
          sports: sportsPicked as SportSlug[],
          primaryGoal,
          goals: goalPicked.includes(primaryGoal) ? goalPicked : [primaryGoal, ...goalPicked],
          customGoal: text("customGoal"),
          preferredDays: preferred,
          minutesPerDay: minutes,
          multipleSessionsPerDay: doubles === true,
          gymAccess: gym,
          poolAccess: pool,
          bikeAccess: bike,
          injuries: text("injuryArea").trim() ? [{
            status: "current",
            bodyArea: text("injuryArea").trim(),
            description: text("injuryNote"),
            avoid: text("avoid").split(",").map((item) => item.trim()).filter(Boolean),
            severity: (text("severity") || "mild") as "mild" | "moderate" | "severe",
            redFlag,
          }] : [],
          eventId: draft.eventId,
          event: training ? {
            name: text("eventName").trim(),
            eventType: text("eventType") || "race",
            date: text("eventDate"),
            distanceM: num("distance"),
            goalTimeSeconds: goalTimeSeconds as number | null,
          } : null,
          benchmarks: {
            fiveKSeconds: fiveK as number | null,
            tenKSeconds: tenK as number | null,
            halfSeconds: halfTime as number | null,
            marathonSeconds: marathonTime as number | null,
            weeklyRunKm: num("runKm"),
            ftpWatts: num("ftp"),
            weeklyBikeKm: num("bikeKm"),
            swim100Seconds: swim100Time as number | null,
            swim400Seconds: swim400Time as number | null,
            weeklySwimM: num("swimM"),
            squatKg: num("squat"),
            benchKg: num("bench"),
            deadliftKg: num("deadlift"),
          },
        });
        if (!result?.ok) {
          setError(result?.message || "The plan could not be saved.");
          setPending(false);
          return;
        }
        window.location.assign("/plan");
      } catch {
        setError("The plan could not be saved. Try again.");
        setPending(false);
      }
    }}>
      <p className="eyebrow">Step {step + 1} of 7</p>
      <h1 className="text-3xl font-extrabold">{draft.completed ? "Update your training profile." : "Build the athlete model first."}</h1>
      {draft.completed ? <p className="text-sm text-muted">Your saved answers are filled in. Change what you want, then update the plan. Completed workouts stay.</p> : null}
      <div className={step === 0 ? "grid gap-3" : "hidden"}>
          <label>Name<input name="fullName" defaultValue={draft.fullName} /></label>
          <label>Date of birth<input name="dob" type="date" defaultValue={draft.dateOfBirth} /></label>
          <label>Sex, used only for strength reference bands
            <select name="sex" defaultValue={draft.sex}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </label>
          <label>Height (cm)<input name="height" type="number" min={50} max={260} step="0.1" defaultValue={draft.heightCm} /></label>
          <label>Weight (kg)<input name="weight" type="number" min={20} max={400} step="0.1" defaultValue={draft.weightKg} /></label>
          <label>Body fat % optional<input name="bodyFat" type="number" min={2} max={70} step="0.1" defaultValue={draft.bodyFat} /></label>
          <label>Experience
            <select name="experience" defaultValue={draft.experience}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="elite">Elite</option>
            </select>
          </label>
        </div>
      <div className={step === 1 ? "grid gap-4" : "hidden"}>
          <p className="font-bold">Select every sport you train</p>
          <p className="rounded-2xl bg-maroon/10 px-4 py-3 text-sm font-semibold" aria-live="polite">
            {selectedSports.length ? `Selected: ${selectedSports.join(", ")}` : "No sports selected yet."}
          </p>
          {sportGroups.map((group) => (
            <fieldset key={group.label} className="grid grid-cols-2 gap-2">
              <legend className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{group.label}</legend>
              {group.slugs.map((slug) => {
                const on = sportsPicked.includes(slug);
                return (
                  <button key={slug} type="button" aria-pressed={on} className={`btn ${on ? "btn-primary" : "btn-ghost"}`} onClick={() => toggle(sportsPicked, slug, setSports)}>
                    {on ? "Selected · " : ""}{sportLabels[slug]}
                  </button>
                );
              })}
            </fieldset>
          ))}
        </div>
      <div className={step === 2 ? "grid gap-4" : "hidden"}>
          <p className="text-sm text-muted">Tap a goal to include it. Tap a selected goal to make it the primary one.</p>
          <p className="rounded-2xl bg-maroon/10 px-4 py-3 text-sm font-semibold" aria-live="polite">
            {goalPicked.length
              ? `Primary: ${goalOptions.find(([id]) => id === primary)?.[1] ?? primary}. Selected: ${goalPicked.map((slug) => goalOptions.find(([id]) => id === slug)?.[1] ?? slug).join(", ")}`
              : "No goals selected yet."}
          </p>
          {goalGroups.map(([group, slugs]) => (
            <fieldset key={group} className="grid gap-2">
              <legend className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{group}</legend>
              {slugs.map((slug) => {
                const label = goalOptions.find(([id]) => id === slug)?.[1] ?? slug;
                const selected = goalPicked.includes(slug);
                const isPrimary = primary === slug && selected;
                return (
                  <button
                    key={slug}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseGoal(slug)}
                    className={`flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-left text-[0.95rem] font-semibold ${isPrimary ? "border-[#8a1538] bg-[#8a1538] text-white" : selected ? "border-[#8a1538] bg-card text-ink dark:border-[#f3c1cf]" : "border-line bg-card text-ink"}`}
                  >
                    <span>{label}</span>
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em]">
                      {isPrimary ? "Primary" : selected ? "Selected" : null}
                      <span aria-hidden="true" className={`grid h-5 w-5 place-items-center rounded-full border-2 ${isPrimary ? "border-white" : selected ? "border-[#8a1538] dark:border-[#f3c1cf]" : "border-current opacity-40"}`}>
                        {selected ? <span className={`h-2.5 w-2.5 rounded-full ${isPrimary ? "bg-white" : "bg-[#8a1538] dark:bg-[#f3c1cf]"}`} /> : null}
                      </span>
                    </span>
                  </button>
                );
              })}
            </fieldset>
          ))}
          <label>Custom wording<input name="customGoal" defaultValue={draft.customGoal} /></label>
        </div>
      <div className={step === 3 ? "grid gap-3" : "hidden"}>
          <p className="text-sm text-muted">Leave a field blank if you do not know it. Blank means no score, not a guessed score. Saved results stay filled in.</p>
          <div className={sportsPicked.includes("running") || sportsPicked.includes("triathlon") ? "grid gap-3" : "hidden"}>
              <TimeFields name="fiveK" legend="5K personal best" hours={five.hours} minutes={five.minutes} seconds={five.seconds} />
              <TimeFields name="tenK" legend="10K personal best" hours={ten.hours} minutes={ten.minutes} seconds={ten.seconds} />
              <TimeFields name="half" legend="Half marathon" hours={half.hours} minutes={half.minutes} seconds={half.seconds} />
              <TimeFields name="marathon" legend="Marathon" hours={marathon.hours} minutes={marathon.minutes} seconds={marathon.seconds} />
              <label>Weekly run km<input name="runKm" type="number" step="0.1" defaultValue={draft.benchmarks.weeklyRunKm ?? ""} /></label>
          </div>
          <div className={sportsPicked.includes("cycling") || sportsPicked.includes("triathlon") ? "grid gap-3" : "hidden"}>
              <label>FTP watts<input name="ftp" type="number" defaultValue={draft.benchmarks.ftpWatts ?? ""} /></label>
              <label>Weekly bike km<input name="bikeKm" type="number" step="0.1" defaultValue={draft.benchmarks.weeklyBikeKm ?? ""} /></label>
          </div>
          <div className={sportsPicked.includes("swimming") || sportsPicked.includes("triathlon") ? "grid gap-3" : "hidden"}>
              <TimeFields name="swim100" legend="100 m pace" hours={swim100.hours} minutes={swim100.minutes} seconds={swim100.seconds} />
              <TimeFields name="swim400" legend="400 m pace" hours={swim400.hours} minutes={swim400.minutes} seconds={swim400.seconds} />
              <label>Weekly swim metres<input name="swimM" type="number" defaultValue={draft.benchmarks.weeklySwimM ?? ""} /></label>
          </div>
          <div className={sportsPicked.includes("strength") || sportsPicked.includes("bodybuilding") ? "grid gap-3" : "hidden"}>
              <label>Squat kg<input name="squat" type="number" step="0.5" defaultValue={draft.benchmarks.squatKg ?? ""} /></label>
              <label>Bench kg<input name="bench" type="number" step="0.5" defaultValue={draft.benchmarks.benchKg ?? ""} /></label>
              <label>Deadlift kg<input name="deadlift" type="number" step="0.5" defaultValue={draft.benchmarks.deadliftKg ?? ""} /></label>
          </div>
        </div>
      <div className={step === 4 ? "grid gap-3" : "hidden"}>
          <p className="font-bold">Days you can train</p>
          <p className="text-sm text-muted">Selected days are filled in. Open days stay dashed.</p>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Days you can train">
            {dayShort.map((label, index) => {
              const on = preferred.includes(index);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${dayLong[index]}, ${on ? "selected" : "not selected"}`}
                  className={`grid min-h-16 place-items-center rounded-2xl border-2 px-1 text-center ${on ? "border-[#8a1538] bg-[#8a1538] text-white" : "border-dashed border-line bg-card text-muted"}`}
                  onClick={() => setPreferred(on ? preferred.filter((day) => day !== index) : [...preferred, index])}
                >
                  <span className="text-sm font-extrabold">{label}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide">{on ? "Yes" : "No"}</span>
                </button>
              );
            })}
          </div>
          <p className="rounded-2xl bg-maroon/10 px-4 py-3 text-sm font-semibold" aria-live="polite">
            {selectedDays.length ? `Selected ${selectedDays.length} ${selectedDays.length === 1 ? "day" : "days"}: ${selectedDays.join(", ")}` : "No days selected yet. Choose at least one."}
          </p>
          <label>Minutes available each day<input name="minutes" type="number" min={15} max={360} defaultValue={draft.minutesPerDay} /></label>
          <div className="grid gap-2">
            <Choice on={gym} label="Gym" onClick={() => setGym((value) => !value)} />
            <Choice on={pool} label="Pool" onClick={() => setPool((value) => !value)} />
            <Choice on={bike} label="Bike" onClick={() => setBike((value) => !value)} />
          </div>
        </div>
      <div className={step === 5 ? "grid gap-3" : "hidden"}>
          <label>Current injury area<input name="injuryArea" placeholder="Leave blank if none" defaultValue={draft.injuryArea} /></label>
          <label>What should Tamreen avoid?<input name="avoid" placeholder="squat, overhead" defaultValue={draft.avoid} /></label>
          <label>Notes<textarea name="injuryNote" defaultValue={draft.injuryNote} /></label>
          <label>Severity
            <select name="severity" defaultValue={draft.severity}>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
          </label>
          <Choice on={redFlag} label="Severe pain, chest pain, fainting, or another reason to stop training" onClick={() => setRedFlag((value) => !value)} />
        </div>
      <div className={step === 6 ? "grid gap-3" : "hidden"}>
          <fieldset className="grid gap-2">
            <legend className="font-bold">Are you comfortable with more than one workout on the same day?</legend>
            <p className="text-sm text-muted">Yes means some days can have two sessions, so every sport you picked still fits. No means one workout a day, and any sport that does not fit rotates through the plan.</p>
            <Choice on={doubles === true} label="Yes — two workouts on some days" onClick={() => setDoubles(true)} />
            <Choice on={doubles === false} label="No — one workout a day" onClick={() => setDoubles(false)} />
          </fieldset>
          <Choice on={training} label="Are you training for something?" onClick={() => setTraining((value) => !value)} />
          <div className={training ? "grid gap-3" : "hidden"}>
              <label>Event<input name="eventName" defaultValue={draft.eventName} /></label>
              <label>Type<input name="eventType" defaultValue={draft.eventType || "race"} /></label>
              <label>Date<input name="eventDate" type="date" defaultValue={draft.eventDate} /></label>
              <label>Distance metres<input name="distance" type="number" defaultValue={draft.distanceM} /></label>
              <TimeFields name="goalTime" legend="Goal time" hours={goalTime.hours} minutes={goalTime.minutes} seconds={goalTime.seconds} />
          </div>
        </div>
      {error ? <p className="text-sm text-live">{error}</p> : null}
      <div className="flex gap-2">
        {step > 0 ? <button className="btn btn-ghost" type="button" onClick={() => { setError(""); setStep(step - 1); }}>Back</button> : null}
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Creating…" : step === 6 ? (draft.completed ? "Update plan" : "Create with TamreenAI") : "Continue"}</button>
      </div>
    </form>
  );
}

function Choice({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left text-[0.95rem] font-semibold ${on ? "border-[#8a1538] bg-[#8a1538] text-white" : "border-line bg-card text-ink"}`}
    >
      <span>{label}</span>
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em]">
        {on ? "Selected" : "Off"}
        <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-white" : "border-current opacity-40"}`}>
          {on ? <span className="h-2.5 w-2.5 rounded-full bg-white" /> : null}
        </span>
      </span>
    </button>
  );
}
