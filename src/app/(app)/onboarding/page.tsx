import { OnboardingWizard } from "@/features/onboarding/wizard";
import { loadOnboardingDraft } from "@/server/queries";

export const maxDuration = 60;

const focusSteps = {
  profile: 0,
  goals: 2,
} as const;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const [params, draft] = await Promise.all([searchParams, loadOnboardingDraft()]);
  const focus = params.focus === "profile" || params.focus === "goals" ? params.focus : undefined;
  const initialStep = focus ? focusSteps[focus] : 0;
  return <OnboardingWizard initialStep={initialStep} draft={draft} />;
}
