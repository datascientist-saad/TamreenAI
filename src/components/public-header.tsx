import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export function PublicHeader({ current }: { current?: "demo" }) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/20 bg-[#3d0e1f] text-white">
      <a className="skip-link" href="#content">Skip to content</a>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="rounded-xl text-white" aria-label="Tamreen AI home">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="flex flex-wrap items-center gap-2">
          <ThemeToggle persist={false} onDark />
          <Link className="btn btn-on-dark" href="/login">Sign in</Link>
          <Link className="btn btn-gold" href="/demo" aria-current={current === "demo" ? "page" : undefined}>Explore demo</Link>
          <Link className="btn btn-primary" href="/signup">Start training</Link>
        </nav>
      </div>
    </header>
  );
}
