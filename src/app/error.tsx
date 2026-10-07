"use client";

export default function ErrorScreen({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto grid min-h-screen max-w-lg place-items-center px-6 text-center">
      <div>
        <p className="eyebrow">Something failed</p>
        <h1 className="mt-3 text-4xl font-extrabold">Tamreen could not finish that request.</h1>
        <p className="mt-3 text-muted">Your training data was not changed by this error. Try again, or return home.</p>
        <button className="btn btn-primary mt-6" onClick={reset} type="button">Try again</button>
      </div>
    </main>
  );
}
