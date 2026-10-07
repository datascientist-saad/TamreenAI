"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarDays, House, Menu, Video } from "lucide-react";
import { Mark, Wordmark } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/home", label: "Home", icon: House },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/live", label: "Live", icon: Video },
  { href: "/progress", label: "Progress", icon: Activity },
  { href: "/more", label: "More", icon: Menu },
];

const side = [
  ["/home", "Home"],
  ["/plan", "Training plan"],
  ["/calendar", "Calendar"],
  ["/live", "Live training"],
  ["/progress", "Performance"],
  ["/recovery", "Recovery"],
  ["/ai", "AI coach"],
  ["/analytics", "Analytics"],
  ["/records", "Records"],
  ["/events", "Events"],
  ["/triathlon", "Triathlon"],
  ["/settings", "Settings"],
] as const;

export function AppShell({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles: string[];
}) {
  const pathname = usePathname();
  const extra = [
    roles.includes("coach") ? ["/coach", "Coach desk"] : null,
    roles.includes("gym_admin") ? ["/gym", "Gym"] : null,
    roles.includes("event_admin") ? ["/event-admin", "Event desk"] : null,
    roles.includes("super_admin") ? ["/admin", "Admin"] : null,
  ].filter((item): item is [string, string] => Boolean(item));

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-4 border-r border-line bg-card p-5 md:flex">
        <Link href="/home" aria-label="Tamreen home"><Wordmark /></Link>
        <Link href="/plan" className="btn btn-primary">Open plan</Link>
        <nav className="grid min-h-0 gap-1 overflow-y-auto" aria-label="Primary">
          {[...side, ...extra].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold",
                pathname === href || pathname.startsWith(`${href}/`) ? "bg-maroon text-white" : "text-muted hover:bg-paper",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <ThemeToggle />
        </div>
      </aside>
      <div className="safe-bottom md:pb-0">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line bg-card/95 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/home" aria-label="Tamreen home"><Mark /></Link>
          <Link href="/plan" className={cn("btn min-h-10 px-4", pathname === "/plan" || pathname.startsWith("/plan/") ? "btn-primary" : "btn-ghost")}>Plan</Link>
          <ThemeToggle />
        </header>
        {children}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Mobile">
        <ul className="grid grid-cols-5">
          {tabs.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            const Icon = tab.icon;
            const live = tab.href === "/live";
            return (
              <li key={tab.href} className="grid place-items-center py-2">
                <Link href={tab.href} className={cn("grid min-h-12 min-w-12 place-items-center text-[11px] font-bold", active ? "text-maroon" : "text-muted")}>
                  <span className={cn("grid h-10 w-10 place-items-center rounded-full", live && "bg-maroon text-white shadow-lg")}>
                    <Icon size={18} />
                  </span>
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
