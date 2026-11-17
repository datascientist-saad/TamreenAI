import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <article className={cn("app-card min-w-0 p-3.5 sm:p-4", className)}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {Icon ? <Icon size={14} strokeWidth={1.75} aria-hidden /> : null}
        {label}
      </p>
      <p className="metric mt-1.5 text-2xl font-bold tracking-tight">
        {value}
        {unit ? <span className="ml-1 text-sm font-semibold text-muted">{unit}</span> : null}
      </p>
      {hint ? <p className="caption mt-1">{hint}</p> : null}
    </article>
  );
}
