import Link from "next/link";

export default function VerifyPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-lg place-items-center px-6 text-center">
      <div>
        <p className="eyebrow">Email verification</p>
        <h1 className="mt-3 text-4xl font-extrabold">Confirm your email, then come back.</h1>
        <p className="mt-3 text-muted">The link in your inbox signs you in through the secure callback. Tamreen does not mark an address verified until Supabase does.</p>
        <Link className="btn btn-primary mt-6" href="/login">Sign in</Link>
      </div>
    </main>
  );
}
