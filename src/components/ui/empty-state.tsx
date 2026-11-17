import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  title,
  body,
  href,
  action,
  icon: Icon,
}: {
  title: string;
  body: string;
  href?: string;
  action?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="app-card grid gap-3 p-5">
      {Icon ? (
        <span className="grid h-10 w-10 place-items-center rounded-full bg-maroon-soft text-maroon">
          <Icon size={18} strokeWidth={1.75} aria-hidden />
        </span>
      ) : null}
      <div>
        <h2 className="section-title">{title}</h2>
        <p className="mt-1 text-sm text-muted">{body}</p>
      </div>
      {href && action ? (
        <Link className="btn btn-primary w-full sm:w-auto" href={href}>{action}</Link>
      ) : null}
    </div>
  );
}
