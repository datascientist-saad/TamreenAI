"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChartNoAxesCombined,
  Dumbbell,
  Ellipsis,
  House,
} from "lucide-react";
import { AvatarMark } from "./avatar";
import { Mark, Wordmark } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

/** Primary athlete destinations — same five on mobile bottom nav and desktop sidebar. */
const tabs = [
  { href: "/home", label: "Today", icon: House },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/train", label: "Train", icon: Dumbbell },
  { href: "/progress", label: "Progress", icon: ChartNoAxesCombined },
  { href: "/more", label: "More", icon: Ellipsis },
] as const;

const sideGroups = [
  {
    label: "Today",
    items: [
      ["/home", "Today"],
      ["/recovery?tab=checkin", "Daily check-in"],
    ],
  },
  {
    label: "Plan",
    items: [
      ["/plan", "Weekly schedule"],
      ["/plan?tab=events", "Events"],
      ["/calendar", "Month calendar"],
      ["/conflicts", "Conflicts"],
    ],
  },
  {
    label: "Train",
    items: [
      ["/train", "Train hub"],
      ["/live", "Live camera"],
      ["/train#log", "Log activity"],
    ],
  },
  {
    label: "Progress",
    items: [
      ["/progress", "Performance"],
      ["/records", "Training history"],
      ["/analytics", "Trends"],
      ["/recovery", "Recovery & body"],
      ["/weekly", "Weekly review"],
    ],
  },
  {
    label: "More",
    items: [
      ["/more", "All shortcuts"],
      ["/nutrition", "Nutrition"],
      ["/ai", "AI coach"],
      ["/profile", "Profile"],
      ["/settings", "Settings"],
      ["/notifications", "Notifications"],
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
  const hideChrome = pathname.startsWith("/live/") && !pathname.startsWith("/live/report");
  const desks = [
    roles.includes("coach") ? ["/coach", "Coach desk"] : null,
    roles.includes("gym_admin") ? ["/gym", "Gym"] : null,
    roles.includes("event_admin") ? ["/event-admin", "Event desk"] : null,
    roles.includes("super_admin") ? ["/admin", "Admin"] : null,
  ].filter((item): item is [string, string] => Boolean(item));

  if (hideChrome) {
    return <div className="min-h-screen bg-paper">{children}</div>;
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-4 border-r border-line bg-card p-4 md:flex">
        <Link href="/home" aria-label="Tamreen Today" className="btn btn-ghost justify-start border-transparent px-2">
          <Wordmark />
        </Link>
        <nav className="grid min-h-0 gap-3 overflow-y-auto pr-1" aria-label="Primary">
          {sideGroups.map((group) => (
            <div key={group.label} className="grid gap-0.5">
              <p className="px-3 pb-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{group.label}</p>
              {group.items.map(([href, label]) => (
                <SideLink key={href} href={href} label={label} pathname={pathname} />
              ))}
            </div>
          ))}
          {desks.length ? (
            <div className="grid gap-0.5">
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Desks</p>
              {desks.map(([href, label]) => (
                <SideLink key={href} href={href} label={label} pathname={pathname} />
              ))}
            </div>
          ) : null}
        </nav>
        <div className="mt-auto grid gap-2">
          <Link
            href="/profile"
            className="flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
          >
            <AvatarMark name={athlete.name} src={athlete.avatarUrl} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{athlete.name}</span>
              <span className="block text-xs text-muted">Profile</span>
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </aside>

      <div className="relative z-0 min-w-0 safe-bottom">
        <header className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-line bg-card/95 px-3 py-2 backdrop-blur safe-top md:hidden pointer-events-auto">
          <Link
            href="/home"
            aria-label="Tamreen Today"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
          >
            <Mark />
          </Link>
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              href="/notifications"
              className="btn btn-ghost btn-sm min-h-11 min-w-11"
              aria-label="Notifications"
            >
              Alerts
            </Link>
            <Link
              href="/profile"
              aria-label="Profile"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
            >
              <AvatarMark name={athlete.name} src={athlete.avatarUrl} size={34} />
            </Link>
          </div>
        </header>
        {children}
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 px-1 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden pointer-events-auto"
        aria-label="Primary"
      >
        <ul className="grid grid-cols-5">
          {tabs.map((tab) => {
            const active = isTabActive(pathname, tab.href);
            const Icon = tab.icon;
            return (
              <li key={tab.href} className="relative grid place-items-center py-1">
                <Link
                  href={tab.href}
                  className={cn(
                    "grid w-full min-h-12 min-w-[44px] place-items-center gap-0.5 px-0.5 text-center text-[10px] font-bold leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon",
                    active ? "text-maroon" : "text-muted",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <span className={cn("grid h-8 w-8 place-items-center rounded-full", active && "bg-maroon-soft")}>
                    <Icon size={18} strokeWidth={active ? 2 : 1.75} aria-hidden />
                  </span>
                  {tab.label}
                </Link>
                {active ? <span className="nav-active-indicator" aria-hidden /> : null}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function isTabActive(pathname: string, href: string) {
  if (href === "/home") {
    return pathname === "/home" || pathname.startsWith("/home/");
  }
  if (href === "/train") {
    return pathname === "/train" || pathname.startsWith("/train/") || pathname.startsWith("/live") || pathname.startsWith("/log/");
  }
  if (href === "/progress") {
    return (
      pathname === "/progress"
      || pathname.startsWith("/progress/")
      || pathname.startsWith("/analytics")
      || pathname.startsWith("/records")
      || pathname.startsWith("/weekly")
      || pathname === "/recovery"
      || pathname.startsWith("/recovery/")
      || pathname.startsWith("/health")
    );
  }
  if (href === "/plan") {
    return (
      pathname === "/plan"
      || pathname.startsWith("/plan/")
      || pathname.startsWith("/calendar")
      || pathname.startsWith("/conflicts")
      || pathname === "/events"
      || pathname.startsWith("/events/")
      || pathname.startsWith("/triathlon")
    );
  }
  if (href === "/more") {
    return (
      pathname === "/more"
      || pathname.startsWith("/more/")
      || pathname.startsWith("/nutrition")
      || pathname.startsWith("/ai")
      || pathname.startsWith("/profile")
      || pathname.startsWith("/settings")
      || pathname.startsWith("/notifications")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SideLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const pathOnly = href.split("?")[0]?.split("#")[0] ?? href;
  const active = pathname === pathOnly || (pathOnly !== "/home" && pathname.startsWith(`${pathOnly}/`)) || (pathOnly === "/home" && pathname === "/home");
  return (
    <Link
      href={href}
      className={cn(
        "rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-semibold transition-colors",
        active ? "bg-maroon text-white" : "text-muted hover:bg-elevated hover:text-ink",
      )}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}
