import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-screen max-w-lg place-items-center px-6 text-center">
      <div>
        <p className="eyebrow">404</p>
        <h1 className="mt-3 text-4xl font-extrabold">That page is not in the training plan.</h1>
        <Link className="btn btn-primary mt-6" href="/home">Back home</Link>
      </div>
    </main>
  );
}
