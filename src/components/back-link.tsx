"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { backLabel, resolveBackHref, type DetailKind } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function BackLink({
  from,
  kind,
  label,
  className,
  preferHistory = false,
}: {
  from?: string | null;
  kind: DetailKind;
  label?: string;
  className?: string;
  /** Prefer history.back when the sanitized from matches document.referrer path. */
  preferHistory?: boolean;
}) {
  const router = useRouter();
  const href = resolveBackHref(from, kind);
  const text = label ?? `Back to ${backLabel(href, kind)}`;

  if (preferHistory) {
    return (
      <button
        type="button"
        className={cn("btn btn-ghost btn-sm", className)}
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
            return;
          }
          router.push(href);
        }}
      >
        <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
        {text}
      </button>
    );
  }

  return (
    <Link href={href} className={cn("btn btn-ghost btn-sm", className)}>
      <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
      {text}
    </Link>
  );
}
