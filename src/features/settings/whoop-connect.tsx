"use client";

import { useState } from "react";
import { providerById } from "@/services/wearables/providers";

export function WhoopConnect() {
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">
        Connect WHOOP when you want recovery and strain in Tamreen. Nothing is imported until you authorize it.
      </p>
      <button
        className="btn btn-ghost w-fit"
        type="button"
        onClick={async () => {
          const adapter = providerById("whoop");
          const result = await adapter?.connect();
          setNote(result && "reason" in result ? result.reason : "WHOOP is not connected.");
        }}
      >
        Connect WHOOP
      </button>
      {note ? <p className="text-sm text-muted">{note}</p> : null}
    </div>
  );
}
