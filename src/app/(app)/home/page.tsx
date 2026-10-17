import { HomeDashboard } from "@/features/dashboard/home-dashboard";
import { loadHome } from "@/server/queries";
import { recommendedWeeklyLoad } from "@/services/training/engine";

export default async function HomePage() {
  const data = await loadHome();
  const name = data.profile?.full_name || "athlete";
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
    <HomeDashboard
      name={name}
      hour={data.hour}
      today={data.today}
      isDemo={Boolean(data.profile?.is_demo)}
      todayWorkouts={data.todayWorkouts}
      weekWorkouts={data.weekWorkouts}
      readiness={data.readiness}
      scores={data.scores}
      points={points}
      target={Math.round(target)}
      event={data.event}
      insight={data.insight}
      conflict={data.conflicts[0] ?? null}
    />
  );
}
