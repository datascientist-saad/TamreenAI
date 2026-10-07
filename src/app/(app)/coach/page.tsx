import { PageFrame } from "@/components/page";
import { coachFeedback, inviteAthlete } from "@/server/actions";
import { requireRole } from "@/server/guard";

export default async function CoachDeskPage() {
  const { supabase, user } = await requireRole("coach");
  const { data: links } = await supabase
    .from("coach_athletes")
    .select("id, status, athlete_id, athlete:profiles!coach_athletes_athlete_id_fkey(full_name)")
    .eq("coach_id", user.id);
  const active = (links ?? []).filter((link) => link.status === "active").map((link) => link.athlete_id);
  const [{ data: readiness }, { data: missed }, { data: loads }, { data: events }] = await Promise.all([
    active.length ? supabase.from("readiness_scores").select("user_id, overall, scored_on").in("user_id", active).order("scored_on", { ascending: false }).limit(40) : Promise.resolve({ data: [] }),
    active.length ? supabase.from("workouts").select("user_id, scheduled_date, status").in("user_id", active).eq("status", "missed").limit(40) : Promise.resolve({ data: [] }),
    active.length ? supabase.from("completed_workouts").select("user_id, load, started_at").in("user_id", active).gte("started_at", new Date(Date.now() - 14 * 86400000).toISOString()) : Promise.resolve({ data: [] }), // eslint-disable-line react-hooks/purity -- server query window
    active.length ? supabase.from("events").select("owner_user_id, name, starts_on").in("owner_user_id", active).gte("starts_on", new Date().toISOString().slice(0, 10)).is("deleted_at", null) : Promise.resolve({ data: [] }),
  ]);

  return (
    <PageFrame eyebrow="Coach" title="Athletes" lede="You only see an athlete after they accept the link. Health data stays behind that authorization.">
      <form action={async (formData) => { "use server"; await inviteAthlete(String(formData.get("athleteId") || "")); }} className="app-card grid gap-3 p-4">
        <label>Invite by athlete id<input name="athleteId" required placeholder="UUID" /></label>
        <button className="btn btn-primary" type="submit">Send pending invite</button>
      </form>
      <ul className="grid gap-3">
        {(links ?? []).map((link) => {
          const profile = Array.isArray(link.athlete) ? link.athlete[0] : link.athlete;
          const ready = (readiness ?? []).find((row) => row.user_id === link.athlete_id);
          const flags = flagsFor(link.athlete_id, ready?.overall ?? null, missed ?? [], loads ?? [], events ?? []);
          return (
            <li key={link.id} className="app-card p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold">{profile?.full_name || link.athlete_id}</h2>
                <span className="text-sm">{link.status}</span>
              </div>
              <p className="metric text-3xl">{ready?.overall ?? "—"}</p>
              <p className="text-xs text-muted">Latest readiness</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {flags.map((flag) => <li key={flag} className="chip sport-running">{flag}</li>)}
              </ul>
              {link.status === "active" ? (
                <form action={async (formData) => { "use server"; await coachFeedback(link.athlete_id, String(formData.get("body") || ""), null); }} className="mt-3 grid gap-2">
                  <textarea name="body" required placeholder="Feedback the athlete will see" />
                  <button className="btn btn-ghost" type="submit">Send feedback</button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </PageFrame>
  );
}

function flagsFor(
  athleteId: string,
  readiness: number | null,
  missed: Array<{ user_id: string }>,
  loads: Array<{ user_id: string; load: number | null; started_at: string }>,
  events: Array<{ owner_user_id: string | null; name: string; starts_on: string }>,
) {
  const flags: string[] = [];
  if (readiness != null && readiness < 50) flags.push("High fatigue");
  if (missed.some((row) => row.user_id === athleteId)) flags.push("Missed training");
  const mine = loads.filter((row) => row.user_id === athleteId);
  const recent = mine.filter((row) => Date.parse(row.started_at) > Date.now() - 7 * 86400000).reduce((sum, row) => sum + Number(row.load ?? 0), 0);
  const prior = mine.filter((row) => Date.parse(row.started_at) <= Date.now() - 7 * 86400000).reduce((sum, row) => sum + Number(row.load ?? 0), 0);
  if (prior > 0 && recent > prior * 1.4) flags.push("Training load spike");
  const soon = events.find((event) => event.owner_user_id === athleteId && Date.parse(event.starts_on) - Date.now() < 21 * 86400000);
  if (soon) flags.push("Event approaching");
  return flags;
}
