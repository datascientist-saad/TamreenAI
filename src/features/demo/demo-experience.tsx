"use client";

import { useState } from "react";
import { LIVE_EXERCISES } from "@/services/live/pose";
import {
  adjustedWeek,
  enduranceWorkout,
  originalWeek,
  progressRows,
  sampleAdjustment,
  strengthWorkout,
  type DemoSession,
} from "@/features/demo/fixtures";

export function DemoExperience() {
  const [accepted, setAccepted] = useState<"pending" | "accepted" | "kept">("pending");
  const [selectedId, setSelectedId] = useState("wed-legs");
  const [completedSets, setCompletedSets] = useState<string[]>([]);
  const week = accepted === "accepted" ? adjustedWeek : originalWeek;
  const selected = week.find((session) => session.id === selectedId) ?? week[0];

  function choose(session: DemoSession) {
    setSelectedId(session.id);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6">
      <header className="max-w-3xl">
        <p className="eyebrow">Product preview</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Explore a sample training week</h1>
        <p className="mt-3 text-lg leading-7">
          This demo uses isolated sample data in your browser. It does not create an account, open the camera, or write a session to an athlete record.
        </p>
        <p className="mt-3 inline-flex rounded-full bg-[#f3e6cf] px-3 py-1 text-sm font-bold text-[#3d0e1f]">Sample data</p>
      </header>

      <section className="grid gap-4" aria-labelledby="sample-week">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="sample-week" className="text-2xl font-extrabold">Sample week</h2>
            <p className="text-sm text-muted">5–11 Oct 2026 · strength and endurance together. Every card is sample data.</p>
          </div>
        </div>
        <p className="text-sm">
          Selected sample: {selected.weekday} {selected.date} · {selected.title}. Choosing a day only highlights this preview.
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {week.map((session) => {
            const selectedCard = session.id === selected.id;
            return (
              <button
                key={session.id}
                type="button"
                aria-pressed={selectedCard}
                onClick={() => choose(session)}
                className={`min-w-36 rounded-2xl border px-3 py-3 text-left ${selectedCard ? "border-[#8a1538] bg-[#8a1538] text-white" : "border-line bg-card text-ink"}`}
              >
                <span className="text-xs font-bold uppercase tracking-wide">{session.weekday}</span>
                <span className="mt-1 block font-bold">{session.title}</span>
                <span className={`mt-1 block text-xs ${selectedCard ? "text-[#f6f1f2]" : "text-muted"}`}>
                  {session.kind === "rest" ? "Rest" : `${session.minutes} min`} · Sample data
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-labelledby="sample-workouts">
        <h2 id="sample-workouts" className="sr-only">Sample workouts</h2>
        <article className="app-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Strength</p>
            <span className="rounded-full bg-[#f3e6cf] px-3 py-1 text-xs font-bold text-[#3d0e1f]">Sample data</span>
          </div>
          <h3 className="mt-2 text-2xl font-bold">{strengthWorkout.title}</h3>
          <p className="text-sm text-muted">{strengthWorkout.date}</p>
          <p className="mt-2">{strengthWorkout.purpose}</p>
          <ul className="mt-4 grid gap-2">
            {strengthWorkout.sets.map((set) => {
              const done = completedSets.includes(set.exercise);
              return (
                <li key={set.exercise} className="rounded-2xl border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{set.exercise}</span>
                    <span className="metric text-sm">{set.sets} sets × {set.reps} × {set.weight}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{set.camera}</p>
                  <button
                    type="button"
                    className="btn btn-ghost mt-3"
                    aria-pressed={done}
                    onClick={() => setCompletedSets((current) => current.includes(set.exercise) ? current.filter((item) => item !== set.exercise) : [...current, set.exercise])}
                  >
                    {done ? "Sample set marked" : "Mark sample set"}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm text-muted">Marking a set stays in this preview. It is not saved.</p>
        </article>
        <article className="app-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Endurance</p>
            <span className="rounded-full bg-[#f3e6cf] px-3 py-1 text-xs font-bold text-[#3d0e1f]">Sample data</span>
          </div>
          <h3 className="mt-2 text-2xl font-bold">{enduranceWorkout.title}</h3>
          <p className="text-sm text-muted">{enduranceWorkout.date}</p>
          <p className="mt-2">{enduranceWorkout.purpose}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <SampleStat label="Distance" value={enduranceWorkout.distance} />
            <SampleStat label="Duration" value={enduranceWorkout.duration} />
            <SampleStat label="Perceived effort" value={enduranceWorkout.effort} />
            <SampleStat label="Heart rate" value={enduranceWorkout.heartRate} />
          </dl>
          <p className="mt-3 text-sm text-muted">Perceived effort is a number you report. This sample does not include a heart-rate reading, and no wearable is connected.</p>
        </article>
      </section>

      <section className="app-card border-l-4 border-l-[#8a1538] p-5" aria-labelledby="sample-change">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Proposed adjustment</p>
          <span className="rounded-full bg-[#f3e6cf] px-3 py-1 text-xs font-bold text-[#3d0e1f]">Sample data</span>
        </div>
        <h2 id="sample-change" className="mt-2 text-2xl font-bold">Why this week would change</h2>
        <p className="mt-3 text-lg">{sampleAdjustment}</p>
        <p className="mt-2 text-sm text-muted">
          Illustrative explanation only. It is not a scientifically validated prediction of how you will perform.
        </p>
        <ul className="mt-4 grid gap-2 text-sm">
          <li className="rounded-xl bg-paper px-3 py-2">Wednesday is a lower-body strength session in this sample.</li>
          <li className="rounded-xl bg-paper px-3 py-2">The hard run uses the same legs, so the example moves it to Thursday.</li>
          <li className="rounded-xl bg-paper px-3 py-2">In the signed-in app, a major change waits until you choose Accept changes or Keep original.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => setAccepted("accepted")}>Accept sample change</button>
          <button type="button" className="btn btn-ghost" onClick={() => setAccepted("kept")}>Keep original sample</button>
        </div>
        <p className="mt-3 text-sm" aria-live="polite">
          {accepted === "pending" ? "Nothing is applied yet. These buttons update the sample week on this page only." : null}
          {accepted === "accepted" ? "The sample week now shows the hard run on Thursday. Nothing was written to an athlete record." : null}
          {accepted === "kept" ? "The original sample week stays, with the hard run still on Wednesday. Nothing was written to an athlete record." : null}
        </p>
      </section>

      <section className="app-card p-5" aria-labelledby="live-preview">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Live gym training</p>
          <span className="rounded-full bg-[#f3e6cf] px-3 py-1 text-xs font-bold text-[#3d0e1f]">Demo</span>
        </div>
        <h2 id="live-preview" className="mt-2 text-2xl font-bold">Camera preview stays off</h2>
        <p className="mt-2 max-w-3xl">
          Track repetitions and review movement feedback for supported gym exercises. This preview does not ask for camera permission and does not show a movement score.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-line bg-paper p-6 text-center">
            <div>
              <p className="eyebrow">Camera off</p>
              <p className="mt-2 text-3xl font-extrabold">Squat</p>
              <p className="mt-1 text-sm text-muted">Plan: 4 sets × 5 · Sample data</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-left">
                <SampleStat label="Reps" value="—" />
                <SampleStat label="Form" value="Not measured" />
              </dl>
              <button type="button" className="btn btn-ghost mt-4" disabled>Open camera</button>
              <p className="mt-2 text-sm text-muted">Disabled here. A real session is available after you sign in and choose a supported exercise.</p>
            </div>
          </div>
          <div>
            <h3 className="font-bold">Exercises this build can track</h3>
            <ul className="mt-3 grid gap-2">
              {LIVE_EXERCISES.map((exercise) => (
                <li key={exercise.slug} className="rounded-xl bg-paper px-3 py-2 text-sm">
                  <span className="font-bold">{exercise.name}. </span>
                  <span className="text-muted">{exercise.setup}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="sample-progress">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="sample-progress" className="text-2xl font-extrabold">Progress across sports</h2>
            <p className="text-sm text-muted">Sample data. A dash means the inputs for that metric are missing.</p>
          </div>
          <span className="rounded-full bg-[#f3e6cf] px-3 py-1 text-xs font-bold text-[#3d0e1f]">Sample data</span>
        </div>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {progressRows.map((row) => (
            <li key={row.dimension} className="app-card p-4">
              <div className="flex items-end justify-between gap-3">
                <h3 className="text-xl font-bold">{row.dimension}</h3>
                <span className="metric text-4xl font-bold">{row.score}</span>
              </div>
              <p className="mt-2 text-sm">{row.definition}</p>
              <p className="mt-2 text-sm text-muted">{row.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SampleStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper px-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="metric text-lg font-bold">{value}</dd>
    </div>
  );
}
