import Link from "next/link";
import { PageFrame } from "@/components/page";
import { GoogleLinkButton } from "@/features/settings/google-link";
import { WhoopConnect } from "@/features/settings/whoop-connect";
import { submitFeedback, signOut } from "@/server/actions";
import { requireUser } from "@/server/guard";
import { loadWhoopSnapshot } from "@/services/wearables/whoop-load";

const explore = [
  ["/recovery", "Recovery"],
  ["/ai", "AI coach"],
  ["/analytics", "Analytics"],
  ["/records", "Records"],
  ["/events", "Events"],
  ["/calendar", "Calendar"],
  ["/notifications", "Notifications"],
  ["/log/run", "Log a run"],
  ["/settings", "All settings"],
];

export default async function MorePage({ searchParams }: { searchParams: Promise<{ whoop?: string }> }) {
  const query = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: roles }, { data: profile }, { data: primaryGoalRow }, whoop] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id).is("revoked_at", null),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("athlete_goals").select("is_primary, goals(slug)").eq("user_id", user.id).eq("is_primary", true).maybeSingle(),
    loadWhoopSnapshot(supabase, user.id, 1),
  ]);
  const roleList = (roles ?? []).map((row) => row.role as string);
  const desks = [
    roleList.includes("coach") ? ["/coach", "Coach desk"] : null,
    roleList.includes("gym_admin") ? ["/gym", "Gym"] : null,
    roleList.includes("event_admin") ? ["/event-admin", "Event desk"] : null,
    roleList.includes("super_admin") ? ["/admin", "Admin"] : null,
  ].filter((item): item is [string, string] => Boolean(item));
  const googleLinked = Boolean(
    user.identities?.some((identity) => identity.provider === "google")
    || (Array.isArray(user.app_metadata?.providers) && user.app_metadata.providers.includes("google")),
  );
  const goalRelation = primaryGoalRow?.goals;
  const goalSlug = Array.isArray(goalRelation)
    ? goalRelation[0]?.slug
    : goalRelation && typeof goalRelation === "object" && "slug" in goalRelation
      ? String((goalRelation as { slug?: string }).slug ?? "")
      : "";
  const primaryGoal = goalSlug ? goalSlug.replaceAll("_", " ") : "Not set yet";

  return (
    <PageFrame eyebrow="More" title="Account and setup" lede="Profile, goals, and WHOOP live here. Everything else stays one tap away.">
      <section className="app-card grid gap-3 p-4">
        <h2 className="font-bold">Profile</h2>
        <p className="text-sm text-muted">
          {profile?.full_name || "Athlete"} · {user.email}
        </p>
        <Link className="btn btn-ghost w-fit" href="/onboarding?focus=profile">Edit profile</Link>
      </section>

      <section className="app-card grid gap-3 p-4">
        <h2 className="font-bold">Goals</h2>
        <p className="text-sm text-muted">Primary goal: {primaryGoal}</p>
        <Link className="btn btn-ghost w-fit" href="/onboarding?focus=goals">Edit goals</Link>
      </section>

      <section className="app-card grid gap-3 p-4">
        <h2 className="font-bold">WHOOP</h2>
        <WhoopConnect
          configured={whoop.configured}
          connection={whoop.connection}
          metrics={whoop.metrics}
          noticeCode={query.whoop}
        />
      </section>

      <section className="app-card grid gap-3 p-4">
        <h2 className="font-bold">Google</h2>
        <GoogleLinkButton alreadyLinked={googleLinked} />
      </section>

      <section className="grid gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Also</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[...explore, ...desks].map(([href, label]) => (
            <li key={href}>
              <Link className="block rounded-xl px-1 py-2 text-sm font-semibold text-ink underline-offset-4 hover:underline" href={href}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <form
        action={async (formData) => {
          "use server";
          await submitFeedback(String(formData.get("body") || ""));
        }}
        className="app-card grid gap-3 p-4"
      >
        <h2 className="font-bold">Feedback</h2>
        <textarea name="body" required placeholder="What should Tamreen explain more clearly?" />
        <button className="btn btn-primary" type="submit">Send</button>
      </form>

      <form action={signOut}>
        <button className="btn btn-ghost" type="submit">Log out</button>
      </form>
    </PageFrame>
  );
}
