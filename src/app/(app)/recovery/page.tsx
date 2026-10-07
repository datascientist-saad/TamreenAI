import { PageFrame } from "@/components/page";
import { SafetyBanner } from "@/components/states";
import { RecoveryForm } from "@/features/recovery/check-in";
import { requireUser } from "@/server/guard";

export default async function RecoveryPage() {
  const { supabase, user } = await requireUser();
  const { data: latest } = await supabase.from("readiness_scores").select("*").eq("user_id", user.id).order("scored_on", { ascending: false }).limit(1).maybeSingle();
  const { data: logs } = await supabase.from("recovery_logs").select("logged_on, sleep_hours, soreness, fatigue, motivation").eq("user_id", user.id).order("logged_on", { ascending: false }).limit(7);
  return (
    <PageFrame eyebrow="Recovery" title="Readiness" lede={latest?.explanation ?? "A check-in is required before Tamreen scores readiness."}>
      {latest?.blocked_for_safety ? <SafetyBanner /> : null}
      {latest ? (
        <p className="metric text-6xl font-bold">{latest.overall ?? "—"}</p>
      ) : null}
      <p className="text-sm">Recommendation: {latest?.train_recommendation?.replaceAll("_", " ") ?? "log a check-in"}</p>
      <RecoveryForm />
      <ul className="grid gap-2">
        {(logs ?? []).map((log) => (
          <li key={log.logged_on} className="app-card px-4 py-3 text-sm">
            {log.logged_on} · sleep {log.sleep_hours}h · soreness {log.soreness} · fatigue {log.fatigue} · motivation {log.motivation}
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}
