import Link from "next/link";
import { PageFrame } from "@/components/page";
import { submitFeedback } from "@/server/actions";
import { requireUser } from "@/server/guard";

const links = [
  ["/plan", "Training plan"],
  ["/calendar", "Calendar"],
  ["/recovery", "Recovery"],
  ["/ai", "AI coach"],
  ["/analytics", "Analytics"],
  ["/records", "Records"],
  ["/events", "Events"],
  ["/triathlon", "Triathlon"],
  ["/notifications", "Notifications"],
  ["/conflicts", "Conflicts"],
  ["/settings", "Settings"],
  ["/log/run", "Log a run"],
  ["/log/ride", "Log a ride"],
  ["/log/swim", "Log a swim"],
];

export default async function MorePage() {
  const { roles } = await requireUser().then(async (session) => {
    const { data } = await session.supabase.from("user_roles").select("role").eq("user_id", session.user.id).is("revoked_at", null);
    return { roles: (data ?? []).map((row) => row.role as string) };
  });
  const extra = [
    roles.includes("coach") ? ["/coach", "Coach desk"] : null,
    roles.includes("gym_admin") ? ["/gym", "Gym"] : null,
    roles.includes("event_admin") ? ["/event-admin", "Event desk"] : null,
    roles.includes("super_admin") ? ["/admin", "Admin"] : null,
  ].filter((item): item is [string, string] => Boolean(item));
  return (
    <PageFrame eyebrow="More" title="The rest of Tamreen">
      <ul className="grid gap-2">
        {[...links, ...extra].map(([href, label]) => (
          <li key={href}><Link className="app-card block px-4 py-3 font-semibold" href={href}>{label}</Link></li>
        ))}
      </ul>
      <form action={async (formData) => { "use server"; await submitFeedback(String(formData.get("body") || "")); }} className="app-card grid gap-3 p-4">
        <h2 className="font-bold">Feedback</h2>
        <textarea name="body" required placeholder="What should Tamreen explain more clearly?" />
        <button className="btn btn-primary" type="submit">Send</button>
      </form>
    </PageFrame>
  );
}
