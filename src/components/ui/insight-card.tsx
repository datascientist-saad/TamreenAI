import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";

export function InsightCard({
  title,
  body,
  href,
  action = "Details",
}: {
  title: string;
  body: string;
  href?: string;
  action?: string;
}) {
  return (
    <article className="app-card grid gap-2 border-l-2 border-l-maroon p-4">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-maroon">
        <Sparkles size={14} strokeWidth={1.75} aria-hidden />
        AI Coach
      </p>
      <h3 className="section-title">{title}</h3>
      <p className="text-sm text-muted line-clamp-3">{body}</p>
      {href ? (
        <Link className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-maroon" href={href}>
          {action}
          <ChevronRight size={14} strokeWidth={1.75} aria-hidden />
        </Link>
      ) : null}
    </article>
  );
}
