"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveOnboarding } from "@/server/actions";

const sports = [
  ["strength", "Strength"],
  ["bodybuilding", "Bodybuilding"],
  ["running", "Running"],
  ["cycling", "Cycling"],
  ["swimming", "Swimming"],
  ["triathlon", "Triathlon"],
] as const;

const goals = [
  ["build_muscle", "Build muscle"],
  ["lose_fat", "Lose fat"],
  ["recomposition", "Recomposition"],
  ["increase_strength", "Increase strength"],
  ["improve_5k", "Improve 5K"],
  ["improve_10k", "Improve 10K"],
  ["half_marathon", "Half marathon"],
  ["marathon", "Marathon"],
  ["sprint_triathlon", "Sprint triathlon"],
  ["olympic_triathlon", "Olympic triathlon"],
  ["ironman_70_3", "Ironman 70.3"],
  ["ironman", "Ironman"],
  ["improve_cycling", "Improve cycling"],
  ["improve_swimming", "Improve swimming"],
  ["general_hybrid", "General hybrid fitness"],
  ["custom", "Custom"],
] as const;

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  return (
    <form className="mx-auto grid max-w-xl gap-4 px-4 py-6" onSubmit={async (event) => {
      event.preventDefault();
      if (step < 6) {
        setStep(step + 1);
        return;
      }
      setPending(true);
      setError("");
      const form = new FormData(event.currentTarget);
      const num = (name: string) => {
        const value = String(form.get(name) ?? "");
        return value === "" ? null : Number(value);
      };
      try {
        await saveOnboarding({
          fullName: String(form.get("fullName") ?? ""),
          dateOfBirth: String(form.get("dob") ?? ""),
          sex: String(form.get("sex") ?? "prefer_not_to_say") as "female" | "male" | "other" | "prefer_not_to_say",
          heightCm: Number(form.get("height")),
          weightKg: Number(form.get("weight")),
          bodyFat: num("bodyFat"),
          experience: String(form.get("experience") ?? "intermediate") as "beginner" | "intermediate" | "advanced" | "elite",
          sports: sportsPicked as Array<"strength" | "bodybuilding" | "running" | "cycling" | "swimming" | "triathlon">,
          primaryGoal: primary,
          goals: goalPicked.includes(primary) ? goalPicked : [primary, ...goalPicked],
          customGoal: String(form.get("customGoal") ?? ""),
          preferredDays: preferred,
          minutesPerDay: Number(form.get("minutes") ?? 60),
          gymAccess: form.get("gym") === "on",
          poolAccess: form.get("pool") === "on",
          bikeAccess: form.get("bike") === "on",
          injuries: String(form.get("injuryArea") ?? "").trim() ? [{
            status: "current",
            bodyArea: String(form.get("injuryArea")),
            description: String(form.get("injuryNote") ?? ""),
            avoid: String(form.get("avoid") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
            severity: String(form.get("severity") ?? "mild") as "mild" | "moderate" | "severe",
            redFlag: form.get("redFlag") === "on",
          }] : [],
          event: training ? {
            name: String(form.get("eventName") ?? ""),
            eventType: String(form.get("eventType") ?? "race"),
            date: String(form.get("eventDate") ?? ""),
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
        router.push("/home");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Onboarding could not be saved.");
        setPending(false);
      }
    }}>
      <p className="eyebrow">Step {step + 1} of 7</p>
      <h1 className="text-3xl font-extrabold">Build the athlete model first.</h1>
      {step === 0 ? (
        <div className="grid gap-3">
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
      ) : null}
      {step === 1 ? (
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-2 font-bold">Select every sport you train</legend>
          {sports.map(([slug, label]) => (
            <button key={slug} type="button" className={`btn ${sportsPicked.includes(slug) ? "btn-primary" : "btn-ghost"}`} onClick={() => toggle(sportsPicked, slug, setSports)}>{label}</button>
          ))}
        </fieldset>
      ) : null}
      {step === 2 ? (
        <div className="grid gap-2">
          <p className="font-bold">Choose goals. One is primary.</p>
          {goals.map(([slug, label]) => (
            <label key={slug} className="flex items-center justify-between rounded-xl border border-line px-3 py-2">
              <span>{label}</span>
              <span className="flex gap-3 text-sm">
                <input type="checkbox" checked={goalPicked.includes(slug)} onChange={() => toggle(goalPicked, slug, setGoals)} />
                <input type="radio" name="primary" checked={primary === slug} onChange={() => setPrimary(slug)} />
              </span>
            </label>
          ))}
          <label>Custom wording<input name="customGoal" /></label>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="grid gap-3">
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
      ) : null}
      {step === 4 ? (
        <div className="grid gap-3">
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
      ) : null}
      {step === 5 ? (
        <div className="grid gap-3">
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
      ) : null}
      {step === 6 ? (
        <div className="grid gap-3">
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
      ) : null}
      {error ? <p className="text-sm text-live">{error}</p> : null}
      <div className="flex gap-2">
        {step > 0 ? <button className="btn btn-ghost" type="button" onClick={() => setStep(step - 1)}>Back</button> : null}
        <button className="btn btn-primary" type="submit" disabled={pending}>{step === 6 ? "Save and build plan" : "Continue"}</button>
      </div>
    </form>
  );
}
