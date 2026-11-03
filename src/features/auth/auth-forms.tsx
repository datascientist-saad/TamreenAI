"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

const accountLinkClass = "w-fit font-semibold text-maroon underline decoration-maroon/40 underline-offset-4 dark:text-gold dark:decoration-gold/40";

export function LoginForm({ next }: { next?: string }) {
  return <AuthCard mode="login" nextPath={next} />;
}

export function SignupForm() {
  return <AuthCard mode="signup" />;
}

export function ForgotForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <Shell title="Reset your password" subtitle="We will email a link if this address has an account.">
      <form className="grid gap-3" onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        setPending(true);
        try {
          const email = String(new FormData(event.currentTarget).get("email") ?? "");
          const supabase = createClient();
          const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          });
          if (authError) setError(authError.message);
          else setMessage("Check your email for the reset link.");
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "The reset link was not sent.");
        } finally {
          setPending(false);
        }
      }}>
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        {error ? <p className="text-sm text-live" role="alert">{error}</p> : null}
        {message ? <p className="text-sm">{message}</p> : null}
        <PrimaryButton pending={pending} idle="Send reset link" busy="Sending…" />
      </form>
    </Shell>
  );
}

export function ResetForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <Shell title="Choose a new password" subtitle="Use at least 8 characters.">
      <form className="grid gap-3" onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const form = new FormData(event.currentTarget);
        const password = String(form.get("password") ?? "");
        const confirm = String(form.get("confirm") ?? "");
        if (password !== confirm) {
          setError("Passwords do not match.");
          return;
        }
        setPending(true);
        try {
          const supabase = createClient();
          const { error: authError } = await supabase.auth.updateUser({ password });
          if (authError) {
            setError(authError.message);
            setPending(false);
            return;
          }
          router.push("/home");
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "The password was not updated.");
          setPending(false);
        }
      }}>
        <PasswordField label="New password" name="password" autoComplete="new-password" />
        <PasswordField label="Confirm password" name="confirm" autoComplete="new-password" />
        {error ? <p className="text-sm text-live" role="alert">{error}</p> : null}
        <PrimaryButton pending={pending} idle="Update password" busy="Updating…" />
      </form>
    </Shell>
  );
}

function AuthCard({ mode, nextPath }: { mode: "login" | "signup"; nextPath?: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [notice, setNotice] = useState("");
  const [formPending, setFormPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const title = mode === "login" ? "Sign in" : "Create your athlete account";
  const subtitle = mode === "login"
    ? "Use your email and password, or continue with Google."
    : "Use your name, email, and password, or continue with Google.";
  const busy = formPending || googlePending;
  return (
    <Shell title={title} subtitle={subtitle}>
      <form className="grid gap-3" onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setFormError("");
        setGoogleError("");
        setNotice("");
        const form = new FormData(event.currentTarget);
        const email = String(form.get("email") ?? "");
        const password = String(form.get("password") ?? "");
        const confirm = String(form.get("confirm") ?? "");
        const name = String(form.get("name") ?? "");
        if (mode === "signup" && password !== confirm) {
          setFormError("Passwords do not match.");
          return;
        }
        setFormPending(true);
        try {
          const supabase = createClient();
          if (mode === "signup") {
            const { data: signedUp, error: authError } = await supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
                data: { full_name: name },
              },
            });
            if (authError) {
              setFormError(authError.message);
              setFormPending(false);
              return;
            }
            if (signedUp.session) {
              router.push("/onboarding");
              return;
            }
            setNotice("Check your email to verify the account, then sign in.");
            setFormPending(false);
            return;
          }
          const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
          if (authError) {
            setFormError(authError.message);
            setFormPending(false);
            return;
          }
          router.push(nextPath || "/home");
        } catch (caught) {
          setFormError(caught instanceof Error ? caught.message : mode === "login" ? "Sign-in did not start." : "The account was not created.");
          setFormPending(false);
        }
      }}>
        {mode === "signup" ? <label>Full name<input name="name" autoComplete="name" required /></label> : null}
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <PasswordField
          label="Password"
          name="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          hint="At least 8 characters."
        />
        {mode === "signup" ? <PasswordField label="Confirm password" name="confirm" autoComplete="new-password" /> : null}
        {formError ? <p className="text-sm text-live" role="alert">{formError}</p> : null}
        {notice ? <p className="text-sm">{notice}</p> : null}
        <PrimaryButton
          pending={formPending}
          disabled={googlePending}
          idle={mode === "login" ? "Sign in" : "Create account"}
          busy={mode === "login" ? "Signing in…" : "Creating account…"}
        />
      </form>
      <div className="relative my-4 text-center text-xs font-bold uppercase tracking-[0.14em] text-muted">
        <span className="relative z-10 bg-card px-3">or</span>
        <span className="absolute inset-x-0 top-1/2 border-t border-line" aria-hidden="true" />
      </div>
      <button
        className="btn btn-ghost w-full transition active:scale-[0.98] active:bg-line disabled:active:scale-100"
        type="button"
        disabled={busy}
        aria-busy={googlePending}
        onClick={async () => {
          if (busy) return;
          setFormError("");
          setGoogleError("");
          setGooglePending(true);
          // Paint the spinner before the browser leaves for Google.
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          });
          try {
            const supabase = createClient();
            const { data, error: authError } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: `${window.location.origin}/auth/callback` },
            });
            if (authError) {
              setGoogleError(authError.message);
              setGooglePending(false);
              return;
            }
            if (!data.url) setGooglePending(false);
          } catch (caught) {
            setGoogleError(caught instanceof Error ? caught.message : "Google sign-in did not start.");
            setGooglePending(false);
          }
        }}
      >
        {googlePending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
        {googlePending ? "Continuing…" : "Continue with Google"}
      </button>
      {googleError ? <p className="mt-3 text-sm text-live" role="alert">{googleError}</p> : null}
      <div className="mt-4 grid gap-3 text-sm">
        {mode === "login" ? <Link className={accountLinkClass} href="/forgot-password">Forgot password?</Link> : null}
        <Link className={accountLinkClass} href={mode === "login" ? "/signup" : "/login"}>
          {mode === "login" ? "Create an account" : "Already training? Sign in"}
        </Link>
      </div>
    </Shell>
  );
}

function PasswordField({ label, name, autoComplete, hint }: { label: string; name: string; autoComplete: string; hint?: string }) {
  const [visible, setVisible] = useState(false);
  const id = `auth-${name}`;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id}>{label}</label>
        <button
          className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-bold text-maroon dark:text-gold"
          type="button"
          aria-controls={id}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      <input id={id} name={name} type={visible ? "text" : "password"} minLength={8} required autoComplete={autoComplete} />
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function PrimaryButton({ pending, disabled, idle, busy }: { pending: boolean; disabled?: boolean; idle: string; busy: string }) {
  return (
    <button className="btn btn-primary" type="submit" disabled={pending || disabled} aria-busy={pending}>
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? busy : idle}
    </button>
  );
}

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4 py-10">
      <section className="app-card w-full p-6">
        <div className="flex items-start justify-between gap-3">
          <Link href="/"><Wordmark /></Link>
          <ThemeToggle persist={false} />
        </div>
        <h1 className="mt-6 text-3xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}
