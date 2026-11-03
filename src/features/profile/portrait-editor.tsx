"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { initials } from "@/lib/portrait";
import { clearAvatar, uploadAvatar } from "@/server/actions";

export function PortraitEditor({
  name,
  src,
  source,
  googleAvailable,
}: {
  name: string;
  src: string | null;
  source: "upload" | "google" | "none";
  googleAvailable: boolean;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const shown = preview || src;
  const usingGoogle = source === "google" && !preview;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    const local = URL.createObjectURL(file);
    setPreview(local);
    setPending(true);
    const body = new FormData();
    body.set("file", file);
    try {
      await uploadAvatar(body);
      router.refresh();
    } catch (caught) {
      setPreview(null);
      setError(caught instanceof Error ? caught.message : "The photo was not saved.");
    } finally {
      setPending(false);
    }
  }

  async function restoreGooglePhoto() {
    setError("");
    setPending(true);
    setPreview(null);
    try {
      await clearAvatar();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Google photo was not restored.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid justify-items-center gap-3 text-center md:justify-items-start md:text-left">
      <div className="relative">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" src={shown} referrerPolicy="no-referrer" className="h-28 w-28 rounded-full object-cover ring-4 ring-white/30" />
        ) : (
          <span className="grid h-28 w-28 place-items-center rounded-full bg-white/15 text-3xl font-extrabold ring-4 ring-white/30">{initials(name)}</span>
        )}
        {pending ? <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-xs font-bold">Saving</span> : null}
      </div>
      <p className="max-w-xs text-sm text-white/80">
        {usingGoogle ? "This photo is from your Google account." : source === "upload" || preview ? "This is the photo you uploaded." : "Add a photo so your profile is easier to recognize."}
      </p>
      <div className="flex flex-wrap justify-center gap-2 md:justify-start">
        <label className="btn btn-gold cursor-pointer">
          {source === "upload" || preview ? "Change photo" : "Upload photo"}
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={pending}
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
        </label>
        {source === "upload" && googleAvailable ? (
          <button className="btn btn-on-dark" type="button" disabled={pending} onClick={() => void restoreGooglePhoto()}>
            Use Google photo
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-gold">{error}</p> : null}
    </div>
  );
}
