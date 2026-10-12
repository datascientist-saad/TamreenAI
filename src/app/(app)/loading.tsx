export default function Loading() {
  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-2 md:gap-4 md:py-6" aria-hidden="true">
      <div className="skeleton h-6 w-40" />
      <div className="skeleton mx-auto h-44 w-44 rounded-full md:hidden" />
      <div className="skeleton h-16 md:hidden" />
      <div className="skeleton h-24 md:hidden" />
      <div className="hidden gap-4 md:grid md:grid-cols-2">
        <div className="skeleton h-48" />
        <div className="skeleton h-48" />
      </div>
    </main>
  );
}
