import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { SetupScreen } from "@/components/states";
import { createClient } from "@/lib/supabase/server";
import { RegisterWorker } from "@/components/register-worker";

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  if (!supabase) return <SetupScreen />;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("onboarding_completed").eq("id", data.user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", data.user.id).is("revoked_at", null),
  ]);
  return (
    <>
      <RegisterWorker />
      <AppShell roles={(roles ?? []).map((role) => role.role as string)}>
        {profile && !profile.onboarding_completed ? <OnboardingGate /> : null}
        {children}
      </AppShell>
    </>
  );
}

function OnboardingGate() {
  return (
    <div className="border-b border-gold/40 bg-gold/15 px-4 py-3 text-sm">
      Finish onboarding so Tamreen can build one plan across your sports. <a className="font-bold underline" href="/onboarding">Continue</a>
    </div>
  );
}
