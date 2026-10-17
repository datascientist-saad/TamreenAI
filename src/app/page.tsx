import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/brand";
import { PublicHeader } from "@/components/public-header";
import { LIVE_EXERCISES } from "@/services/live/pose";

export const metadata: Metadata = {
  description: "Personalized strength and endurance plans that account for your combined workload, with connected workout tracking and camera-supported gym feedback.",
};

const journey = [
  ["Select your setup", "Choose sports, goals, experience, the days you can train, and the equipment you have."],
  ["Review one calendar", "Strength, running, cycling, and swimming sit on the same plan instead of four separate ones."],
  ["Complete and log workouts", "Record sets, reps, and weight in the gym, or distance, duration, and perceived effort for endurance."],
  ["Review progress", "See progress within each sport and across the whole week. A score stays blank when its inputs are missing."],
  ["Review a proposed change", "Suggestions use completed sessions, missed workouts, and fatigue you report in a check-in. A major schedule change waits until you accept it."],
];

const examples = [
  {
    title: "After a missed workout",
    body: "The long run was missed. Tamreen proposes a shorter easy run and moves the heavy lower-body session off that day, so the missed distance is not pasted onto the same legs.",
  },
  {
    title: "A hard run and leg training",
    body: "Your hard run moved to Thursday to allow more recovery after Wednesday’s lower-body strength session.",
  },
  {
    title: "Why this workout is scheduled",
    body: "Upper-body strength is on Monday because it does not compete with the key run later in the week. The workout note says what the session is for.",
  },
];

