import "server-only";
import type { WhoopServerConfig } from "./whoop-sync";

export function whoopServerConfig(): WhoopServerConfig | null {
  const clientId = process.env.WHOOP_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.WHOOP_CLIENT_SECRET?.trim() ?? "";
  const tokenSecret = process.env.WHOOP_TOKEN_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret || tokenSecret.length < 16) return null;
  const redirectUri = process.env.WHOOP_REDIRECT_URI?.trim();
  return {
    clientId,
    clientSecret,
    tokenSecret,
    redirectUri: redirectUri || undefined,
  };
}
