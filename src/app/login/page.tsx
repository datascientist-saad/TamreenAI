import { LoginForm } from "@/features/auth/auth-forms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <>
      {params.error === "config" ? <p className="bg-live/10 px-4 py-3 text-center text-sm">Supabase environment variables are missing.</p> : null}
      <LoginForm next={params.next} />
    </>
  );
}
