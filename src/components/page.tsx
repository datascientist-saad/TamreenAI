export function PageFrame({
  eyebrow,
  title,
  lede,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6">
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="text-balance text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
          {lede ? <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{lede}</p> : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}
