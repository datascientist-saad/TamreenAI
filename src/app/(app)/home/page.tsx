import Link from "next/link";
import { DemoBanner, EmptyState, ExplainList, SafetyBanner } from "@/components/states";
import { LoadChart } from "@/features/dashboard/load-chart";
import { greeting, shiftIsoDate, sportLabel } from "@/lib/utils";
import { loadHome } from "@/server/queries";
import { recommendedWeeklyLoad } from "@/services/training/engine";

export default async function HomePage() {
  const data = await loadHome();
  const name = data.profile?.full_name || "athlete";
  const overall = data.scores.find((score) => score.dimension === "overall");
  const relevant = data.scores.filter((score) => score.dimension !== "overall" && score.score != null);
  const byDay = new Map<string, number>();
  for (const row of data.loads) {
    const day = String(row.started_at).slice(5, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + Number(row.load ?? 0));
  }
  const points = [...byDay.entries()].map(([day, load]) => ({ day, load }));
  const target = recommendedWeeklyLoad({
    startDate: data.today,
    sports: [],
    primaryGoal: "general_hybrid",
    goals: [],
    experience: data.experience,
    preferredDays: data.preferredDays,
    minutesPerDay: data.minutesPerDay,
    gymAccess: true,
    poolAccess: true,
    bikeAccess: true,
    eventDate: null,
    eventName: null,
    avoidExercises: [],
    currentInjuryAreas: [],
    redFlag: false,
    weightKg: null,
    sex: null,
    reported: {},
  }) / 7;

  return (
    <main className="mx-auto grid max-w-5xl gap-7 px-5 pb-8 pt-1 lg:gap-4 lg:px-4 lg:py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted lg:hidden">{longDate(data.today)}</p>
          <p className="eyebrow hidden lg:block">Today</p>
          <h1 className="text-[1.7rem] font-bold leading-tight lg:text-4xl lg:font-extrabold">{greeting(name, data.hour)}</h1>
          {data.profile?.is_demo ? <p className="mt-2 inline-flex rounded-full bg-[#f3e6cf] px-2.5 py-1 text-[11px] font-bold text-[#3d0e1f] lg:hidden">Demo data</p> : null}
        </div>
        <div className="hidden flex-wrap gap-2 lg:flex">
          <Link className="btn btn-primary" href="/plan">Open plan</Link>
          {data.profile?.is_demo ? <DemoBanner /> : null}
        </div>
      </header>
      <div className="grid gap-7 lg:hidden">
        {data.readiness?.blocked_for_safety ? <SafetyBanner /> : null}
        <WeekStrip today={data.today} workouts={data.weekWorkouts} compact />
        <ReadinessHero readiness={data.readiness} />
        <TodayList workouts={data.todayWorkouts} />
        <PerformanceList overall={overall} scores={relevant} />
      </div>
      <div className="hidden gap-4 lg:grid">
      <WeekStrip today={data.today} workouts={data.weekWorkouts} />
      {data.readiness?.blocked_for_safety ? <SafetyBanner /> : null}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <article className="app-card p-5">
          <h2 className="text-lg font-bold">Today&apos;s training</h2>
          {data.todayWorkouts.length === 0 ? (
            <EmptyState title="Nothing is scheduled." body="Finish onboarding or open the plan to generate the week." href="/onboarding" action="Set up training" />
          ) : (
            <ul className="mt-4 grid gap-3">
              {data.todayWorkouts.map((workout) => (
                <li key={workout.id} className="rounded-2xl border border-line p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`chip sport-${workout.sport}`}>{sportLabel(workout.sport)}</span>
                    <span className="metric text-sm">{workout.duration_min} min</span>
                  </div>
                  <h3 className="mt-2 text-2xl font-bold">{workout.title}</h3>
                  <p className="text-sm text-muted">{workout.objective}</p>
                  <p className="mt-2 text-sm">{workout.why_text}</p>
                  <Link className="btn btn-primary mt-4" href={`/train/${workout.id}`}>Start workout</Link>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="app-card p-5">
          <p className="eyebrow">Readiness</p>
          <p className="metric mt-2 text-6xl font-bold">{data.readiness?.overall ?? "—"}</p>
          <p className="text-sm text-muted">{data.readiness?.explanation ?? "Log a recovery check-in to score readiness. Tamreen will not invent one."}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <Stat label="Sleep" value={data.readiness?.sleep} />
            <Stat label="Recovery" value={data.readiness?.recovery} />
            <Stat label="Recent load" value={data.readiness?.recent_load} />
            <Stat label="Muscle fatigue" value={data.readiness?.muscle_fatigue} />
            <Stat label="Cardio fatigue" value={data.readiness?.cardio_fatigue} />
          </dl>
          <Link className="btn btn-ghost mt-4 w-full" href="/recovery">Log recovery</Link>
        </article>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <article className="app-card p-5">
          <p className="eyebrow">Tamreen performance score</p>
          <p className="metric mt-2 text-6xl font-bold">{overall?.score ?? "—"}</p>
          <p className="text-sm text-muted">{overall?.explanation ?? "The score appears after enough logged training or reported baselines."}</p>
          <ul className="mt-3 grid gap-2">
            {relevant.map((score) => (
              <li key={score.dimension}>
                <Link className="flex items-center justify-between rounded-xl bg-paper px-3 py-2" href={`/progress/${score.dimension}`}>
                  <span className="capitalize">{score.dimension}</span>
                  <span className="metric font-bold">{score.score}</span>
                </Link>
              </li>
            ))}
          </ul>
        </article>
      </section>
      </div>
      <section>
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted lg:text-base lg:font-bold lg:normal-case lg:tracking-normal lg:text-ink">Weekly load</h2>
        <p className="mt-1 text-sm text-muted">Completed sessions against the recommended day. The dashed line is that daily share.</p>
        {points.length ? <LoadChart points={points} target={Math.round(target)} /> : <p className="mt-4 text-sm text-muted">No completed sessions in the last 7 days.</p>}
      </section>
      {data.event ? (
        <Link href={`/events/${data.event.id}`} className="flex items-center justify-between gap-3 border-t border-line py-4 lg:app-card lg:border-t-0 lg:p-5">
          <span>
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{data.event.event_type}</span>
            <span className="mt-1 block text-xl font-bold">{data.event.name}</span>
            <span className="text-sm text-muted">{data.event.days} days remaining</span>
          </span>
          <span className="text-sm font-bold text-maroon">Open</span>
        </Link>
      ) : null}
      {data.insight ? (
        <article className="app-card border-l-4 border-l-maroon p-5">
          <p className="eyebrow">Why Tamreen is saying this</p>
          <h2 className="mt-2 text-xl font-bold">{data.insight.title}</h2>
          <p className="mt-2">{data.insight.body}</p>
          <ExplainList factors={Array.isArray(data.insight.factors) ? data.insight.factors as Array<{ label: string; detail: string }> : []} />
          <div className="mt-4 flex gap-2">
            <form action={async () => { "use server"; const { respondToRecommendation } = await import("@/server/actions"); await respondToRecommendation(data.insight!.id, true); }}>
              <button className="btn btn-primary" type="submit">Accept changes</button>
            </form>
            <form action={async () => { "use server"; const { respondToRecommendation } = await import("@/server/actions"); await respondToRecommendation(data.insight!.id, false); }}>
              <button className="btn btn-ghost" type="submit">Keep original</button>
            </form>
          </div>
        </article>
      ) : null}
      {data.conflicts[0] ? (
        <article className="app-card p-5">
          <p className="eyebrow text-live">{data.conflicts[0].title}</p>
          <p className="mt-2">{data.conflicts[0].explanation}</p>
          <Link className="btn btn-primary mt-4" href="/conflicts">Optimize schedule</Link>
        </article>
      ) : null}
    </main>
  );
}

function longDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
}

function recommendationLine(explanation: string | null | undefined) {
  if (!explanation) return "Log a check-in to score readiness.";
  const recommendation = explanation.split("Recommendation:")[1]?.trim();
  if (!recommendation) return explanation;
  return recommendation.charAt(0).toUpperCase() + recommendation.slice(1);
}

function WeekStrip({
  today,
  workouts,
  compact = false,
}: {
  today: string;
  workouts: Array<{ id: string; scheduled_date: string; sport: string; title: string; duration_min: number; status: string }>;
  compact?: boolean;
}) {
  const days = Array.from({ length: 7 }, (_, index) => shiftIsoDate(today, index));
  if (compact) {
    return (
      <div className="grid grid-cols-7" aria-label="This week">
        {days.map((date) => {
          const rows = workouts.filter((workout) => workout.scheduled_date === date);
          const first = rows[0];
          const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" });
          const day = Number(date.slice(8));
          return (
            <Link key={date} href={first ? `/train/${first.id}` : "/plan"} className="grid justify-items-center gap-1 py-1" aria-current={date === today ? "date" : undefined} aria-label={`${label} ${day}${first ? `, ${first.title}` : ", rest"}`}>
              <span className="text-[10px] font-bold uppercase text-ink">{label}</span>
              <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${date === today ? "bg-maroon text-white" : ""}`}>{day}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${first ? "bg-maroon dark:bg-[#f3c1cf]" : "bg-transparent"}`} />
            </Link>
          );
        })}
      </div>
    );
  }
  return <WeekCards today={today} workouts={workouts} />;
}

function ReadinessHero({
  readiness,
}: {
  readiness: { overall: number | null; explanation: string | null; sleep: number | null; recovery: number | null; recent_load: number | null; muscle_fatigue: number | null; cardio_fatigue: number | null; blocked_for_safety: boolean | null } | null;
}) {
  const score = readiness?.overall ?? null;
  return (
    <section className="grid justify-items-center gap-3" aria-label="Readiness">
      <ScoreRing value={score} label="Readiness" />
      {readiness?.explanation?.includes("Recommendation:") ? <p className="text-center text-base font-semibold">{recommendationLine(readiness.explanation)}</p> : null}
      <p className="max-w-sm text-center text-sm leading-6 text-muted">
        {readiness?.explanation ?? "Log a recovery check-in to score readiness. Tamreen will not invent one."}
      </p>
      <dl className="grid w-full grid-cols-3 divide-x divide-line text-center">
        <Stat label="Sleep" value={readiness?.sleep} plain />
        <Stat label="Recovery" value={readiness?.recovery} plain />
        <Stat label="Load" value={readiness?.recent_load} plain />
      </dl>
      <p className="text-center text-xs text-muted">
        Muscle fatigue {readiness?.muscle_fatigue ?? "—"} · Cardio fatigue {readiness?.cardio_fatigue ?? "—"}
      </p>
      <Link className="text-sm font-bold text-maroon" href="/recovery">Log recovery</Link>
    </section>
  );
}

function ScoreRing({ value, label }: { value: number | null; label: string }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const shown = value == null ? 0 : Math.max(0, Math.min(100, value));
  const offset = circumference - (shown / 100) * circumference;
  return (
    <div className="relative grid h-44 w-44 place-items-center">
      <svg viewBox="0 0 140 140" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--score)" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={value == null ? circumference : offset} strokeLinecap="round" />
      </svg>
      <div className="text-center">
        <p className="metric text-6xl font-bold leading-none">{value ?? "—"}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
      </div>
    </div>
  );
}

function TodayList({
  workouts,
}: {
  workouts: Array<{ id: string; sport: string; title: string; duration_min: number; objective: string | null; why_text: string | null }>;
}) {
  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Today</h2>
      {workouts.length === 0 ? (
        <div className="mt-3 border-t border-line py-4">
          <p className="text-lg font-bold">Rest day</p>
          <p className="text-sm text-muted">Nothing is scheduled.</p>
          <Link className="mt-2 inline-block text-sm font-bold text-maroon" href="/plan">View plan</Link>
        </div>
      ) : (
        <ul className="mt-1 divide-y divide-line border-t border-line">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <Link href={`/train/${workout.id}`} className="flex items-center justify-between gap-3 py-4">
                <span>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{sportLabel(workout.sport)}</span>
                  <span className="mt-0.5 block text-lg font-bold">{workout.title}</span>
                  <span className="text-sm text-muted">{workout.duration_min} min</span>
                </span>
                <span className="text-sm font-bold text-maroon">Start</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PerformanceList({
  overall,
  scores,
}: {
  overall: { score: number | null; explanation: string | null } | undefined;
  scores: Array<{ dimension: string; score: number | null }>;
}) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Performance</h2>
        <p className="metric text-4xl font-bold leading-none">{overall?.score ?? "—"}</p>
      </div>
      <p className="mt-2 text-sm text-muted">{overall?.explanation ?? "The score appears after enough logged training or reported baselines."}</p>
      <ul className="mt-2 divide-y divide-line border-t border-line">
        {scores.map((score) => (
          <li key={score.dimension}>
            <Link className="flex items-center justify-between py-3" href={`/progress/${score.dimension}`}>
              <span className="capitalize">{score.dimension}</span>
              <span className="metric text-lg font-bold">{score.score}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WeekCards({
  today,
  workouts,
}: {
  today: string;
  workouts: Array<{ id: string; scheduled_date: string; sport: string; title: string; duration_min: number; status: string }>;
}) {
  const days = Array.from({ length: 7 }, (_, index) => shiftIsoDate(today, index));
  return (
    <section className="app-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">This week</h2>
        <Link className="text-sm font-bold text-maroon" href="/plan">Full plan</Link>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {days.map((date) => {
          const rows = workouts.filter((workout) => workout.scheduled_date === date);
          const first = rows[0];
          const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
          return (
            <Link
              key={date}
              href={first ? `/train/${first.id}` : "/plan"}
              className={`min-w-36 rounded-2xl border px-3 py-3 ${date === today ? "border-maroon bg-maroon text-white" : "border-line bg-paper"}`}
            >
              <span className="text-xs font-bold uppercase tracking-wide">{date === today ? "Today" : label}</span>
              <span className="mt-1 block font-bold">{first ? first.title : "Rest"}</span>
              <span className={`mt-1 block text-xs ${date === today ? "text-white/80" : "text-muted"}`}>
                {first ? `${first.duration_min} min${rows.length > 1 ? ` · +${rows.length - 1}` : ""}` : "Open plan"}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Stat({ label, value, plain = false }: { label: string; value: number | null | undefined; plain?: boolean }) {
  return (
    <div className={plain ? "px-2 py-1" : "rounded-xl bg-paper px-3 py-2"}>
      <dt className={plain ? "text-[10px] font-bold uppercase tracking-[0.14em] text-muted" : "text-muted"}>{plain ? null : label}</dt>
      <dd className="metric text-xl font-bold">{value ?? "—"}</dd>
      {plain ? <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{label}</dt> : null}
    </div>
  );
}
