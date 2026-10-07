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
    <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Today</p>
          <h1 className="text-4xl font-extrabold">{greeting(name, data.hour)}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-primary" href="/plan">Open plan</Link>
          {data.profile?.is_demo ? <DemoBanner /> : null}
        </div>
      </header>
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
        <article className="app-card p-5 md:col-span-2">
          <h2 className="font-bold">Weekly load vs recommended</h2>
          <p className="text-sm text-muted">Bars use completed-session load. The dashed line is the daily share of the recommended week.</p>
          {points.length ? <LoadChart points={points} target={Math.round(target)} /> : <p className="mt-6 text-sm text-muted">No completed sessions in the last 7 days.</p>}
        </article>
      </section>
      {data.event ? (
        <article className="app-card p-5">
          <p className="eyebrow">{data.event.event_type}</p>
          <h2 className="text-2xl font-extrabold">{data.event.name}</h2>
          <p className="metric text-lg">{data.event.days} days remaining</p>
          <Link className="btn btn-ghost mt-3" href={`/events/${data.event.id}`}>Event plan</Link>
        </article>
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

function WeekStrip({
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

function Stat({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="rounded-xl bg-paper px-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="metric text-xl font-bold">{value ?? "—"}</dd>
    </div>
  );
}
