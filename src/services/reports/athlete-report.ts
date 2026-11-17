import { formatDistanceKm } from "@/services/events/catalog";

export type AthleteReportData = {
  generatedAt: string;
  period: { from: string; to: string };
  athlete: {
    name: string;
    experience: string | null;
    sports: string[];
    goals: string[];
  };
  summary: {
    completedWorkouts: number;
    totalMinutes: number;
    completionRate: number | null;
    bySport: Array<{ sport: string; count: number; minutes: number }>;
  };
  recovery: Array<{ day: string; sleep: number | null; readiness: number | null; hrv: number | null; restingHr: number | null; fatigue: number | null; soreness: number | null }>;
  events: Array<{
    name: string;
    date: string;
    priority: string;
    distances: string;
    linkedSessions: number;
  }>;
  records: Array<{ sport: string; recordType: string; value: string; achievedOn: string }>;
  insights: string[];
};

export function buildAthleteReportHtml(data: AthleteReportData): string {
  const rows = data.recovery.map((row) => `
    <tr>
      <td>${escapeHtml(row.day)}</td>
      <td>${row.sleep ?? "—"}</td>
      <td>${row.readiness ?? "—"}</td>
      <td>${row.hrv ?? "—"}</td>
      <td>${row.restingHr ?? "—"}</td>
      <td>${row.fatigue ?? "—"}</td>
      <td>${row.soreness ?? "—"}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Tamreen AI Athlete Report</title>
  <style>
    :root { --maroon:#8a1538; --ink:#1f1115; --muted:#6b6066; --line:#e8e2e4; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; color: var(--ink); background: #fff; }
    .page { max-width: 900px; margin: 0 auto; padding: 32px 24px 48px; }
    header { border-bottom: 3px solid var(--maroon); padding-bottom: 16px; margin-bottom: 24px; }
    h1 { margin: 0; color: #000; font-size: 28px; }
    h2 { margin: 28px 0 10px; color: #000; font-size: 18px; border-left: 4px solid var(--maroon); padding-left: 10px; }
    .eyebrow { color: var(--maroon); text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; font-weight: 700; }
    .muted { color: var(--muted); }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .card { border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
    .metric { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid var(--line); padding: 8px 6px; text-align: left; }
    th { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    ul { padding-left: 18px; }
    footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; display: flex; justify-content: space-between; }
    @media print {
      .page { padding: 0; }
      .no-print { display: none !important; }
      h2 { break-after: avoid; }
      table, .card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="no-print" style="margin-bottom:16px;">
      <button onclick="window.print()" style="background:var(--maroon);color:#fff;border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;">Print / Save as PDF</button>
    </div>
    <header>
      <p class="eyebrow">Tamreen AI</p>
      <h1>Athlete Performance Report</h1>
      <p class="muted">${escapeHtml(data.athlete.name)} · ${escapeHtml(data.period.from)} to ${escapeHtml(data.period.to)}</p>
    </header>

    <h2>1. Athlete overview</h2>
    <div class="grid">
      <div class="card"><div class="muted">Experience</div><div>${escapeHtml(data.athlete.experience || "—")}</div></div>
      <div class="card"><div class="muted">Sports</div><div>${escapeHtml(data.athlete.sports.join(", ") || "—")}</div></div>
      <div class="card"><div class="muted">Goals</div><div>${escapeHtml(data.athlete.goals.join(", ") || "—")}</div></div>
    </div>

    <h2>2. Executive summary</h2>
    <div class="grid">
      <div class="card"><div class="muted">Completed workouts</div><div class="metric">${data.summary.completedWorkouts}</div></div>
      <div class="card"><div class="muted">Total duration</div><div class="metric">${data.summary.totalMinutes} min</div></div>
      <div class="card"><div class="muted">Completion rate</div><div class="metric">${data.summary.completionRate == null ? "—" : `${data.summary.completionRate}%`}</div></div>
    </div>

    <h2>3. Training breakdown</h2>
    <table>
      <thead><tr><th>Sport</th><th>Sessions</th><th>Minutes</th></tr></thead>
      <tbody>
        ${data.summary.bySport.map((row) => `<tr><td>${escapeHtml(row.sport)}</td><td>${row.count}</td><td>${row.minutes}</td></tr>`).join("") || `<tr><td colspan="3">No completed sessions in this period.</td></tr>`}
      </tbody>
    </table>

    <h2>4. Recovery and readiness</h2>
    <table>
      <thead><tr><th>Day</th><th>Sleep h</th><th>Readiness</th><th>HRV</th><th>RHR</th><th>Fatigue</th><th>Soreness</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7">No recovery logs in this period.</td></tr>`}</tbody>
    </table>

    <h2>5. Event preparation</h2>
    ${data.events.length ? data.events.map((event) => `
      <div class="card" style="margin-bottom:8px;">
        <strong>${escapeHtml(event.name)}</strong>
        <div class="muted">${escapeHtml(event.priority)} · ${escapeHtml(event.date)} · ${escapeHtml(event.distances)}</div>
        <div>Linked planned sessions: ${event.linkedSessions}</div>
      </div>`).join("") : `<p class="muted">No active events in this report window.</p>`}

    <h2>6. Performance trends</h2>
    <table>
      <thead><tr><th>Sport</th><th>Record</th><th>Value</th><th>Date</th></tr></thead>
      <tbody>
        ${data.records.map((row) => `<tr><td>${escapeHtml(row.sport)}</td><td>${escapeHtml(row.recordType)}</td><td>${escapeHtml(row.value)}</td><td>${escapeHtml(row.achievedOn)}</td></tr>`).join("") || `<tr><td colspan="4">No personal records stored.</td></tr>`}
      </tbody>
    </table>

    <h2>7. Personalized insights</h2>
    <ul>
      ${data.insights.map((insight) => `<li>${escapeHtml(insight)}</li>`).join("")}
    </ul>

    <footer>
      <span>Generated ${escapeHtml(data.generatedAt)}</span>
      <span>Page content is athlete-owned · Tamreen AI</span>
    </footer>
  </div>
</body>
</html>`;
}

export function buildInsights(data: Omit<AthleteReportData, "insights">): string[] {
  const insights: string[] = [];
  if (data.summary.completedWorkouts === 0) {
    insights.push("No completed workouts were found in this period, so improvement claims are withheld.");
  } else {
    insights.push(`Logged ${data.summary.completedWorkouts} completed sessions totaling ${data.summary.totalMinutes} minutes.`);
    const top = [...data.summary.bySport].sort((a, b) => b.minutes - a.minutes)[0];
    if (top) insights.push(`Largest training volume was ${top.sport} (${top.minutes} minutes across ${top.count} sessions).`);
  }
  const readinessValues = data.recovery.map((row) => row.readiness).filter((value): value is number => value != null);
  if (readinessValues.length >= 3) {
    const avg = Math.round(readinessValues.reduce((sum, value) => sum + value, 0) / readinessValues.length);
    insights.push(`Average readiness across ${readinessValues.length} scored days was ${avg}/100.`);
  } else {
    insights.push("Not enough readiness scores to summarize a trend.");
  }
  if (data.events.length) {
    insights.push(`Active event targets: ${data.events.map((event) => `${event.name} on ${event.date}`).join("; ")}.`);
  }
  if (!data.records.length) insights.push("No personal records are stored for this athlete yet.");
  return insights;
}

export function describeEventDistances(event: { distance_m?: number | null; swim_m?: number | null; bike_m?: number | null; run_m?: number | null }) {
  if (event.swim_m || event.bike_m || event.run_m) {
    return `Swim ${formatDistanceKm(event.swim_m)} · Bike ${formatDistanceKm(event.bike_m)} · Run ${formatDistanceKm(event.run_m)}`;
  }
  return formatDistanceKm(event.distance_m);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
