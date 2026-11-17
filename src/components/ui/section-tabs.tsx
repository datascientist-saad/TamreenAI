"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type SectionTab = {
  id: string;
  label: string;
  href: string;
};

export function SectionTabs({
  tabs,
  param = "tab",
  defaultId,
  ariaLabel = "Sections",
}: {
  tabs: readonly SectionTab[];
  param?: string;
  defaultId?: string;
  ariaLabel?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(param) ?? defaultId ?? tabs[0]?.id;
  const pathMode = tabs.every((tab) => tab.href.startsWith("/") && !tab.href.includes("?"));

  return (
    <nav className="flex gap-1 overflow-x-auto overscroll-x-contain pb-0.5" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = pathMode
          ? pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          : current === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            scroll={false}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
              active ? "bg-maroon text-white" : "bg-card text-muted ring-1 ring-line hover:text-ink",
            )}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
