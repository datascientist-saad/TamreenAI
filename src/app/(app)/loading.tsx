export default function Loading() {
  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-5 py-2 lg:gap-4 lg:px-4 lg:py-6" aria-hidden="true">
      <div className="skeleton h-6 w-40" />
      <div className="skeleton mx-auto h-44 w-44 rounded-full lg:hidden" />
      <div className="skeleton h-16 lg:hidden" />
      <div className="skeleton h-24 lg:hidden" />
      <div className="hidden gap-4 lg:grid lg:grid-cols-2">
        <div className="skeleton h-48" />
        <div className="skeleton h-48" />
      </div>
    </main>
  );
}
