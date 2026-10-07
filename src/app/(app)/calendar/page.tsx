import Link from "next/link";
import { PageFrame } from "@/components/page";
import { WorkoutControls } from "@/features/calendar/controls";
import { sportLabel, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export default async function CalendarPage() {
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const start = `${today.slice(0, 7)}-01`;
  const endDate = new Date(`${start}T00:00:00Z`);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  endDate.setUTCDate(0);
  const end = endDate.toISOString().slice(0, 10);
  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, scheduled_date, sport, title, duration_min, status")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .gte("scheduled_date", start)
    .lte("scheduled_date", end)
    .order("scheduled_date");
  const byDate = new Map<string, NonNullable<typeof workouts>>();
  for (const workout of workouts ?? []) {
    const list = byDate.get(workout.scheduled_date) ?? [];
    list.push(workout);
    byDate.set(workout.scheduled_date, list);
  }

  return (
    <PageFrame eyebrow="Calendar" title={today.slice(0, 7)} lede="Moving a session checks the surrounding day before it lands.">
      <div className="grid gap-3">
        {[...byDate.entries()].map(([date, rows]) => (
          <section key={date} className="app-card p-4">
            <h2 className="font-bold">{date}{date === today ? " · today" : ""}</h2>
            <ul className="mt-2 grid gap-3">
              {rows.map((workout) => (
                <li key={workout.id}>
                  <Link className="font-semibold" href={`/train/${workout.id}`}>
                    <span className={`chip sport-${workout.sport}`}>{sportLabel(workout.sport)}</span> {workout.title}
                  </Link>
                  <p className="text-sm text-muted">{workout.duration_min} min · {workout.status}</p>
                  <WorkoutControls id={workout.id} date={workout.scheduled_date} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {byDate.size === 0 ? <p className="text-muted">No sessions this month.</p> : null}
      </div>
    </PageFrame>
  );
}
