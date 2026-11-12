"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, HeartPulse, House, Menu, Video } from "lucide-react";
import { AvatarMark } from "./avatar";
import { Mark, Wordmark } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

/** Main mobile journeys: today, plan, live train, body check-in, everything else. */
const tabs = [
  { href: "/home", label: "Home", icon: House },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/live", label: "Live", icon: Video },
  { href: "/recovery", label: "Body", icon: HeartPulse },
  { href: "/more", label: "More", icon: Menu },
];

const sideGroups = [
  {
    label: "Train",
    items: [
      ["/home", "Home"],
      ["/plan", "Training plan"],
      ["/calendar", "Calendar"],
      ["/live", "Live training"],
    ],
  },
  {
    label: "Body & progress",
    items: [
      ["/recovery", "Recovery"],
      ["/progress", "Performance"],
      ["/records", "Records"],
      ["/analytics", "Analytics"],
    ],
  },
  {
    label: "Guidance",
    items: [
      ["/ai", "AI coach"],
    ],
  },
  {
    label: "Compete",
    items: [
      ["/events", "Events"],
      ["/triathlon", "Triathlon"],
    ],
  },
  {
    label: "Account",
    items: [
      ["/profile", "Profile"],
      ["/settings", "Settings"],
    ],
  },
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
  const desks = [
    roles.includes("coach") ? ["/coach", "Coach desk"] : null,
    roles.includes("gym_admin") ? ["/gym", "Gym"] : null,
    roles.includes("event_admin") ? ["/event-admin", "Event desk"] : null,
    roles.includes("super_admin") ? ["/admin", "Admin"] : null,
  ].filter((item): item is [string, string] => Boolean(item));

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-4 border-r border-line bg-card p-5 md:flex">
        <Link href="/home" aria-label="Tamreen home"><Wordmark /></Link>
        <nav className="grid min-h-0 gap-4 overflow-y-auto" aria-label="Primary">
          {sideGroups.map((group) => (
            <div key={group.label} className="grid gap-1">
              <p className="px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{group.label}</p>
              {group.items.map(([href, label]) => (
                <SideLink key={href} href={href} label={label} pathname={pathname} />
              ))}
            </div>
          ))}
          {desks.length ? (
            <div className="grid gap-1">
              <p className="px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Desks</p>
              {desks.map(([href, label]) => (
                <SideLink key={href} href={href} label={label} pathname={pathname} />
              ))}
            </div>
          ) : null}
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
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/recovery"
              className={cn("btn shrink-0", pathname === "/recovery" || pathname.startsWith("/recovery/") ? "btn-primary" : "btn-ghost")}
            >
              Check-in
            </Link>
            <Link href="/profile" aria-label="Profile" className="shrink-0">
              <AvatarMark name={athlete.name} src={athlete.avatarUrl} size={36} />
            </Link>
            <ThemeToggle compact />
          </div>
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
                  <span className={cn("grid h-10 w-10 place-items-center rounded-full", live && "bg-maroon text-white shadow-lg", active && !live && "bg-maroon/10")}>
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

function SideLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        "rounded-xl px-3 py-2 text-sm font-semibold",
        active ? "bg-maroon text-white" : "text-muted hover:bg-paper",
      )}
    >
      {label}
    </Link>
  );
}
