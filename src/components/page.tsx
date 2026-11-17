export function PageFrame({
  eyebrow,
  title,
  lede,
  children,
  actions,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <main className={cnPage(compact)}>
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="page-title mt-1">{title}</h1>
          {lede ? <p className="mt-1.5 max-w-2xl text-sm text-muted">{lede}</p> : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}

function cnPage(compact: boolean) {
  return compact
    ? "mx-auto grid w-full min-w-0 max-w-5xl gap-4 px-4 py-4 *:min-w-0 sm:py-5"
    : "mx-auto grid w-full min-w-0 max-w-5xl gap-4 px-4 py-5 *:min-w-0 sm:py-6";
}
