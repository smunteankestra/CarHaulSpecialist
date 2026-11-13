/** Cloudflare Turnstile: "are you human?" on the staff login. */

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Returns true when the check passes or when Turnstile is not configured at all. */
export async function verifyTurnstile(secret: string | undefined, token: string, remoteIp?: string): Promise<boolean> {
  if (!secret) return true; // not configured — local dev and pre-setup deploys keep working
  if (!token) return false;
  try {
    const body = new FormData();
    body.append("secret", secret);
    body.append("response", token);
    if (remoteIp) body.append("remoteip", remoteIp);
    const response = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
