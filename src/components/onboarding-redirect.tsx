"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function OnboardingRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return;
    router.replace("/onboarding");
  }, [pathname, router]);
  return null;
}
