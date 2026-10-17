export default function Loading() {
  return (
    <main className="mx-auto grid w-full min-w-0 max-w-5xl gap-4 px-4 py-5 sm:py-6">
      <div className="skeleton h-8 w-40 max-w-full" />
      <div className="skeleton h-12 w-full max-w-xs" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="skeleton h-48" />
        <div className="skeleton h-48" />
      </div>
    </main>
  );
}
