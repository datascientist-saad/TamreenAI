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
    <div className="min-w-0 bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-maroon-deep/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <Wordmark className="shrink-0 text-sm sm:text-base" />
            <div className="shrink-0 sm:hidden">
              <ThemeToggle persist={false} onDark compact />
            </div>
          </div>
          <nav className="flex min-w-0 items-center gap-2" aria-label="Account">
            <div className="hidden sm:block">
              <ThemeToggle persist={false} onDark />
            </div>
            <Link className="btn btn-ghost flex-1 border-white/20 text-white sm:flex-none" href="/login">Sign in</Link>
            <Link className="btn btn-primary flex-1 sm:flex-none" href="/signup">Start training</Link>
          </nav>
        </div>
      </header>
      <section className="bg-gradient-to-b from-[#3d0e1f] to-[#4a1228] px-4 pb-16 pt-10 text-center text-white sm:px-6 sm:pb-24 sm:pt-16">
        <div className="mx-auto w-fit overflow-hidden rounded-3xl shadow-lg">
          <Mark size={112} />
        </div>
        <p className="eyebrow mt-6 text-gold">Plan · Train · Adapt</p>
        <h1 className="mx-auto mt-4 max-w-4xl text-balance text-4xl font-extrabold tracking-tight sm:text-5xl md:text-7xl">TAMREEN AI</h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-lg font-semibold sm:text-2xl">One athlete. Multiple sports. One intelligent training system.</p>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-white/75 sm:text-base">
          Tamreen combines strength, running, cycling and swimming into one adaptive training system that understands how every workout affects your performance.
        </p>
        <div className="mx-auto mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center">
          <Link className="btn btn-primary" href="/signup">Start training</Link>
          <a className="btn btn-ghost border-white/30 text-white" href="#how">See how it works</a>
        </div>
        <div className="mx-auto mt-8 grid max-w-3xl gap-4 rounded-3xl border border-gold/30 bg-white/5 p-4 text-left sm:mt-10 sm:p-6 md:grid-cols-3">
          <Metric value="70.3" label="One event, every sport" />
          <Metric value="1" label="Performance model" />
          <Metric value="Why" label="Every change is explained" />
        </div>
      </section>
      <section id="how" className="mx-auto grid max-w-6xl scroll-mt-36 gap-3 px-4 py-12 sm:scroll-mt-24 sm:gap-4 sm:px-6 sm:py-20 md:grid-cols-3">
        {sections.map(([title, body]) => (
          <article key={title} className="app-card min-w-0 p-4 sm:p-6">
            <h2 className="text-xl font-bold text-maroon">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
          </article>
        ))}
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-12 sm:px-6 sm:pb-20">
        <p className="eyebrow">Illustrative examples, not customer quotes</p>
        <blockquote className="app-card mt-4 p-4 text-base sm:p-6 sm:text-lg">
          “These lines show the kind of explanation Tamreen is built to give. They are product examples, not testimonials from customers.”
        </blockquote>
      </section>
      <section className="bg-maroon px-4 py-12 text-center text-white sm:px-6 sm:py-16">
        <h2 className="text-balance text-3xl font-extrabold sm:text-4xl">Train the whole athlete.</h2>
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
