// PIN hashing utility for client-side use
// Must match the server-side hash_pin function

const SALT = 'nivra_pin_salt_2026';

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export const DEFAULT_PIN = '3112';
