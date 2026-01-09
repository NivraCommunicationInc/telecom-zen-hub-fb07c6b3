/**
 * Normalization utilities for sensitive input fields
 * SECURITY: These functions prepare data for validation only - never log normalized values
 */

/**
 * Remove all spaces, hyphens, and whitespace from a string
 */
export const removeSpacesAndHyphens = (value: string): string => {
  return value.replace(/[\s\-]/g, '');
};

/**
 * Extract only digits from a string
 */
export const digitsOnly = (value: string): string => {
  return value.replace(/\D/g, '');
};

/**
 * Uppercase and remove spaces/hyphens (for ID numbers)
 */
export const normalizeIdNumber = (value: string): string => {
  return removeSpacesAndHyphens(value).toUpperCase();
};

/**
 * Normalize card number: extract digits only
 */
export const normalizeCardNumber = (value: string): string => {
  return digitsOnly(value);
};

/**
 * Format card number for display with spaces (groups of 4)
 */
export const formatCardNumberDisplay = (value: string): string => {
  const digits = digitsOnly(value);
  const groups = digits.match(/.{1,4}/g);
  return groups ? groups.join(' ') : digits;
};

/**
 * Format expiry date as MM/YY
 */
export const formatExpiryDisplay = (value: string): string => {
  const digits = digitsOnly(value);
  if (digits.length >= 2) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
  }
  return digits;
};

/**
 * Normalize expiry input to { month, year } or null if invalid format
 */
export const parseExpiry = (value: string): { month: number; year: number } | null => {
  // Accept MM/YY, MM/YYYY, MMYY, MMYYYY
  const cleaned = value.replace(/[^\d]/g, '');
  
  if (cleaned.length === 4) {
    // MMYY format
    const month = parseInt(cleaned.slice(0, 2), 10);
    const year = 2000 + parseInt(cleaned.slice(2, 4), 10);
    return { month, year };
  } else if (cleaned.length === 6) {
    // MMYYYY format
    const month = parseInt(cleaned.slice(0, 2), 10);
    const year = parseInt(cleaned.slice(2, 6), 10);
    return { month, year };
  }
  
  return null;
};

/**
 * Trim and normalize general text input
 */
export const normalizeText = (value: string): string => {
  return value.trim();
};
