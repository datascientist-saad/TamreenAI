"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export function GoogleLinkButton({ alreadyLinked }: { alreadyLinked: boolean }) {
  const [error, setError] = useState("");
  if (alreadyLinked) {
    return <p className="text-sm text-muted">Signed in with Google.</p>;
  }
  return (
    <div className="grid gap-2">
      <button
        className="btn btn-ghost w-fit"
        type="button"
        onClick={async () => {
          setError("");
          const supabase = createClient();
          const { error: authError } = await supabase.auth.linkIdentity({
            provider: "google",
            options: {
              redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/more")}`,
            },
          });
          if (authError) setError(authError.message);
        }}
      >
        Connect Google
      </button>
      {error ? <p className="text-sm text-live">{error}</p> : null}
    </div>
  );
}
