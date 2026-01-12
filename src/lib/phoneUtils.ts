/**
 * Phone number utilities - E.164 formatting and validation
 * E.164 format: +[country code][number] (max 15 digits total)
 * Example: +15145551234
 */

/**
 * Extract digits only from a phone string
 */
export const extractDigits = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

/**
 * Convert a Canadian phone number to E.164 format
 * Accepts: (514) 555-1234, 514-555-1234, 5145551234, +15145551234, etc.
 * Returns: +15145551234 or null if invalid
 */
export const toE164 = (phone: string): string | null => {
  const digits = extractDigits(phone);
  
  // Already has country code (11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // 10-digit Canadian/US number
  if (digits.length === 10) {
    // Validate area code (cannot start with 0 or 1)
    if (digits[0] === '0' || digits[0] === '1') {
      return null;
    }
    return `+1${digits}`;
  }
  
  // Already E.164 with plus
  if (phone.startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  
  return null;
};

/**
 * Validate if a phone number can be converted to E.164
 */
export const isValidPhone = (phone: string): boolean => {
  return toE164(phone) !== null;
};

/**
 * Format E.164 to display format: (514) 555-1234
 */
export const formatPhoneDisplay = (e164: string): string => {
  const digits = extractDigits(e164);
  
  // Remove country code if present
  const local = digits.startsWith('1') && digits.length === 11 
    ? digits.slice(1) 
    : digits;
  
  if (local.length !== 10) {
    return e164; // Return original if not valid
  }
  
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
};

/**
 * Generate OpenPhone call URL
 * Opens OpenPhone app/web to initiate a call
 */
export const getOpenPhoneCallUrl = (phoneE164: string): string => {
  // OpenPhone uses standard tel: protocol or their app protocol
  // For web, we use the tel: protocol which OpenPhone can intercept
  return `tel:${phoneE164}`;
};

/**
 * Generate OpenPhone SMS URL  
 * Opens OpenPhone app/web to send SMS
 */
export const getOpenPhoneSmsUrl = (phoneE164: string): string => {
  // sms: protocol works with OpenPhone
  return `sms:${phoneE164}`;
};

/**
 * OpenPhone deep link URLs (if you have OpenPhone desktop app)
 * These are optional and fallback to standard protocols
 */
export const getOpenPhoneDeepLink = (phoneE164: string, action: 'call' | 'sms'): string => {
  // OpenPhone web interface URL format
  // Fallback to standard protocols
  if (action === 'call') {
    return `https://app.openphone.com/dialer?number=${encodeURIComponent(phoneE164)}`;
  }
  return `https://app.openphone.com/messages?number=${encodeURIComponent(phoneE164)}`;
};

/**
 * Normalize phone for storage (always E.164)
 */
export const normalizePhoneForStorage = (phone: string): string | null => {
  return toE164(phone);
};
