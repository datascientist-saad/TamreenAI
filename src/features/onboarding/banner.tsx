"use client";

import { usePathname } from "next/navigation";

export function OnboardingBanner() {
  const path = usePathname();
  if (path === "/onboarding") return null;
  return (
    <div className="border-b border-gold/40 bg-gold/15 px-4 py-3 text-sm">
      Finish onboarding so Tamreen can build one plan across your sports. <a className="font-bold underline" href="/onboarding">Continue</a>
    </div>
  );
}
