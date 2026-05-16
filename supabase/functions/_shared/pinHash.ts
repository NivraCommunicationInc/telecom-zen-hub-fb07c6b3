// Shared PIN/OTP hashing: PBKDF2-SHA256 with per-record random salt.
// 100k iterations, 256-bit output, hex-encoded.

const PBKDF2_ITERATIONS = 100_000;

export function generateSalt(): string {
  // 16 random bytes -> 32 hex chars
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPbkdf2(secret: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(derived))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// CSPRNG numeric PIN. minDigits inclusive, e.g. (4) -> "1000".."9999"
export function generateNumericPin(digits: number): string {
  const min = 10 ** (digits - 1);
  const range = 9 * min;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(min + (buf[0] % range));
}

// Constant-time hex comparison
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
