import Link from "next/link";
import { NameField } from "@/features/profile/name-field";
import { PortraitEditor } from "@/features/profile/portrait-editor";
import { GoogleLinkButton } from "@/features/settings/google-link";
import { googlePhotoUrl, portraitChoice } from "@/lib/portrait";
import { sportLabels, type SportSlug } from "@/lib/sports";
import { signOut } from "@/server/actions";
import { requireUser } from "@/server/guard";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function relationName(value: unknown, fallback = ""): string {
  if (Array.isArray(value)) return relationName(value[0], fallback);
  if (value && typeof value === "object") {
    if ("name" in value && typeof (value as { name?: unknown }).name === "string") return (value as { name: string }).name;
    if ("slug" in value && typeof (value as { slug?: unknown }).slug === "string") {
      const slug = (value as { slug: string }).slug;
      return sportLabels[slug as SportSlug] ?? slug.replaceAll("_", " ");
    }
  }
  return fallback;
}

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: athlete }, { data: sportRows }, { data: goalRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_path, updated_at, date_of_birth, sex").eq("id", user.id).maybeSingle(),
    supabase.from("athlete_profiles").select("height_cm, weight_kg, experience_level, minutes_per_day, preferred_days, gym_access, pool_access, bike_access, timezone").eq("user_id", user.id).maybeSingle(),
    supabase.from("athlete_sports").select("is_primary, sports(name, slug)").eq("user_id", user.id),
    supabase.from("athlete_goals").select("is_primary, custom_label, goals(name, slug)").eq("user_id", user.id),
  ]);
  const name = profile?.full_name || "Athlete";
  const googleUrl = googlePhotoUrl(user);
  const portrait = portraitChoice({
    avatarPath: profile?.avatar_path,
    updatedAt: profile?.updated_at,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    googleUrl,
  });
  const googleLinked = Boolean(googleUrl || user.identities?.some((identity) => identity.provider === "google"));
  const sports = (sportRows ?? []).map((row) => ({
    name: relationName(row.sports, "Sport"),
    primary: Boolean(row.is_primary),
  }));
  const goals = (goalRows ?? []).map((row) => ({
    name: (typeof row.custom_label === "string" && row.custom_label.trim()) || relationName(row.goals, "Goal"),
    primary: Boolean(row.is_primary),
  }));
  const primaryGoal = goals.find((goal) => goal.primary)?.name ?? goals[0]?.name ?? "Not set yet";
  const days = (Array.isArray(athlete?.preferred_days) ? athlete.preferred_days as unknown[] : []).flatMap((day) => {
    const index = typeof day === "number" ? day : Number(day);
    return Number.isInteger(index) && index >= 0 && index <= 6 ? [index] : [];
  });
  const access = [
    athlete?.gym_access ? "Gym" : null,
    athlete?.pool_access ? "Pool" : null,
    athlete?.bike_access ? "Bike" : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6">
      <section className="overflow-hidden rounded-[2rem] bg-maroon text-white shadow-[var(--shadow)]">
        <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-center md:p-8">
          <PortraitEditor name={name} src={portrait.src} source={portrait.source} googleAvailable={googleLinked} />
          <div className="grid gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">Profile</p>
              <h1 className="mt-1 text-4xl font-extrabold tracking-tight">{name}</h1>
              <p className="mt-1 text-white/80">{user.email}</p>
              <p className="mt-3 text-sm text-white/80">Primary goal · {primaryGoal}</p>
            </div>
            <NameField name={name} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="app-card p-4">
          <p className="eyebrow">Experience</p>
          <p className="mt-2 text-2xl font-extrabold capitalize">{athlete?.experience_level ?? "Intermediate"}</p>
        </article>
        <article className="app-card p-4">
          <p className="eyebrow">Time</p>
          <p className="mt-2 text-2xl font-extrabold">{athlete?.minutes_per_day ?? 60} min</p>
          <p className="text-sm text-muted">Each training day</p>
        </article>
        <article className="app-card p-4">
          <p className="eyebrow">Body</p>
          <p className="mt-2 text-2xl font-extrabold">{athlete?.height_cm ? `${athlete.height_cm} cm` : "—"}</p>
          <p className="text-sm text-muted">{athlete?.weight_kg ? `${athlete.weight_kg} kg` : "Weight not set"}</p>
        </article>
      </section>

      <section className="app-card grid gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">Training days</h2>
          <Link className="text-sm font-bold text-maroon" href="/onboarding?focus=profile">Edit setup</Link>
        </div>
        <ul className="grid grid-cols-7 gap-2">
          {dayNames.map((label, index) => {
            const on = days.includes(index);
            return (
              <li key={label} className={`grid min-h-14 place-items-center rounded-2xl text-sm font-bold ${on ? "bg-maroon text-white" : "bg-paper text-muted"}`}>
                {label}
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted">{access.length ? access.join(" · ") : "No gym, pool, or bike access saved."} · {athlete?.timezone || "Asia/Qatar"}</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="app-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold">Sports</h2>
            <Link className="text-sm font-bold text-maroon" href="/onboarding?focus=profile">Edit</Link>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {sports.length === 0 ? <li className="text-sm text-muted">No sports yet.</li> : null}
            {sports.map((sport) => (
              <li key={sport.name} className="chip bg-maroon/10 text-maroon">{sport.name}{sport.primary ? " · primary" : ""}</li>
            ))}
          </ul>
        </article>
        <article className="app-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold">Goals</h2>
            <Link className="text-sm font-bold text-maroon" href="/onboarding?focus=goals">Edit</Link>
          </div>
          <ul className="mt-3 grid gap-2">
            {goals.length === 0 ? <li className="text-sm text-muted">No goal yet.</li> : null}
            {goals.map((goal) => (
              <li key={goal.name} className="rounded-xl bg-paper px-3 py-2 text-sm font-semibold">
                {goal.name}{goal.primary ? " · primary" : ""}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="app-card grid gap-3 p-5">
        <h2 className="text-xl font-extrabold">Google</h2>
        <p className="text-sm text-muted">
          {googleLinked ? "Google is connected. Its photo shows here until you upload your own." : "Connect Google to use that account photo, or upload one above."}
        </p>
        <GoogleLinkButton alreadyLinked={googleLinked} next="/profile" />
      </section>

      {(profile?.date_of_birth || profile?.sex) ? (
        <section className="app-card grid gap-1 p-5 text-sm">
          <h2 className="text-xl font-extrabold">About</h2>
          {profile?.date_of_birth ? <p>Born {profile.date_of_birth}</p> : null}
          {profile?.sex ? <p className="capitalize">{profile.sex.replaceAll("_", " ")}</p> : null}
        </section>
      ) : null}

      <section className="flex flex-wrap gap-2">
        <Link className="btn btn-primary" href="/plan">Training plan</Link>
        <Link className="btn btn-ghost" href="/settings">Settings</Link>
        <Link className="btn btn-ghost" href="/more">WHOOP and more</Link>
      </section>

      <form action={signOut}>
        <button className="btn btn-ghost" type="submit">Log out</button>
      </form>
    </main>
  );
}
