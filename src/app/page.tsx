import Link from "next/link";
import { Mark, Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

const sections = [
  ["Problem", "Four plans do not know about each other. A heavy squat day quietly ruins tomorrow's intervals, and a long run quietly ruins the squat. Most apps never say that out loud."],
  ["How Tamreen works", "Goal, plan, train, measure, analyze, recover, adapt. Every screen answers what to do, why, how you performed, or what should change."],
  ["Hybrid training", "Strength, running, cycling, and swimming share one fatigue budget. Tamreen places sessions so they support the event instead of colliding."],
  ["Live training", "The camera runs an on-device pose model. Scores appear only when the body stays visible. They are 2D camera estimates, not a lab measurement. Placeholders stay labeled as placeholders."],
  ["AI coach", "Ask why a session changed. Tamreen shows the factors and waits for you to accept a major change."],
  ["Performance", "Scores appear only when the inputs exist, and each one says how it was calculated."],
  ["Events", "A race result can become a profile, a plan, and the next block of training."],
  ["For gyms", "Cameras stay tied to QR, assignment, or a signed-in device. Tamreen does not use facial recognition."],
  ["For coaches", "A coach sees an athlete only after that athlete accepts the link."],
];

export default function LandingPage() {
  return (
    <div className="bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-maroon-deep/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Wordmark />
          <nav className="flex items-center gap-2">
            <ThemeToggle persist={false} onDark />
            <Link className="btn btn-ghost border-white/20 text-white" href="/login">Sign in</Link>
            <Link className="btn btn-primary" href="/signup">Start training</Link>
          </nav>
        </div>
      </header>
      <section className="bg-gradient-to-b from-[#3d0e1f] to-[#4a1228] px-6 pb-24 pt-16 text-center text-white">
        <div className="mx-auto w-fit overflow-hidden rounded-3xl shadow-lg">
          <Mark size={112} />
        </div>
        <p className="eyebrow mt-6 text-gold">Plan · Train · Adapt</p>
        <h1 className="mx-auto mt-4 max-w-4xl text-5xl font-extrabold tracking-tight md:text-7xl">TAMREEN AI</h1>
        <p className="mx-auto mt-4 max-w-2xl text-2xl font-semibold">One athlete. Multiple sports. One intelligent training system.</p>
        <p className="mx-auto mt-4 max-w-2xl text-white/75">
          Tamreen combines strength, running, cycling and swimming into one adaptive training system that understands how every workout affects your performance.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link className="btn btn-primary" href="/signup">Start training</Link>
          <a className="btn btn-ghost border-white/30 text-white" href="#how">See how it works</a>
        </div>
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 rounded-3xl border border-gold/30 bg-white/5 p-6 text-left md:grid-cols-3">
          <Metric value="70.3" label="One event, every sport" />
          <Metric value="1" label="Performance model" />
          <Metric value="Why" label="Every change is explained" />
        </div>
      </section>
      <section id="how" className="mx-auto grid max-w-6xl gap-4 px-6 py-20 md:grid-cols-3">
        {sections.map(([title, body]) => (
          <article key={title} className="app-card p-6">
            <h2 className="text-xl font-bold text-maroon">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
          </article>
        ))}
      </section>
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <p className="eyebrow">Illustrative examples, not customer quotes</p>
        <blockquote className="app-card mt-4 p-6 text-lg">
          “These lines show the kind of explanation Tamreen is built to give. They are product examples, not testimonials from customers.”
        </blockquote>
      </section>
      <section className="bg-maroon px-6 py-16 text-center text-white">
        <h2 className="text-4xl font-extrabold">Train the whole athlete.</h2>
        <Link className="btn btn-gold mt-6" href="/signup">Start training</Link>
      </section>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="metric text-3xl font-bold">{value}</div>
      <div className="text-sm text-white/70">{label}</div>
    </div>
  );
}
