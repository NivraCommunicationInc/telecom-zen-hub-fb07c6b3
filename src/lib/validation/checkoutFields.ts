/**
 * Canonical checkout field validators & formatters.
 *
 * Single source of truth for phone, postal code, and DOB validation
 * used across all checkout flows (Guest, Phone, Quote, ClientSignup,
 * ClientProfile, PublicQuote, etc.).
 *
 * Behavior:
 * - validateCanadianPhone: 10 digits, must not start with 0 or 1
 * - formatCanadianPhone:   formats progressively as (XXX) XXX-XXXX
 * - validateCanadianPostalCode: matches A1A 1A1 (whitespace-insensitive)
 * - formatPostalCode:      uppercases and inserts space after 3 chars
 *
 * For DOB, see src/lib/validation/dob.ts (re-exported below).
 */

// ── Canadian phone ──────────────────────────────────────────────────

/** Format phone progressively as the user types: (XXX) XXX-XXXX */
export const formatCanadianPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

/** Strict Canadian phone validation: exactly 10 digits, NPA cannot start with 0 or 1. */
export const validateCanadianPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return false;
  if (digits[0] === "0" || digits[0] === "1") return false;
  return true;
};

// ── Canadian postal code ────────────────────────────────────────────

/** Validate Canadian postal code (A1A 1A1, whitespace-insensitive). */
export const validateCanadianPostalCode = (postalCode: string): boolean => {
  const cleaned = postalCode.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned);
};

/** Format postal code as A1A 1A1, capping at 6 alphanumerics. */
export const formatPostalCode = (value: string): string => {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
};

// ── DOB re-exports for one-stop import ──────────────────────────────

export { validateDob, MIN_AGE_TELECOM, isUnderMinAge, getMaxDobDate } from "./dob";
