"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actionErrorMessage, avatarContentType, avatarExtension } from "@/lib/avatar-file";
import { initials } from "@/lib/portrait";
import { createClient } from "@/lib/supabase/browser";
import { clearAvatar, saveAvatarPath } from "@/server/actions";

export function PortraitEditor({
  userId,
  name,
  src,
  source,
  googleAvailable,
}: {
  userId: string;
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
    const type = avatarContentType(file);
    if (!type) {
      setError("Use a JPEG, PNG, or WebP photo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Photos stay under 5 MB.");
      return;
    }

    const local = URL.createObjectURL(file);
    setPreview(local);
    setPending(true);
    try {
      const ext = avatarExtension(type);
      const path = `${userId}/avatar.${ext}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: type,
      });
      if (uploadError) throw new Error(uploadError.message);

      const others = (["jpg", "png", "webp"] as const).filter((item) => item !== ext).map((item) => `${userId}/avatar.${item}`);
      if (others.length) await supabase.storage.from("avatars").remove(others);

      const { error: profileError } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
      if (profileError) throw new Error(profileError.message);

      try {
        await saveAvatarPath(path);
      } catch (caught) {
        // Storage + profile already saved. Ignore opaque production RSC digests from revalidate.
        if (!(caught instanceof Error) || !caught.message.includes("Minified React error")) throw caught;
      }
      router.refresh();
    } catch (caught) {
      setPreview(null);
      setError(actionErrorMessage(caught, "The photo was not saved. Try again."));
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
      setError(actionErrorMessage(caught, "The Google photo was not restored."));
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
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            disabled={pending}
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              event.target.value = "";
              void onFile(chosen);
            }}
          />
        </label>
        {source === "upload" && googleAvailable ? (
          <button className="btn btn-on-dark" type="button" disabled={pending} onClick={() => void restoreGooglePhoto()}>
            Use Google photo
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-gold" role="alert">{error}</p> : null}
    </div>
  );
}
