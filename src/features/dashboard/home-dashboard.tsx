import Link from "next/link";
import { DemoBanner, EmptyState, ExplainList, SafetyBanner } from "@/components/states";
import { LoadChart } from "@/features/dashboard/load-chart";
import { WhoopMetrics } from "@/features/whoop/metrics";
import { greeting, shiftIsoDate, sportLabel } from "@/lib/utils";
import type { WhoopMetricView } from "@/services/wearables/whoop";

type TodayWorkout = {
  id: string;
  sport: string;
  title: string;
  duration_min: number | null;
  objective: string | null;
  why_text: string | null;
};

type WeekWorkout = {
  id: string;
  scheduled_date: string;
  sport: string;
  title: string;
  duration_min: number | null;
  status: string;
};

type Score = {
  dimension: string;
  score: number | null;
  explanation: string | null;
};

type Readiness = {
  blocked_for_safety?: boolean | null;
  overall?: number | null;
  explanation?: string | null;
  sleep?: number | null;
  recovery?: number | null;
  recent_load?: number | null;
  muscle_fatigue?: number | null;
  cardio_fatigue?: number | null;
};

export type HomeDashboardProps = {
  name: string;
  hour: number;
  today: string;
  isDemo: boolean;
  todayWorkouts: TodayWorkout[];
  weekWorkouts: WeekWorkout[];
  readiness: Readiness | null;
  scores: Score[];
  points: Array<{ day: string; load: number }>;
  target: number;
  event: { id: string; event_type: string; name: string; days: number } | null;
  insight: { id: string; title: string; body: string; factors: unknown } | null;
  conflict: { title: string; explanation: string } | null;
  whoop: { status: string; metrics: WhoopMetricView[] } | null;
};

