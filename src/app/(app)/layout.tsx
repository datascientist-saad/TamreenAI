import { redirect } from "next/navigation";
import { OnboardingRedirect } from "@/components/onboarding-redirect";
import { AppShell } from "@/components/shell";
import { SetupScreen } from "@/components/states";
import { googlePhotoUrl, portraitChoice } from "@/lib/portrait";
import { RegisterWorker } from "@/components/register-worker";
import { getAuth } from "@/server/guard";

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getAuth();
  if (!supabase) return <SetupScreen />;
  if (!user) redirect("/login");
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("full_name, onboarding_completed, avatar_path, updated_at").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id).is("revoked_at", null),
  ]);
  const portrait = portraitChoice({
    avatarPath: profile?.avatar_path,
    updatedAt: profile?.updated_at,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    googleUrl: googlePhotoUrl(user),
  });
  return (
    <>
      <RegisterWorker />
      <AppShell
        roles={(roles ?? []).map((role) => role.role as string)}
        athlete={{ name: profile?.full_name || "Athlete", avatarUrl: portrait.src }}
      >
        {profile?.onboarding_completed === true ? null : <OnboardingRedirect />}
        {children}
      </AppShell>
    </>
  );
}
