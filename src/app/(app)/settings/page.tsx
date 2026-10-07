import Link from "next/link";
import { PageFrame } from "@/components/page";
import { DeviceList } from "@/features/settings/devices";
import { SettingsForm } from "@/features/settings/form";
import { wearableProviders } from "@/services/wearables/providers";
import { signOut, respondToCoach } from "@/server/actions";
import { requireUser } from "@/server/guard";

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const [{ data: settings }, { data: profile }, { data: subscription }, { data: invites }] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("subscriptions").select("plan_code, status, current_period_end").eq("user_id", user.id).maybeSingle(),
    supabase.from("coach_athletes").select("id, status, coach_id").eq("athlete_id", user.id),
  ]);
  const notifications = {
    workout: settings?.notify_workout ?? true,
    recovery: settings?.notify_recovery ?? true,
    conflicts: settings?.notify_conflicts ?? true,
    prs: settings?.notify_prs ?? true,
    events: settings?.notify_events ?? true,
    coach: settings?.notify_coach ?? true,
    plan: settings?.notify_plan_changes ?? true,
  };
  return (
    <PageFrame eyebrow="Settings" title={profile?.full_name || "Account"}>
      <section className="app-card p-4">
        <h2 className="font-bold">Sports, goals, and availability</h2>
        <p className="text-sm text-muted">Updating onboarding rebuilds future planned sessions. Completed history stays.</p>
        <Link className="btn btn-ghost mt-3" href="/onboarding">Edit onboarding</Link>
      </section>
      <section className="app-card p-4">
        <h2 className="font-bold">Units, notifications, appearance</h2>
        <SettingsForm
          unitSystem={settings?.unit_system === "imperial" ? "imperial" : "metric"}
          distanceUnit={settings?.distance_unit === "mi" ? "mi" : "km"}
          weightUnit={settings?.weight_unit === "lb" ? "lb" : "kg"}
          theme={settings?.theme === "light" || settings?.theme === "dark" ? settings.theme : "system"}
          notifications={notifications}
        />
      </section>
      <section className="app-card p-4">
        <h2 className="font-bold">Connected devices and apps</h2>
        <p className="mb-3 text-sm text-muted">None of these providers are authorized. Tamreen will not show imported workouts.</p>
        <DeviceList providers={wearableProviders.map((provider) => ({ id: provider.id, name: provider.displayName }))} />
      </section>
      <section className="app-card p-4">
        <h2 className="font-bold">Privacy</h2>
        <p className="text-sm text-muted">Coaches see training only after you accept their link. Gym cameras do not use facial recognition. Live recordings stay in a private bucket.</p>
      </section>
      <section className="app-card p-4">
        <h2 className="font-bold">Data</h2>
        <a className="btn btn-ghost mt-2" href="/api/me/export">Download your data</a>
      </section>
      <section className="app-card p-4">
        <h2 className="font-bold">Subscription</h2>
        <p className="text-sm">{subscription?.plan_code ?? "free"} · {subscription?.status ?? "active"}{subscription?.current_period_end ? ` · until ${subscription.current_period_end}` : ""}</p>
      </section>
      <section className="app-card p-4">
        <h2 className="font-bold">Coach access</h2>
        <ul className="mt-2 grid gap-2">
          {(invites ?? []).map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{invite.status}</span>
              {invite.status === "pending" ? (
                <span className="flex gap-2">
                  <form action={async () => { "use server"; await respondToCoach(invite.id, true); }}><button className="btn btn-primary" type="submit">Accept</button></form>
                  <form action={async () => { "use server"; await respondToCoach(invite.id, false); }}><button className="btn btn-ghost" type="submit">Decline</button></form>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="app-card p-4">
        <h2 className="font-bold">Account</h2>
        <p className="text-sm text-muted">{user.email}</p>
        <form action={signOut}><button className="btn btn-ghost mt-3" type="submit">Log out</button></form>
      </section>
    </PageFrame>
  );
}
