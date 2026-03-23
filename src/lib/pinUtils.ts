// PIN hashing utility for client-side use
// Must match the server-side hash_pin function

const SALT = 'nivra_pin_salt_2026';

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Customer PIN: 4 digits */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/** Staff/Employee PIN: 6 digits */
export function isValidStaffPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export function isValidAdminPin(pin: string): boolean {
  return /^\d{8}$/.test(pin);
}

/**
 * Generate a unique temporary 4-digit PIN for customer reset.
 * Each reset produces a different PIN — no shared static default.
 */
export function generateTemporaryPin(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 10000).padStart(4, '0');
}

/**
 * @deprecated — Do not use a shared default PIN for all accounts.
 * Use generateTemporaryPin() instead.
 */
export const DEFAULT_PIN = '3112';
