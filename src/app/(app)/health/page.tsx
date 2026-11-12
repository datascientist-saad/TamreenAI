import { HeartPulse, Activity, Wind, Moon, Droplets } from "lucide-react";
import { PageFrame } from "@/components/page";
import { DeleteMeasurementButton, HealthEntryForm } from "@/features/health/forms";
import { TrendChart } from "@/features/analytics/trend";
import { requireUser } from "@/server/guard";

const categoryIcons: Record<string, typeof HeartPulse> = {
  cardiovascular: HeartPulse,
  aerobic: Wind,
  sleep: Moon,
  recovery: Activity,
  lifestyle: Droplets,
  body: Activity,
};

export default async function HealthPage() {
  const { supabase, user } = await requireUser();
  const [{ data: prefs }, { data: definitions }, { data: measurements }] = await Promise.all([
    supabase.from("athlete_preferences").select("health_data_consent").eq("user_id", user.id).maybeSingle(),
    supabase.from("health_metric_definitions").select("slug, category, display_name, default_unit").order("category"),
    supabase.from("health_measurements").select("id, metric_slug, value, unit, measured_at, method, source, notes").eq("user_id", user.id).is("deleted_at", null).order("measured_at", { ascending: false }).limit(80),
  ]);

  const latest = new Map<string, NonNullable<typeof measurements>[number]>();
  for (const row of measurements ?? []) {
    if (!latest.has(row.metric_slug)) latest.set(row.metric_slug, row);
  }

  const hrvTrend = (measurements ?? [])
    .filter((row) => row.metric_slug === "hrv" && row.value != null)
    .slice(0, 14)
    .reverse()
    .map((row) => ({ label: row.measured_at.slice(5, 10), value: Number(row.value) }));

  const byCategory = new Map<string, Array<{ slug: string; display_name: string; default_unit: string }>>();
  for (const def of definitions ?? []) {
    const list = byCategory.get(def.category) ?? [];
    list.push(def);
    byCategory.set(def.category, list);
  }

  return (
    <PageFrame eyebrow="Health" title="Manual health tracking" lede="Enter measurements yourself. Source and method stay visible. Missing values stay blank — Tamreen does not invent them.">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {["resting_hr", "hrv", "vo2_max", "sleep_score"].map((slug) => {
          const def = (definitions ?? []).find((row) => row.slug === slug);
          const row = latest.get(slug);
          return (
            <article key={slug} className="app-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{def?.display_name ?? slug}</p>
              <p className="metric mt-1 text-3xl font-bold">{row?.value ?? "—"}</p>
              <p className="text-xs text-muted">{row ? `${row.unit} · ${row.source}${row.method ? ` · ${row.method}` : ""}` : def?.default_unit}</p>
            </article>
          );
        })}
      </section>

      {hrvTrend.length > 1 ? (
        <section className="app-card p-4">
          <h2 className="font-bold">HRV trend</h2>
          <TrendChart points={hrvTrend} dataKey="value" />
        </section>
      ) : null}

      <section className="app-card grid gap-3 p-4">
        <h2 className="font-bold">Add measurement</h2>
        <HealthEntryForm consent={Boolean(prefs?.health_data_consent)} />
      </section>

      {[...byCategory.entries()].map(([category, defs]) => {
        const Icon = categoryIcons[category] ?? Activity;
        return (
          <section key={category} className="grid gap-2">
            <h2 className="flex items-center gap-2 font-bold capitalize"><Icon size={18} strokeWidth={1.75} /> {category}</h2>
            <ul className="grid gap-2">
              {defs.map((def) => {
                const row = latest.get(def.slug);
                return (
                  <li key={def.slug} className="app-card flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span>
                      <span className="font-semibold">{def.display_name}</span>
                      <span className="block text-xs text-muted">
                        {row ? `${row.value ?? "—"} ${row.unit} · ${row.source}${row.method ? ` · ${row.method}` : ""} · ${row.measured_at.slice(0, 16).replace("T", " ")}` : "No entry yet"}
                      </span>
                    </span>
                    {row ? <DeleteMeasurementButton id={row.id} /> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </PageFrame>
  );
}
