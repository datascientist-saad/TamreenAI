"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateDisplayName } from "@/server/actions";

export function NameField({ name }: { name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [saved, setSaved] = useState(name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const next = value.trim();
    if (!next || next === saved) return;
    setError("");
    setPending(true);
    const previous = saved;
    setSaved(next);
    try {
      await updateDisplayName(next);
      router.refresh();
    } catch (caught) {
      setSaved(previous);
      setValue(previous);
      setError(caught instanceof Error ? caught.message : "The name was not saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <label className="text-sm text-white/80">
        Name
        <input
          className="field-on-dark"
          value={value}
          maxLength={80}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => void save()}
        />
      </label>
      <div className="flex items-center gap-3">
        <button className="btn btn-gold" type="button" disabled={pending || value.trim() === saved} onClick={() => void save()}>
          {pending ? "Saving…" : "Save name"}
        </button>
        {error ? <p className="text-sm text-gold">{error}</p> : null}
      </div>
    </div>
  );
}
