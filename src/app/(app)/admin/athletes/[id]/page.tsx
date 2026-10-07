import { notFound } from "next/navigation";
import { PageFrame } from "@/components/page";
import { requireRole } from "@/server/guard";

export default async function AdminAthletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireRole("super_admin");
  const { data, error } = await supabase.rpc("admin_athlete_bundle", { target: id });
  if (error || !data || typeof data !== "object") notFound();
  const bundle = data as {
    profile?: { full_name?: string; is_demo?: boolean };
    athlete?: { weight_kg?: number; experience_level?: string };
    roles?: string[];
    recent_workouts?: Array<{ id: string; scheduled_date: string; sport: string; title: string; status: string }>;
    recovery?: Array<{ logged_on: string; fatigue: number }>;
  };
  return (
    <PageFrame eyebrow="Audited view" title={bundle.profile?.full_name || id} lede="This inspection is written to the audit log. It is for support, not for coaching.">
      {bundle.profile?.is_demo ? <p className="font-bold">Demo account. Seeded rows are labeled demo.</p> : null}
      <p className="text-sm">Roles {(bundle.roles ?? []).join(", ") || "none"} · {bundle.athlete?.experience_level} · {bundle.athlete?.weight_kg ?? "—"} kg</p>
      <h2 className="font-bold">Recent workouts</h2>
      <ul className="grid gap-2 text-sm">
        {(bundle.recent_workouts ?? []).map((workout) => (
          <li key={workout.id}>{workout.scheduled_date} · {workout.sport} · {workout.title} · {workout.status}</li>
        ))}
      </ul>
      <h2 className="font-bold">Recovery</h2>
      <ul className="grid gap-1 text-sm">
        {(bundle.recovery ?? []).map((log) => <li key={log.logged_on}>{log.logged_on} · fatigue {log.fatigue}</li>)}
      </ul>
    </PageFrame>
  );
}
