"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Restore window scroll for list routes when returning via in-app Back. */
export function ScrollRestore({ storageKey }: { storageKey?: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const key = storageKey ?? `tamreen-scroll:${pathname}?${search.toString()}`;

  useEffect(() => {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const y = Number(raw);
      if (Number.isFinite(y) && y > 0) {
        requestAnimationFrame(() => window.scrollTo(0, y));
      }
    }
    function persist() {
      sessionStorage.setItem(key, String(window.scrollY));
    }
    window.addEventListener("scroll", persist, { passive: true });
    return () => {
      persist();
      window.removeEventListener("scroll", persist);
    };
  }, [key]);

  return null;
}
