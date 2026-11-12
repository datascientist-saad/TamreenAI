import Link from "next/link";
import { AvatarMark } from "@/components/avatar";
import { PageFrame } from "@/components/page";
import { GoogleLinkButton } from "@/features/settings/google-link";
import { StravaConnect } from "@/features/settings/strava-connect";
import { WhoopConnect } from "@/features/settings/whoop-connect";
import { googlePhotoUrl, portraitChoice } from "@/lib/portrait";
import { sportLabels, type SportSlug } from "@/lib/sports";
import { submitFeedback, signOut } from "@/server/actions";
import { requireUser } from "@/server/guard";
import { loadStravaSnapshot } from "@/services/wearables/strava-load";
import { loadWhoopSnapshot } from "@/services/wearables/whoop-load";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function relationSlug(value: unknown): string {
  if (Array.isArray(value)) return relationSlug(value[0]);
  if (value && typeof value === "object" && "slug" in value) {
    const slug = (value as { slug?: unknown }).slug;
    return typeof slug === "string" ? slug : "";
  }
  return "";
}

const journeyGroups = [
  {
    label: "Body & progress",
    items: [
      ["/recovery", "Recovery check-in", "Readiness, VO₂ max, WHOOP"],
      ["/health", "Health", "Measurements and fitness metrics"],
      ["/nutrition", "Nutrition", "Fueling and hydration"],
      ["/progress", "Performance", "Tamreen score by sport"],
      ["/records", "Records", "PRs, baselines, Strava"],
      ["/analytics", "Analytics", "Trends over time"],
      ["/weekly", "Weekly review", "What the last week taught"],
    ],
  },
  {
    label: "Train",
    items: [
      ["/calendar", "Calendar", "Week at a glance"],
      ["/log/run", "Log a run", "Manual endurance entry"],
      ["/log/ride", "Log a ride", "Power and FTP"],
      ["/log/swim", "Log a swim", "Pace and distance"],
      ["/ai", "AI coach", "Ask why the plan looks like this"],
    ],
  },
  {
    label: "Compete",
    items: [
      ["/events", "Events", "Race countdown and prep"],
      ["/triathlon", "Triathlon", "Brick and race focus"],
    ],
  },
  {
    label: "Account",
    items: [
      ["/notifications", "Notifications", "Alerts and reminders"],
      ["/settings", "Settings", "Units, theme, privacy"],
    ],
  },
] as const;

export default async function MorePage({ searchParams }: { searchParams: Promise<{ whoop?: string; strava?: string }> }) {
  const query = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: roles }, { data: profile }, { data: athlete }, { data: sportRows }, { data: primaryGoalRow }, whoop, strava] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id).is("revoked_at", null),
    supabase.from("profiles").select("full_name, avatar_path, updated_at").eq("id", user.id).maybeSingle(),
    supabase.from("athlete_profiles").select("preferred_days, minutes_per_day").eq("user_id", user.id).maybeSingle(),
    supabase.from("athlete_sports").select("sports(slug)").eq("user_id", user.id),
    supabase.from("athlete_goals").select("is_primary, goals(slug)").eq("user_id", user.id).eq("is_primary", true).maybeSingle(),
    loadWhoopSnapshot(supabase, user.id, 1),
    loadStravaSnapshot(supabase, user.id),
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
  const savedSports = (sportRows ?? []).flatMap((row) => {
    const slug = relationSlug(row.sports);
    return slug ? [sportLabels[slug as SportSlug] ?? slug] : [];
  });
  const savedDays = (Array.isArray(athlete?.preferred_days) ? athlete.preferred_days as unknown[] : []).flatMap((day) => {
    const index = typeof day === "number" ? day : Number(day);
    return Number.isInteger(index) && index >= 0 && index <= 6 ? [index] : [];
  }).sort((a, b) => a - b).map((day) => dayNames[day]);
  const portrait = portraitChoice({
    avatarPath: profile?.avatar_path,
    updatedAt: profile?.updated_at,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    googleUrl: googlePhotoUrl(user),
  });

  return (
    <PageFrame eyebrow="More" title="Journeys and setup" lede="Grouped shortcuts for training, body metrics, racing, and account tools.">
      <Link href="/profile" className="app-card grid grid-cols-[auto_1fr] items-center gap-4 p-4">
        <AvatarMark name={profile?.full_name || "Athlete"} src={portrait.src} size={64} />
        <span>
          <span className="block text-lg font-extrabold">{profile?.full_name || "Athlete"}</span>
          <span className="block text-sm text-muted">{user.email}</span>
          <span className="mt-1 block text-sm">Sports: {savedSports.length ? savedSports.join(", ") : "Not set yet"}</span>
          <span className="block text-sm">Days: {savedDays.length ? savedDays.join(", ") : "Not set yet"} · {athlete?.minutes_per_day ?? 60} min</span>
          <span className="block text-sm font-bold text-maroon">Open profile</span>
        </span>
      </Link>

      <section className="app-card grid gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Goals</h2>
          <Link className="text-sm font-bold text-maroon" href="/onboarding?focus=goals">Edit</Link>
        </div>
        <p className="text-sm text-muted">Primary goal: {primaryGoal}</p>
      </section>

      <section className="app-card grid gap-4 p-4">
        <div>
          <h2 className="font-bold">Connections</h2>
          <p className="text-sm text-muted">Wearables and account links stay together.</p>
        </div>
        <div className="grid gap-4">
          <div className="rounded-2xl bg-paper p-3">
            <h3 className="text-sm font-bold">WHOOP</h3>
            <div className="mt-2">
              <WhoopConnect
                configured={whoop.configured}
                connection={whoop.connection}
                metrics={whoop.metrics}
                noticeCode={query.whoop}
              />
            </div>
          </div>
          <div className="rounded-2xl bg-paper p-3">
            <h3 className="text-sm font-bold">Strava</h3>
            <div className="mt-2">
              <StravaConnect
                configured={strava.configured}
                connection={strava.connection}
                noticeCode={query.strava}
              />
            </div>
          </div>
          <div className="rounded-2xl bg-paper p-3">
            <h3 className="text-sm font-bold">Google</h3>
            <div className="mt-2">
              <GoogleLinkButton alreadyLinked={googleLinked} />
            </div>
          </div>
        </div>
      </section>

      {journeyGroups.map((group) => (
        <section key={group.label} className="grid gap-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{group.label}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {group.items.map(([href, label, hint]) => (
              <li key={href}>
                <Link className="app-card block px-4 py-3 hover:bg-paper" href={href}>
                  <span className="block font-bold">{label}</span>
                  <span className="block text-sm text-muted">{hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {desks.length ? (
        <section className="grid gap-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Desks</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {desks.map(([href, label]) => (
              <li key={href}>
                <Link className="app-card block px-4 py-3 font-bold hover:bg-paper" href={href}>{label}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
