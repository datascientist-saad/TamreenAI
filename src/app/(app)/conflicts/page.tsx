import { PageFrame } from "@/components/page";
import { ExplainList } from "@/components/states";
import { OptimizeButton } from "@/features/plan/optimize-button";
import { requireUser } from "@/server/guard";

export default async function ConflictsPage() {
  const { supabase, user } = await requireUser();
  const { data: conflicts } = await supabase.from("training_conflicts").select("id, title, explanation, severity, status, recommendation").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12);
  const open = (conflicts ?? []).filter((conflict) => conflict.status === "open");
  return (
    <PageFrame eyebrow="Conflicts" title="Sessions that interfere" lede="Optimize moves the next two weeks inside the days you said you can train. The plan updates as soon as a session moves.">
      <OptimizeButton />
      {open.length === 0 ? <p className="text-sm text-muted">No open conflicts. The schedule already keeps the hard sessions apart, or there is nothing left to move.</p> : null}
      <ul className="grid gap-3">
        {(conflicts ?? []).map((conflict) => (
          <li key={conflict.id} className="app-card p-4">
            <p className="eyebrow">{conflict.severity} · {conflict.status}</p>
            <h2 className="text-xl font-bold">{conflict.title}</h2>
            <p className="mt-2">{conflict.explanation}</p>
            <ExplainList factors={factorsFrom(conflict.recommendation)} />
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}

function factorsFrom(recommendation: unknown): Array<{ label: string; detail: string }> {
  if (!recommendation || typeof recommendation !== "object" || !("factors" in recommendation)) return [];
  const factors = (recommendation as { factors?: unknown }).factors;
  if (!Array.isArray(factors)) return [];
  return factors.map((factor) => ({ label: "Factor", detail: String(factor) }));
}
