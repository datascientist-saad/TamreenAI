"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "checkin", label: "Check-in", href: "/recovery" },
  { id: "metrics", label: "Metrics", href: "/recovery?tab=metrics" },
  { id: "history", label: "History", href: "/recovery?tab=history" },
] as const;

export function RecoverySectionTabs() {
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab = raw === "metrics" || raw === "history" ? raw : "checkin";

  return (
    <nav className="grid grid-cols-3 gap-2" aria-label="Recovery sections">
      {tabs.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          scroll={false}
          className={cn(
            "rounded-2xl px-3 py-3 text-center text-sm font-bold",
            tab === item.id ? "bg-maroon text-white" : "bg-card text-muted ring-1 ring-line",
          )}
          aria-current={tab === item.id ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
