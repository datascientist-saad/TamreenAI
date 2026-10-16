import { OnboardingWizard } from "@/features/onboarding/wizard";
import { requireUser } from "@/server/guard";

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const metadataName = typeof user.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name
    : typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : "";
  return <OnboardingWizard initialName={profile?.full_name || metadataName} />;
}
