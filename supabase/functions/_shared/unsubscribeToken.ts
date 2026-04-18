// Shared HMAC-signed unsubscribe token utility
// Format: base64url(email)·base64url(hmacSha256(email, secret))

const SECRET = Deno.env.get("UNSUBSCRIBE_TOKEN_SECRET")
  || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  || "nivra-fallback-secret";

function b64urlEncode(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const norm = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacHex(message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

export async function generateUnsubscribeToken(email: string): Promise<string> {
  const norm = email.trim().toLowerCase();
  const sig = await hmacHex(norm);
  const emailB64 = b64urlEncode(new TextEncoder().encode(norm));
  const sigB64 = b64urlEncode(sig);
  return `${emailB64}.${sigB64}`;
}

export async function verifyUnsubscribeToken(token: string): Promise<string | null> {
  try {
    const [emailB64, sigB64] = token.split(".");
    if (!emailB64 || !sigB64) return null;
    const email = new TextDecoder().decode(b64urlDecode(emailB64));
    const expected = await hmacHex(email);
    const provided = b64urlDecode(sigB64);
    if (expected.length !== provided.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ provided[i];
    if (diff !== 0) return null;
    return email;
  } catch {
    return null;
  }
}
