import Link from "next/link";
import { Sparkles } from "lucide-react";
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
    <PageFrame
      title="AI Coach"
      lede="Ask about today's plan, recovery, or event prep. Plan changes stay pending until you accept."
      compact
      actions={<Link className="btn btn-ghost btn-sm" href="/home">Home</Link>}
    >
      <div className="flex flex-wrap gap-2">
        {[
          ["Why was my plan changed?", "/ai"],
          ["How should I approach today's workout?", "/ai"],
          ["Why is my recovery lower?", "/ai"],
        ].map(([label]) => (
          <span key={label} className="chip bg-maroon-soft text-maroon normal-case tracking-normal">
            <Sparkles size={12} strokeWidth={1.75} aria-hidden />
            {label}
          </span>
        ))}
      </div>
      <CoachBox />
      <ul className="grid gap-2">
        {(history ?? []).map((item) => (
          <li key={item.id} className="app-card p-4">
            <p className="caption uppercase">{item.status}</p>
            <h2 className="mt-1 font-bold">{item.title}</h2>
            <p className="mt-1 text-sm text-muted line-clamp-3">{item.body}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-semibold text-maroon">Expand</summary>
              <p className="mt-2 text-sm">{item.body}</p>
              <ExplainList factors={Array.isArray(item.factors) ? item.factors as Array<{ label: string; detail: string }> : []} />
            </details>
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}
