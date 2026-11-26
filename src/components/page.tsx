import { cn } from "@/lib/utils";

const widthClass = {
  default: "max-w-5xl md:max-w-6xl",
  narrow: "max-w-3xl",
  wide: "max-w-5xl lg:max-w-7xl",
  flush: "max-w-none",
} as const;

export type PageWidth = keyof typeof widthClass;

/** Shared athlete page container — mobile phone column, desktop gutters + wider rail. */
export function pageContainerClass({
  compact = false,
  width = "default",
  className,
}: {
  compact?: boolean;
  width?: PageWidth;
  className?: string;
} = {}) {
  return cn(
    "mx-auto grid w-full min-w-0 gap-4 px-4 *:min-w-0 md:gap-5 md:px-6 lg:px-8",
    widthClass[width],
    compact ? "py-4 sm:py-5" : "py-5 sm:py-6",
    className,
  );
}

export function PageFrame({
  eyebrow,
  title,
  lede,
  children,
  actions,
  compact = false,
  width = "default",
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  compact?: boolean;
  width?: PageWidth;
}) {
  return (
    <main className={pageContainerClass({ compact, width })}>
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="page-title mt-1">{title}</h1>
          {lede ? <p className="mt-1.5 max-w-2xl text-sm text-muted md:max-w-3xl">{lede}</p> : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}
