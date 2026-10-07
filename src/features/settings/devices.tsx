"use client";

import { useState } from "react";
import { providerById } from "@/services/wearables/providers";

export function DeviceList({ providers }: { providers: Array<{ id: string; name: string }> }) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <ul className="grid gap-2">
      {providers.map((provider) => (
        <li key={provider.id} className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2">
          <span>{provider.name}</span>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={async () => {
              const adapter = providerById(provider.id);
              const result = await adapter?.connect();
              setNote(result && "reason" in result ? result.reason : "This provider is not connected.");
            }}
          >
            Not connected
          </button>
        </li>
      ))}
      {note ? <li className="text-sm text-muted">{note}</li> : null}
    </ul>
  );
}