export function HomeDashboard({
  name,
  hour,
  today,
  isDemo,
  todayWorkouts,
  weekWorkouts,
  readiness,
  scores,
  points,
  target,
  event,
  insight,
  conflict,
  whoop,
}: HomeDashboardProps) {
  const overall = scores.find((score) => score.dimension === "overall");
  const relevant = scores.filter((score) => score.dimension !== "overall" && score.score != null);
  const factors = Array.isArray(insight?.factors) ? insight.factors as Array<{ label: string; detail: string }> : [];

  return (
    <main className="mx-auto grid w-full min-w-0 max-w-5xl gap-4 px-4 py-5 *:min-w-0 sm:py-6">
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Today</p>
          <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">{greeting(name, hour)}</h1>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:max-w-2xl sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Link className="btn btn-primary w-full sm:w-auto" href="/plan">Open plan</Link>
          {isDemo ? <DemoBanner /> : null}
        </div>
      </header>
      <WeekStrip today={today} workouts={weekWorkouts} />
      {readiness?.blocked_for_safety ? <SafetyBanner /> : null}
      <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <article className="app-card min-w-0 p-4 sm:p-5">
          <h2 className="text-lg font-bold">Today&apos;s training</h2>
          {todayWorkouts.length === 0 ? (
            <EmptyState title="Nothing is scheduled." body="Finish onboarding or open the plan to generate the week." href="/onboarding" action="Set up training" />
          ) : (
            <ul className="mt-4 grid gap-3">
              {todayWorkouts.map((workout) => (
                <li key={workout.id} className="min-w-0 rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`chip sport-${workout.sport}`}>{sportLabel(workout.sport)}</span>
                    <span className="metric text-sm">{workout.duration_min ?? "—"} min</span>
                  </div>
                  <h3 className="mt-2 text-balance text-xl font-bold sm:text-2xl">{workout.title}</h3>
                  <p className="text-sm text-muted">{workout.objective}</p>
                  <p className="mt-2 text-sm">{workout.why_text}</p>
                  <Link className="btn btn-primary mt-4 w-full sm:w-auto" href={`/train/${workout.id}`}>Start workout</Link>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="app-card min-w-0 p-4 sm:p-5">
          <p className="eyebrow">Readiness</p>
          <p className="metric mt-2 text-5xl font-bold sm:text-6xl">{readiness?.overall ?? "—"}</p>
          <p className="text-sm text-muted">{readiness?.explanation ?? "Log a recovery check-in to score readiness. Tamreen will not invent one."}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <Stat label="Sleep" value={readiness?.sleep} />
            <Stat label="Recovery" value={readiness?.recovery} />
            <Stat label="Recent load" value={readiness?.recent_load} />
            <Stat label="Muscle fatigue" value={readiness?.muscle_fatigue} />
            <Stat label="Cardio fatigue" value={readiness?.cardio_fatigue} />
          </dl>
          <Link className="btn btn-ghost mt-4 w-full" href="/recovery">Log recovery</Link>
        </article>
      </section>
      {whoop ? (
        <article className="app-card min-w-0 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">WHOOP</h2>
            <Link className="text-sm font-bold text-maroon" href="/more">Manage</Link>
          </div>
          <div className="mt-3">
            <WhoopMetrics metrics={whoop.metrics} compact />
          </div>
        </article>
      ) : null}
      <section className="grid min-w-0 gap-4 md:grid-cols-3">
        <article className="app-card min-w-0 p-4 sm:p-5">
          <p className="eyebrow">Tamreen performance score</p>
          <p className="metric mt-2 text-5xl font-bold sm:text-6xl">{overall?.score ?? "—"}</p>
          <p className="text-sm text-muted">{overall?.explanation ?? "The score appears after enough logged training or reported baselines."}</p>
          <ul className="mt-3 grid gap-2">
            {relevant.map((score) => (
              <li key={score.dimension} className="min-w-0">
                <Link className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2" href={`/progress/${score.dimension}`}>
                  <span className="capitalize">{score.dimension}</span>
                  <span className="metric shrink-0 font-bold">{score.score}</span>
                </Link>
              </li>
            ))}
          </ul>
        </article>
        <article className="app-card min-w-0 p-4 sm:p-5 md:col-span-2">
          <h2 className="font-bold">Weekly load vs recommended</h2>
          <p className="text-sm text-muted">Bars use completed-session load. The dashed line is the daily share of the recommended week.</p>
          {points.length ? <LoadChart points={points} target={target} /> : <p className="mt-6 text-sm text-muted">No completed sessions in the last 7 days.</p>}
        </article>
      </section>
      {event ? (
        <article className="app-card min-w-0 p-4 sm:p-5">
          <p className="eyebrow">{event.event_type}</p>
          <h2 className="text-balance text-xl font-extrabold sm:text-2xl">{event.name}</h2>
          <p className="metric text-lg">{event.days} days remaining</p>
          <Link className="btn btn-ghost mt-3 w-full sm:w-auto" href={`/events/${event.id}`}>Event plan</Link>
        </article>
      ) : null}
      {insight ? (
        <article className="app-card min-w-0 border-l-4 border-l-maroon p-4 sm:p-5">
          <p className="eyebrow">Why Tamreen is saying this</p>
          <h2 className="mt-2 text-balance text-xl font-bold">{insight.title}</h2>
          <p className="mt-2">{insight.body}</p>
          <ExplainList factors={factors} />
          <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
            <form action={async () => { "use server"; const { respondToRecommendation } = await import("@/server/actions"); await respondToRecommendation(insight.id, true); }}>
              <button className="btn btn-primary w-full sm:w-auto" type="submit">Accept changes</button>
            </form>
            <form action={async () => { "use server"; const { respondToRecommendation } = await import("@/server/actions"); await respondToRecommendation(insight.id, false); }}>
              <button className="btn btn-ghost w-full sm:w-auto" type="submit">Keep original</button>
            </form>
          </div>
        </article>
      ) : null}
      {conflict ? (
        <article className="app-card min-w-0 p-4 sm:p-5">
          <p className="eyebrow text-live">{conflict.title}</p>
          <p className="mt-2">{conflict.explanation}</p>
          <Link className="btn btn-primary mt-4 w-full sm:w-auto" href="/conflicts">Optimize schedule</Link>
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
  workouts: WeekWorkout[];
}) {
  const days = Array.from({ length: 7 }, (_, index) => shiftIsoDate(today, index));
  return (
    <section className="app-card min-w-0 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">This week</h2>
        <Link className="text-sm font-bold text-maroon" href="/plan">Full plan</Link>
      </div>
      <div className="-mx-4 mt-3 flex snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 sm:mx-0 sm:px-0">
        {days.map((date) => {
          const rows = workouts.filter((workout) => workout.scheduled_date === date);
          const first = rows[0];
          const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
          return (
            <Link
              key={date}
              href={first ? `/train/${first.id}` : "/plan"}
              className={`w-36 shrink-0 snap-start rounded-2xl border px-3 py-3 sm:w-40 ${date === today ? "border-maroon bg-maroon text-white" : "border-line bg-paper"}`}
            >
              <span className="text-xs font-bold uppercase tracking-wide">{date === today ? "Today" : label}</span>
              <span className="mt-1 line-clamp-2 block min-h-10 font-bold leading-tight">{first ? first.title : "Rest"}</span>
              <span className={`mt-1 block text-xs ${date === today ? "text-white/80" : "text-muted"}`}>
                {first ? `${first.duration_min ?? "—"} min${rows.length > 1 ? ` · +${rows.length - 1}` : ""}` : "Open plan"}
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
    <div className="min-w-0 rounded-xl bg-paper px-3 py-2">
      <dt className="text-xs leading-tight text-muted sm:text-sm">{label}</dt>
      <dd className="metric text-xl font-bold">{value ?? "—"}</dd>
    </div>
  );
}
