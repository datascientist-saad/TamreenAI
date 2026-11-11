import { PageFrame } from "@/components/page";
import { WeeklyReviewActions } from "@/features/weekly/actions";
import { requireUser } from "@/server/guard";

export default async function WeeklyPage() {
  const { supabase, user } = await requireUser();
  const { data: reviews } = await supabase
    .from("weekly_reviews")
    .select("week_start, week_end, summary, metrics, proposed_adjustments, status, athlete_notes")
    .eq("user_id", user.id)
    .order("week_start", { ascending: false })
    .limit(4);
  const latest = reviews?.[0] ?? null;

  return (
    <PageFrame eyebrow="Weekly review" title="What the week showed" lede="Compare planned vs completed work, recovery, and nutrition. Significant next-week changes wait for your approval.">
      <WeeklyReviewActions latestWeekStart={latest?.week_start ?? null} status={latest?.status ?? null} />
      {latest ? (
        <article className="app-card grid gap-3 p-4">
          <p className="eyebrow">{latest.week_start} → {latest.week_end} · {latest.status}</p>
          <p>{latest.summary}</p>
          <ul className="grid gap-2 text-sm">
            {(Array.isArray(latest.proposed_adjustments) ? latest.proposed_adjustments : []).map((item, index) => {
              const row = item as { title?: string; detail?: string; requiresApproval?: boolean };
              return (
                <li key={`${row.title}-${index}`} className="rounded-2xl border border-line px-3 py-2">
                  <p className="font-semibold">{row.title}</p>
                  <p className="text-muted">{row.detail}</p>
                  {row.requiresApproval ? <p className="text-xs font-bold text-maroon">Needs approval</p> : null}
                </li>
              );
            })}
          </ul>
        </article>
      ) : (
        <p className="text-sm text-muted">Generate a review once you have a week of planned or completed sessions.</p>
      )}
      <ul className="grid gap-2">
        {(reviews ?? []).slice(1).map((review) => (
          <li key={review.week_start} className="app-card px-4 py-3 text-sm">
            <p className="font-semibold">{review.week_start} · {review.status}</p>
            <p className="text-muted">{review.summary}</p>
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}
