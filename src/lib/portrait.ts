const HTTPS = /^https:\/\//i;

function httpsUrl(value: unknown): string | null {
  return typeof value === "string" && HTTPS.test(value) ? value : null;
}

export function googlePhotoUrl(user: {
  user_metadata?: { avatar_url?: unknown; picture?: unknown } | null;
  app_metadata?: { provider?: unknown; providers?: unknown } | null;
  identities?: Array<{ provider?: string; identity_data?: Record<string, unknown> | null }> | null;
}): string | null {
  const providers = [
    ...(Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : []),
    user.app_metadata?.provider,
    ...(user.identities ?? []).map((identity) => identity.provider),
  ];
  let fromGoogle: string | null = null;
  for (const identity of user.identities ?? []) {
    if (identity.provider !== "google") continue;
    const data = identity.identity_data;
    fromGoogle = httpsUrl(data?.avatar_url) || httpsUrl(data?.picture);
    if (fromGoogle) return fromGoogle;
  }
  if (!providers.includes("google")) return null;
  return httpsUrl(user.user_metadata?.avatar_url) || httpsUrl(user.user_metadata?.picture);
}

export function publicAvatarUrl(path: string | null | undefined, supabaseUrl: string | null, version?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("https://")) return path;
  if (!supabaseUrl || path.includes("..") || path.startsWith("/") || path.includes("?")) return null;
  const base = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/avatars/${path}`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

export function portraitChoice(input: {
  avatarPath: string | null | undefined;
  updatedAt?: string | null;
  supabaseUrl: string | null;
  googleUrl: string | null;
}): { src: string | null; source: "upload" | "google" | "none" } {
  const uploaded = publicAvatarUrl(input.avatarPath, input.supabaseUrl, input.updatedAt);
  if (uploaded) return { src: uploaded, source: "upload" };
  if (input.googleUrl) return { src: input.googleUrl, source: "google" };
  return { src: null, source: "none" };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[1]?.[0] ?? "" : ""}`;
  return (letters || "T").toUpperCase();
}
