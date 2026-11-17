"use client";

import { useId, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function AboutDisclosure({
  title = "About this plan",
  summary,
  children,
}: {
  title?: string;
  summary?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section className="app-card overflow-hidden">
      <button
        type="button"
        className="flex w-full min-h-12 items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Info size={18} strokeWidth={1.75} className="shrink-0 text-maroon" aria-hidden />
          <span className="min-w-0">
            <span className="block font-bold">{title}</span>
            {summary && !open ? <span className="mt-0.5 block truncate text-sm text-muted">{summary}</span> : null}
          </span>
        </span>
        <ChevronDown size={18} strokeWidth={1.75} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div id={panelId} className="border-t border-line px-4 py-3 text-sm leading-6 text-muted">
          {children}
        </div>
      ) : null}
    </section>
  );
}
