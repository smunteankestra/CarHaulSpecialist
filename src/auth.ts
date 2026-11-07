const encoder = new TextEncoder();

export const SESSION_COOKIE = "chs_admin";
const SESSION_SECONDS = 60 * 60 * 12;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

function encodeSubject(email: string): string {
  return toBase64Url(encoder.encode(email));
}

function decodeSubject(value: string): string {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

export async function signSession(secret: string, email: string): Promise<string> {
  const expires = Date.now() + SESSION_SECONDS * 1000;
  const payload = `${encodeSubject(email)}.${expires}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySession(secret: string, token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [email, expires, signature] = parts as [string, string, string];
  if (!timingSafeEqual(await hmac(secret, `${email}.${expires}`), signature)) return null;
  const expiry = Number(expires);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return null;
  try {
    return decodeSubject(email);
  } catch {
    return null;
  }
}

export const sessionMaxAge = SESSION_SECONDS;
