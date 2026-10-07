export function PageFrame({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6">
      <header>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
        {lede ? <p className="mt-2 max-w-2xl text-muted">{lede}</p> : null}
      </header>
      {children}
    </main>
  );
}
