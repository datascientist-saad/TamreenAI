"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export function GoogleLinkButton({ alreadyLinked }: { alreadyLinked: boolean }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (alreadyLinked) {
    return <p className="text-sm text-muted">Signed in with Google.</p>;
  }
  return (
    <div className="grid gap-2">
      <button
        className="btn btn-ghost w-fit transition active:scale-[0.98] active:bg-line disabled:active:scale-100"
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={async () => {
          if (pending) return;
          setError("");
          setPending(true);
          // Paint the spinner before the browser leaves for Google.
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          });
          try {
            const supabase = createClient();
            const { data, error: authError } = await supabase.auth.linkIdentity({
              provider: "google",
              options: {
                redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/more")}`,
              },
            });
            if (authError) {
              setError(authError.message);
              setPending(false);
              return;
            }
            if (!data?.url) setPending(false);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Google did not connect.");
            setPending(false);
          }
        }}
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? "Connecting…" : "Connect Google"}
      </button>
      {error ? <p className="text-sm text-live" role="alert">{error}</p> : null}
    </div>
  );
}
