"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { goalGroups, goalOptions, sportGroups, sportLabels, type SportSlug } from "@/lib/sports";
import { saveOnboarding } from "@/server/actions";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function collectVisible(form: HTMLFormElement) {
  const values: Record<string, string | boolean> = {};
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea").forEach((control) => {
    if (!control.name || control.closest(".hidden")) return;
    if (control instanceof HTMLInputElement && control.type === "checkbox") values[control.name] = control.checked;
    else values[control.name] = control.value;
  });
  return values;
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sportsPicked, setSports] = useState<string[]>(["running", "strength"]);
  const [goalPicked, setGoals] = useState<string[]>(["general_hybrid"]);
  const [primary, setPrimary] = useState("general_hybrid");
  const [preferred, setPreferred] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [training, setTraining] = useState(false);
  const [saved, setSaved] = useState<Record<string, string | boolean>>({});

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
    <form className="mx-auto grid max-w-xl gap-4 px-4 py-6" onSubmit={async (event) => {
      event.preventDefault();
      const answers = { ...saved, ...collectVisible(event.currentTarget) };
      setSaved(answers);
      if (step < 6) {
        if (step === 1 && sportsPicked.length === 0) {
          setError("Choose at least one sport.");
          return;
        }
        setError("");
        setStep(step + 1);
        return;
      }
      setPending(true);
      setError("");
      const text = (name: string) => {
        const value = answers[name];
        return typeof value === "string" ? value : "";
      };
      const num = (name: string) => {
        const value = text(name).trim();
        if (!value) return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };
      const checked = (name: string) => answers[name] === true;
      try {
        const result = await saveOnboarding({
          fullName: text("fullName"),
          dateOfBirth: text("dob"),
          sex: (text("sex") || "prefer_not_to_say") as "female" | "male" | "other" | "prefer_not_to_say",
          heightCm: num("height") ?? 0,
          weightKg: num("weight") ?? 0,
          bodyFat: num("bodyFat"),
          experience: (text("experience") || "intermediate") as "beginner" | "intermediate" | "advanced" | "elite",
          sports: sportsPicked as SportSlug[],
          primaryGoal: primary,
          goals: goalPicked.includes(primary) ? goalPicked : [primary, ...goalPicked],
          customGoal: text("customGoal"),
          preferredDays: preferred,
          minutesPerDay: num("minutes") ?? 0,
          gymAccess: checked("gym"),
          poolAccess: checked("pool"),
          bikeAccess: checked("bike"),
          injuries: text("injuryArea").trim() ? [{
            status: "current",
            bodyArea: text("injuryArea"),
            description: text("injuryNote"),
            avoid: text("avoid").split(",").map((item) => item.trim()).filter(Boolean),
            severity: (text("severity") || "mild") as "mild" | "moderate" | "severe",
            redFlag: checked("redFlag"),
          }] : [],
          event: training ? {
            name: text("eventName"),
            eventType: text("eventType") || "race",
            date: text("eventDate"),
            distanceM: num("distance"),
            goalTimeSeconds: num("goalTime"),
          } : null,
          benchmarks: {
            fiveKSeconds: num("fiveK"),
            tenKSeconds: num("tenK"),
            halfSeconds: num("half"),
            marathonSeconds: num("marathon"),
            weeklyRunKm: num("runKm"),
            ftpWatts: num("ftp"),
            weeklyBikeKm: num("bikeKm"),
            swim100Seconds: num("swim100"),
            swim400Seconds: num("swim400"),
            weeklySwimM: num("swimM"),
            squatKg: num("squat"),
            benchKg: num("bench"),
            deadliftKg: num("deadlift"),
          },
        });
        if (!result.ok) {
          setError(result.message);
          setPending(false);
          return;
        }
        router.push("/home");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Onboarding could not be saved.");
        setPending(false);
      }
    }}>
      <p className="eyebrow">Step {step + 1} of 7</p>
      <h1 className="text-3xl font-extrabold">Build the athlete model first.</h1>
      <div className={step === 0 ? "grid gap-3" : "hidden"}>
          <label>Name<input name="fullName" required /></label>
          <label>Date of birth<input name="dob" type="date" required /></label>
          <label>Sex, used only for strength reference bands
            <select name="sex" defaultValue="prefer_not_to_say">
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </label>
          <label>Height (cm)<input name="height" type="number" min={50} max={260} required defaultValue={175} /></label>
          <label>Weight (kg)<input name="weight" type="number" min={20} max={400} step="0.1" required defaultValue={75} /></label>
          <label>Body fat % optional<input name="bodyFat" type="number" min={2} max={70} step="0.1" /></label>
          <label>Experience
            <select name="experience" defaultValue="intermediate">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="elite">Elite</option>
            </select>
          </label>
        </div>
      <div className={step === 1 ? "grid gap-4" : "hidden"}>
          <p className="font-bold">Select every sport you train</p>
          {sportGroups.map((group) => (
            <fieldset key={group.label} className="grid grid-cols-2 gap-2">
              <legend className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{group.label}</legend>
              {group.slugs.map((slug) => (
                <button key={slug} type="button" className={`btn ${sportsPicked.includes(slug) ? "btn-primary" : "btn-ghost"}`} onClick={() => toggle(sportsPicked, slug, setSports)}>{sportLabels[slug]}</button>
              ))}
            </fieldset>
          ))}
        </div>
      <div className={step === 2 ? "grid gap-4" : "hidden"}>
          <p className="text-sm text-muted">Tap a goal to include it. Tap a selected goal to make it the primary one.</p>
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
                      {isPrimary ? "Primary" : null}
                      <span aria-hidden="true" className={`grid h-5 w-5 place-items-center rounded-full border-2 ${isPrimary ? "border-white" : selected ? "border-[#8a1538] dark:border-[#f3c1cf]" : "border-current opacity-40"}`}>
                        {selected ? <span className={`h-2.5 w-2.5 rounded-full ${isPrimary ? "bg-white" : "bg-[#8a1538] dark:bg-[#f3c1cf]"}`} /> : null}
                      </span>
                    </span>
                  </button>
                );
              })}
            </fieldset>
          ))}
          <label>Custom wording<input name="customGoal" /></label>
        </div>
      <div className={step === 3 ? "grid gap-3" : "hidden"}>
          <p className="text-sm text-muted">Leave a field blank if you do not know it. Blank means no score, not a guessed score.</p>
          {(sportsPicked.includes("running") || sportsPicked.includes("triathlon")) ? (
            <>
              <label>5K PB seconds<input name="fiveK" type="number" /></label>
              <label>10K PB seconds<input name="tenK" type="number" /></label>
              <label>Half marathon seconds<input name="half" type="number" /></label>
              <label>Marathon seconds<input name="marathon" type="number" /></label>
              <label>Weekly run km<input name="runKm" type="number" step="0.1" /></label>
            </>
          ) : null}
          {(sportsPicked.includes("cycling") || sportsPicked.includes("triathlon")) ? (
            <>
              <label>FTP watts<input name="ftp" type="number" /></label>
              <label>Weekly bike km<input name="bikeKm" type="number" step="0.1" /></label>
            </>
          ) : null}
          {(sportsPicked.includes("swimming") || sportsPicked.includes("triathlon")) ? (
            <>
              <label>100m pace seconds<input name="swim100" type="number" /></label>
              <label>400m pace seconds<input name="swim400" type="number" /></label>
              <label>Weekly swim metres<input name="swimM" type="number" /></label>
            </>
          ) : null}
          {(sportsPicked.includes("strength") || sportsPicked.includes("bodybuilding")) ? (
            <>
              <label>Squat kg<input name="squat" type="number" step="0.5" /></label>
              <label>Bench kg<input name="bench" type="number" step="0.5" /></label>
              <label>Deadlift kg<input name="deadlift" type="number" step="0.5" /></label>
            </>
          ) : null}
        </div>
      <div className={step === 4 ? "grid gap-3" : "hidden"}>
          <p className="font-bold">Days you can train</p>
          <div className="flex flex-wrap gap-2">
            {days.map((label, index) => (
              <button key={label} type="button" className={`btn ${preferred.includes(index) ? "btn-primary" : "btn-ghost"}`} onClick={() => setPreferred(preferred.includes(index) ? preferred.filter((day) => day !== index) : [...preferred, index])}>{label}</button>
            ))}
          </div>
          <label>Minutes available each day<input name="minutes" type="number" min={15} max={360} defaultValue={60} /></label>
          <label className="flex items-center gap-2"><input name="gym" type="checkbox" defaultChecked /> Gym</label>
          <label className="flex items-center gap-2"><input name="pool" type="checkbox" /> Pool</label>
          <label className="flex items-center gap-2"><input name="bike" type="checkbox" /> Bike</label>
        </div>
      <div className={step === 5 ? "grid gap-3" : "hidden"}>
          <label>Current injury area<input name="injuryArea" placeholder="Leave blank if none" /></label>
          <label>What should Tamreen avoid?<input name="avoid" placeholder="squat, overhead" /></label>
          <label>Notes<textarea name="injuryNote" /></label>
          <label>Severity
            <select name="severity" defaultValue="mild">
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
          </label>
          <label className="flex items-center gap-2"><input name="redFlag" type="checkbox" /> Severe pain, chest pain, fainting, or another reason to stop training</label>
        </div>
      <div className={step === 6 ? "grid gap-3" : "hidden"}>
          <label className="flex items-center gap-2"><input type="checkbox" checked={training} onChange={(event) => setTraining(event.target.checked)} /> Are you training for something?</label>
          {training ? (
            <>
              <label>Event<input name="eventName" required /></label>
              <label>Type<input name="eventType" defaultValue="triathlon" /></label>
              <label>Date<input name="eventDate" type="date" required /></label>
              <label>Distance metres<input name="distance" type="number" /></label>
              <label>Goal time seconds<input name="goalTime" type="number" /></label>
            </>
          ) : null}
        </div>
      {error ? <p className="text-sm text-live">{error}</p> : null}
      <div className="flex gap-2">
        {step > 0 ? <button className="btn btn-ghost" type="button" onClick={() => setStep(step - 1)}>Back</button> : null}
        <button className="btn btn-primary" type="submit" disabled={pending}>{step === 6 ? "Save and build plan" : "Continue"}</button>
      </div>
    </form>
  );
}
