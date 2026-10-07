import Link from "next/link";
import { PageFrame } from "@/components/page";
import { requireRole } from "@/server/guard";

export default async function AdminPage() {
  const { supabase } = await requireRole("super_admin");
  const [{ data: overview, error }, { data: users }] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.rpc("admin_list_users"),
  ]);
  const stats = overview && typeof overview === "object" ? overview as Record<string, number> : {};
  const list = Array.isArray(users) ? users as Array<{ id: string; full_name: string; is_demo: boolean; roles: string[]; onboarding_completed: boolean }> : [];
  return (
    <PageFrame eyebrow="Admin" title="System" lede="Opening this page writes an audit log. Athlete health data is loaded through a checked database function, not a blanket policy.">
      {error ? <p className="text-sm text-live">{error.message}</p> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(stats).map(([key, value]) => (
          <article key={key} className="app-card p-4">
            <p className="text-xs uppercase text-muted">{key.replaceAll("_", " ")}</p>
            <p className="metric text-3xl font-bold">{value}</p>
          </article>
        ))}
      </div>
      <p className="text-sm text-muted">System health: the database answered this request.</p>
      <ul className="grid gap-2">
        {list.map((person) => (
          <li key={person.id}>
            <Link className="app-card flex items-center justify-between px-4 py-3" href={`/admin/athletes/${person.id}`}>
              <span>{person.full_name || person.id}{person.is_demo ? " · demo" : ""}</span>
              <span className="text-xs text-muted">{(person.roles ?? []).join(", ")}{person.onboarding_completed ? "" : " · onboarding"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}
