"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarDays, House, Menu, Video } from "lucide-react";
import { AvatarMark } from "./avatar";
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
  ["/health", "Health"],
  ["/nutrition", "Nutrition"],
  ["/recovery", "Recovery"],
  ["/weekly", "Weekly review"],
  ["/ai", "AI coach"],
  ["/analytics", "Analytics"],
  ["/records", "Records"],
  ["/events", "Events"],
  ["/triathlon", "Triathlon"],
  ["/profile", "Profile"],
  ["/settings", "Settings"],
] as const;

export function AppShell({
  children,
  roles,
  athlete,
}: {
  children: React.ReactNode;
  roles: string[];
  athlete: { name: string; avatarUrl: string | null };
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
        <div className="mt-auto grid gap-3">
          <Link href="/profile" className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-paper">
            <AvatarMark name={athlete.name} src={athlete.avatarUrl} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{athlete.name}</span>
              <span className="block text-xs text-muted">Profile</span>
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </aside>
      <div className="min-w-0 safe-bottom md:pb-0">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-line bg-card/95 px-3 py-2 backdrop-blur md:hidden">
          <Link href="/home" aria-label="Tamreen home" className="shrink-0"><Mark /></Link>
          <Link href="/plan" className={cn("btn shrink-0", pathname === "/plan" || pathname.startsWith("/plan/") ? "btn-primary" : "btn-ghost")}>Plan</Link>
          <Link href="/profile" aria-label="Profile" className="shrink-0"><AvatarMark name={athlete.name} src={athlete.avatarUrl} size={36} /></Link>
          <ThemeToggle compact />
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
                <Link href={tab.href} className={cn("grid w-full min-h-12 min-w-0 place-items-center px-0.5 text-center text-[11px] font-bold leading-tight", active ? "text-maroon" : "text-muted")}>
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
