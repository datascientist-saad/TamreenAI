"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "overview", label: "Overview", href: "/recovery?tab=overview" },
  { id: "checkin", label: "Check-in", href: "/recovery?tab=checkin" },
  { id: "metrics", label: "Health", href: "/recovery?tab=metrics" },
  { id: "history", label: "Recovery", href: "/recovery?tab=history" },
  { id: "nutrition", label: "Nutrition", href: "/nutrition" },
] as const;

export function RecoverySectionTabs() {
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab = raw === "metrics" || raw === "history" || raw === "overview" || raw === "checkin"
    ? raw
    : "overview";

  return (
    <nav className="flex gap-1 overflow-x-auto overscroll-x-contain pb-0.5" aria-label="Body sections">
      {tabs.map((item) => {
        const active = item.id === "nutrition" ? false : tab === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            scroll={false}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
              active ? "bg-maroon text-white" : "bg-card text-muted ring-1 ring-line hover:text-ink",
            )}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
