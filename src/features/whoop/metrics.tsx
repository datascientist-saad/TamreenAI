import Link from "next/link";
import {
  formatMilliHours,
  formatOptionalNumber,
  formatPercent,
  formatStrain,
  type WhoopMetricView,
} from "@/services/wearables/whoop";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-paper px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="metric text-xl font-bold">{value}</p>
    </div>
  );
}

export function WhoopMetrics({
  metrics,
  compact = false,
}: {
  metrics: WhoopMetricView[];
  compact?: boolean;
}) {
  const latest = metrics[0];
  if (!latest) {
    return <p className="text-sm text-muted">No WHOOP days are stored yet. Sync to load recovery, strain, and sleep.</p>;
  }
  const tiles = [
    ["Recovery", formatPercent(latest.recoveryScore)],
    ["Strain", formatStrain(latest.strain)],
    ["Sleep", formatPercent(latest.sleepPerformancePercentage)],
    ["Asleep", formatMilliHours(latest.asleepMilli)],
    ["HRV", formatOptionalNumber(latest.hrvRmssdMilli, 0, " ms")],
    ["Resting HR", formatOptionalNumber(latest.restingHeartRate, 0, " bpm")],
  ];
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted">WHOOP · {latest.day}</p>
        {latest.userCalibrating ? <p className="text-sm text-muted">WHOOP is still calibrating recovery.</p> : null}
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.slice(0, compact ? 4 : tiles.length).map(([label, value]) => <Tile key={label} label={label} value={value} />)}
      </dl>
      {compact ? null : (
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Tile label="SpO2" value={formatPercent(latest.spo2Percentage)} />
          <Tile label="Skin temp" value={formatOptionalNumber(latest.skinTempCelsius, 1, " °C")} />
          <Tile label="Respiratory rate" value={formatOptionalNumber(latest.respiratoryRate, 1)} />
          <Tile label="Sleep efficiency" value={formatPercent(latest.sleepEfficiencyPercentage)} />
        </dl>
      )}
      {compact || metrics.length < 2 ? null : (
        <ul className="grid gap-2">
          {metrics.slice(1, 8).map((metric) => (
            <li key={metric.cycleId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
              <span className="font-semibold">{metric.day}</span>
              <span>Recovery {formatPercent(metric.recoveryScore)} · Strain {formatStrain(metric.strain)} · Sleep {formatMilliHours(metric.asleepMilli)}</span>
            </li>
          ))}
        </ul>
      )}
      {compact ? <Link className="text-sm font-bold text-maroon" href="/recovery">Open recovery</Link> : null}
    </div>
  );
}
