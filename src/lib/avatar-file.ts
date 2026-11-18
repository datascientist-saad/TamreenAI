const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Resolve a usable image MIME type, including iOS photos that omit `file.type`. */
export function avatarContentType(file: { name: string; type: string }): string | null {
  if (ALLOWED.has(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

export function avatarExtension(contentType: string): "jpg" | "png" | "webp" {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message && !error.message.includes("Minified React error")) {
    return error.message;
  }
  return fallback;
}