export default function LandingPage() {
  return (
    <div className="overflow-x-clip bg-paper text-ink">
      <PublicHeader />
      <main id="content">
        <section className="bg-[#3d0e1f] bg-gradient-to-b from-[#3d0e1f] to-[#4a1228] px-4 pb-20 pt-14 text-white sm:px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mx-auto w-fit overflow-hidden rounded-3xl shadow-lg">
              <Mark size={112} />
            </div>
            <p className="eyebrow-on-dark mt-6">Plan · Train · Adapt</p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl">TAMREEN AI</h1>
            <p className="mx-auto mt-4 max-w-2xl text-xl font-semibold text-[#f6f1f2] sm:text-2xl">One athlete. Multiple sports. One intelligent training system.</p>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#f6f1f2] sm:text-lg">
              Personalized strength and endurance plans that account for your combined workload, with connected workout tracking and camera-supported gym feedback.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link className="btn btn-primary" href="/signup">Start training</Link>
              <Link className="btn btn-gold" href="/demo">Explore demo</Link>
              <a className="btn btn-on-dark" href="#how">See how it works</a>
            </div>
          </div>
          <nav aria-label="On this page" className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-bold text-[#f6f1f2]">
            <a className="underline decoration-white underline-offset-4" href="#problem">Problem</a>
            <a className="underline decoration-white underline-offset-4" href="#how">How it works</a>
            <a className="underline decoration-white underline-offset-4" href="#pilot">Initial pilot</a>
            <a className="underline decoration-white underline-offset-4" href="#features">Features</a>
            <a className="underline decoration-white underline-offset-4" href="#examples">Examples</a>
            <a className="underline decoration-white underline-offset-4" href="#qatar">Qatar</a>
          </nav>
        </section>

        <section id="problem" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <p className="eyebrow">The problem</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Separate plans miss how sessions affect each other.</h2>
          <p className="mt-4 text-lg leading-8">
            A demanding leg session can reduce performance in the next hard run. Separate plans often miss that interaction.
          </p>
          <p className="mt-3 leading-7 text-muted">
            Tamreen coordinates sessions around your goals, the days you can train, and the fatigue you report. Running intensity can change when lower-body strength is placed, and a missed workout can change what is proposed next. It does not read a wearable or claim a lab measure of recovery.
          </p>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight">From setup to a change you can accept</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-2">
            {journey.map(([title, body], index) => (
              <li key={title} className="app-card p-5">
                <p className="eyebrow">Step {index + 1}</p>
                <h3 className="mt-2 text-xl font-bold">{title}</h3>
                <p className="mt-2 leading-7 text-muted">{body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">
            An event date, if you add one, sets the plan length and taper. Fatigue in a proposal comes from your check-in, on a 1–5 scale, not from a device.
          </p>
        </section>

        <section id="pilot" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="eyebrow">Initial pilot</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">What the first pilot is for</h2>
          <p className="mt-3 max-w-3xl leading-7 text-muted">
            These are targets for a three-month build and pilot. They are not current participants, partnerships, or measured results.
          </p>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            <PilotItem title="Primary combination" body="Strength and running are the main pairing. Plans account for how a hard run and lower-body strength affect each other." />
            <PilotItem title="Cycling and swimming" body="Both can be planned and logged now. In the pilot they stay at basic planning and session logging." />
            <PilotItem title="Camera feedback" body="Camera analysis targets 3–5 selected gym exercises, and only after validation. The app can track a longer list, which is not the same as a validated result." />
            <PilotItem title="Who it is for" body="Recruitment targets are 20–30 athletes and 1–2 partner gyms." />
          </ul>
        </section>

        <section id="features" className="mx-auto grid max-w-6xl gap-4 px-4 pb-8 sm:px-6">
          <div className="max-w-3xl">
            <p className="eyebrow">Features</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">What you can do with it</h2>
            <p className="mt-3 leading-7 text-muted">Labels match what the product does today, what the pilot is scoping, and what is not connected yet.</p>
          </div>
          <article className="app-card p-6">
            <Status label="Available now" />
            <h3 className="mt-3 text-2xl font-bold">Live training</h3>
            <p className="mt-2 text-lg">Track repetitions and review movement feedback for supported gym exercises.</p>
            <p className="mt-3 text-sm leading-6 text-muted">
              This build can track {LIVE_EXERCISES.map((exercise) => exercise.name).join(", ")}. A score appears only when the body stays visible. It is a 2D camera estimate, not a lab or medical measurement. Other movements, such as face pulls, lat pulldowns, and calf raises, are logged as sets without a camera score.
            </p>
            <p className="mt-3 text-sm leading-6">
              <Status label="Initial pilot" />
              <span className="mt-2 block text-muted">Validation during the pilot targets 3–5 of those exercises. Until that work is done, a score is feedback from the camera model, not a claimed accuracy figure.</span>
            </p>
            <details className="mt-4 rounded-2xl border border-line p-4">
              <summary className="cursor-pointer font-bold">Camera position and limits</summary>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted">
                {LIVE_EXERCISES.map((exercise) => (
                  <li key={exercise.slug}><span className="font-bold text-ink">{exercise.name}. </span>{exercise.setup}</li>
                ))}
                <li>The public demo does not open a camera and does not show a movement score.</li>
                <li>If the body leaves the frame, no form score is invented. You can still count repetitions yourself.</li>
              </ul>
            </details>
          </article>
          <div className="grid gap-4 md:grid-cols-2">
            <Feature
              status="Available now"
              title="AI coach"
              body="Understand why a workout is scheduled and what should change when your week changes."
              detail="Each session can include a reason. When a major change is proposed, you choose Accept changes or Keep original. Tamreen does not apply that change until you accept it."
            />
            <Feature
              status="Available now"
              title="Performance"
              body="Review progress within each sport and across your overall training."
              detail="In the app, each score says how it was calculated. Strength, running, cycling, swimming, consistency, and recovery stay blank when their inputs are missing."
            />
            <Feature
              status="Available now"
              title="For coaches"
              body="Review an athlete’s combined training workload and provide guidance."
              detail="A coach sees an athlete only after that athlete accepts the link. Health notes stay behind that access."
            />
            <Feature
              status="Available now"
              title="For gyms"
              body="Help members follow their training, review sessions, and track engagement."
              detail="A member is tied to a session by QR check-in, an assignment, or a signed-in device. Tamreen does not use facial recognition. Session analysis stays off unless the member consents."
            />
          </div>
          <article className="app-card p-6">
            <Status label="Planned" />
            <h3 className="mt-3 text-2xl font-bold">Wearable sync</h3>
            <p className="mt-2">Completed workouts from a watch or health app are not imported yet.</p>
            <p className="mt-2 text-sm text-muted">Garmin, Apple Health, Health Connect, WHOOP, Strava, and Oura are not connected. Training load uses what you log and what you report.</p>
          </article>
        </section>

        <section id="examples" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="eyebrow">Example coaching explanations</p>
          <h2 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight">The kind of note Tamreen attaches to a change</h2>
          <p className="mt-3 max-w-3xl leading-7 text-muted">
            These are product examples. They are not customer quotes, and they are not measured outcomes.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {examples.map((example) => (
              <article key={example.title} className="app-card p-5">
                <h3 className="text-xl font-bold">{example.title}</h3>
                <p className="mt-3 leading-7">{example.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">The hard-run example is an illustration, not a scientifically validated prediction. You can open the same kind of week in the demo.</p>
          <Link className="btn btn-primary mt-4" href="/demo">Explore demo</Link>
        </section>

        <section id="qatar" className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
          <p className="eyebrow">Built in Qatar</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Built in Qatar</h2>
          <p className="mt-4 text-lg leading-8">
            Tamreen AI is being developed in Qatar to support active lifestyles and build local sports technology capability. Its intended contribution to Qatar National Vision 2030 includes athlete development, local AI expertise and digital innovation.
          </p>
        </section>

        <section className="bg-[#8a1538] px-4 py-16 text-center text-white sm:px-6">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Train the whole athlete.</h2>
          <p className="mx-auto mt-3 max-w-xl text-[#f6f1f2]">Start with an account, or look through the sample week first.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link className="btn btn-gold" href="/signup">Start training</Link>
            <Link className="btn btn-on-dark" href="/demo">Explore demo</Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function PilotItem({ title, body }: { title: string; body: string }) {
  return (
    <li className="app-card p-5">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-2 leading-7 text-muted">{body}</p>
    </li>
  );
}

function Feature({ status, title, body, detail }: { status: string; title: string; body: string; detail: string }) {
  return (
    <article className="app-card p-6">
      <Status label={status} />
      <h3 className="mt-3 text-2xl font-bold">{title}</h3>
      <p className="mt-2 text-lg">{body}</p>
      <p className="mt-3 text-sm leading-6 text-muted">{detail}</p>
    </article>
  );
}

function Status({ label }: { label: string }) {
  const className = label === "Planned"
    ? "border border-[#f6f1f2] bg-[#1f1115] text-white"
    : label === "Initial pilot"
      ? "bg-[#f3e6cf] text-[#3d0e1f]"
      : "bg-[#8a1538] text-white";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold tracking-wide ${className}`}>{label}</span>;
}
