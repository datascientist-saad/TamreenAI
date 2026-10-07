export default function Loading() {
  return (
    <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6">
      <div className="skeleton h-8 w-40" />
      <div className="skeleton h-12 w-72" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="skeleton h-48" />
        <div className="skeleton h-48" />
      </div>
    </main>
  );
}
