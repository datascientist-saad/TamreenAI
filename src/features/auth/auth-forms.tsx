"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Wordmark } from "@/components/brand";

export function LoginForm({ next }: { next?: string }) {
  return <AuthCard mode="login" nextPath={next} />;
}

export function SignupForm() {
  return <AuthCard mode="signup" />;
}

export function ForgotForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <Shell title="Reset your password" subtitle="We will email a link if this address has an account.">
      <form className="grid gap-3" onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const email = String(new FormData(event.currentTarget).get("email") ?? "");
        const supabase = createClient();
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (authError) setError(authError.message);
        else setMessage("Check your email for the reset link.");
      }}>
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        {error ? <p className="text-sm text-live">{error}</p> : null}
        {message ? <p className="text-sm">{message}</p> : null}
        <button className="btn btn-primary" type="submit">Send reset link</button>
      </form>
    </Shell>
  );
}

export function ResetForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <Shell title="Choose a new password" subtitle="Use at least 8 characters.">
      <form className="grid gap-3" onSubmit={async (event) => {
        event.preventDefault();
        const password = String(new FormData(event.currentTarget).get("password") ?? "");
        const supabase = createClient();
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) setError(authError.message);
        else router.push("/home");
      }}>
        <label>New password<input name="password" type="password" minLength={8} required /></label>
        {error ? <p className="text-sm text-live">{error}</p> : null}
        <button className="btn btn-primary" type="submit">Update password</button>
      </form>
    </Shell>
  );
}

function AuthCard({ mode, nextPath }: { mode: "login" | "signup"; nextPath?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const title = mode === "login" ? "Sign in" : "Create your athlete account";
  return (
    <Shell title={title} subtitle="Email and password, or Google if it is enabled for this project.">
      <form className="grid gap-3" onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const form = new FormData(event.currentTarget);
        const email = String(form.get("email") ?? "");
        const password = String(form.get("password") ?? "");
        const name = String(form.get("name") ?? "");
        const supabase = createClient();
        if (mode === "signup") {
          const { error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
              data: { full_name: name },
            },
          });
          if (authError) setError(authError.message);
          else setNotice("Check your email to verify the account, then sign in.");
          return;
        }
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) setError(authError.message);
        else router.push(nextPath || "/home");
      }}>
        {mode === "signup" ? <label>Name<input name="name" required /></label> : null}
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Password<input name="password" type="password" minLength={8} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {error ? <p className="text-sm text-live">{error}</p> : null}
        {notice ? <p className="text-sm">{notice}</p> : null}
        <button className="btn btn-primary" type="submit">{mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <button className="btn btn-ghost mt-3 w-full" type="button" onClick={async () => {
        setError("");
        const supabase = createClient();
        const { error: authError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        if (authError) setError(authError.message);
      }}>Continue with Google</button>
      <p className="mt-4 text-sm text-muted">
        {mode === "login" ? <Link href="/forgot-password">Forgot password</Link> : null}
        {" "}
        {mode === "login" ? <Link href="/signup">Create an account</Link> : <Link href="/login">Already training? Sign in</Link>}
      </p>
    </Shell>
  );
}

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4 py-10">
      <section className="app-card w-full p-6">
        <Link href="/"><Wordmark /></Link>
        <h1 className="mt-6 text-3xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}
