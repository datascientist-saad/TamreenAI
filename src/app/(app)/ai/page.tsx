import { PageFrame } from "@/components/page";
import { CoachBox } from "@/features/ai/coach-box";
import { ExplainList } from "@/components/states";
import { requireUser } from "@/server/guard";

export default async function CoachPage() {
  const { supabase, user } = await requireUser();
  const { data: history } = await supabase
    .from("ai_recommendations")
    .select("id, title, body, status, factors, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);
  return (
    <PageFrame eyebrow="AI coach" title="Ask about today's plan" lede="Answers use your goal, today's session, readiness, conflicts, and event. A plan change stays pending until you accept it.">
      <CoachBox />
      <ul className="grid gap-3">
        {(history ?? []).map((item) => (
          <li key={item.id} className="app-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{item.status}</p>
            <h2 className="font-bold">{item.title}</h2>
            <p className="text-sm">{item.body}</p>
            <ExplainList factors={Array.isArray(item.factors) ? item.factors as Array<{ label: string; detail: string }> : []} />
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}
