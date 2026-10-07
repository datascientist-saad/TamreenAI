import { PageFrame } from "@/components/page";
import { EmptyState } from "@/components/states";
import { formatClock, todayInTimeZone } from "@/lib/utils";
import { requireUser } from "@/server/guard";

export default async function RecordsPage() {
  const { supabase, user } = await requireUser();
  const { data: athlete } = await supabase.from("athlete_profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const today = todayInTimeZone(athlete?.timezone || "Asia/Qatar");
  const { data: records } = await supabase.from("personal_records").select("id, sport, record_type, value, unit, achieved_on, data_origin").eq("user_id", user.id).order("achieved_on", { ascending: false });
  const fresh = (records ?? []).filter((record) => today && record.achieved_on >= shift(today, -7));
  return (
    <PageFrame eyebrow="Records" title="Personal records" lede="A record is saved only when the new value beats the stored one.">
      {fresh.length ? <p className="rounded-2xl bg-gold/20 px-4 py-3 font-bold">New this week: {fresh.map((record) => record.record_type).join(", ")}</p> : null}
      {(records ?? []).length === 0 ? <EmptyState title="No records yet." body="Finish a lift, a timed run, an FTP test, or a swim that beats the previous best." /> : null}
      <ul className="grid gap-2">
        {(records ?? []).map((record) => (
          <li key={record.id} className="app-card flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs uppercase text-muted">{record.sport}{record.data_origin === "demo" ? " · demo" : ""}</p>
              <p className="font-bold capitalize">{record.record_type}</p>
            </div>
            <p className="metric text-xl">{record.unit.includes("second") ? formatClock(Number(record.value)) : `${record.value} ${record.unit}`}</p>
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}

function shift(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
