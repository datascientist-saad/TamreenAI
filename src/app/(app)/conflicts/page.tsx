import { PageFrame } from "@/components/page";
import { ExplainList } from "@/components/states";
import { optimizeOpenConflicts } from "@/server/actions";
import { requireUser } from "@/server/guard";

export default async function ConflictsPage() {
  const { supabase, user } = await requireUser();
  const { data: conflicts } = await supabase.from("training_conflicts").select("id, title, explanation, severity, status, recommendation").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12);
  return (
    <PageFrame eyebrow="Conflicts" title="Sessions that interfere" lede="Optimize moves supporting work off the day before a key quality session, within the days you said you can train.">
      <form action={async () => { "use server"; await optimizeOpenConflicts(); }}>
        <button className="btn btn-primary" type="submit">Optimize schedule</button>
      </form>
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
