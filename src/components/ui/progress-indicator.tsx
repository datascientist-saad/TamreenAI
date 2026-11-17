import { cn } from "@/lib/utils";

export function ProgressIndicator({
  value,
  max = 100,
  label,
  className,
  tone = "brand",
}: {
  value: number;
  max?: number;
  label?: string;
  className?: string;
  tone?: "brand" | "success" | "warning" | "danger";
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  const fill =
    tone === "success" ? "bg-success"
    : tone === "warning" ? "bg-warning"
    : tone === "danger" ? "bg-danger"
    : "bg-maroon";

  return (
    <div className={cn("grid gap-1.5", className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold text-muted">{label}</span>
          <span className="metric text-xs font-bold">{pct}%</span>
        </div>
      ) : null}
      <div className="progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <span className={fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
