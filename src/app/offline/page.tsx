import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-lg place-items-center px-6 text-center">
      <div>
        <p className="eyebrow">Offline</p>
        <h1 className="mt-3 text-4xl font-extrabold">You are offline.</h1>
        <p className="mt-3 text-muted">Logged sets stay on this device until the connection returns. Open a workout you already loaded, then sync when you are back.</p>
        <Link className="btn btn-primary mt-6" href="/home">Try home</Link>
      </div>
    </main>
  );
}
