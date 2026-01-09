/**
 * Centralized Validation Module
 * 
 * SECURITY NOTICE:
 * - Never log full card numbers (PAN) or CVV values
 * - CVV should never be sent to backend - only to payment processor
 * - Use stripCvvFromData() before any network request
 * - These validations are for UX - final card validation is done by processor
 */

// Normalization utilities
export {
  removeSpacesAndHyphens,
  digitsOnly,
  normalizeIdNumber,
  normalizeCardNumber,
  formatCardNumberDisplay,
  formatExpiryDisplay,
  parseExpiry,
  normalizeText
} from './normalize';

// Credit card validation
export {
  luhnCheck,
  detectCardBrand,
  getCvvLength,
  validateCardNumber,
  validateExpiry,
  validateCvv,
  validateCard,
  type CardBrand,
  type CardValidationResult
} from './card';

// Date of birth validation
export {
  calculateAge,
  parseDate,
  validateDob,
  formatDateForInput,
  formatDateDisplay,
  type DobValidationResult,
  type DobConfig
} from './dob';

// Security utilities for form submission
export {
  stripCvvFromData,
  stripSensitiveCardData,
  maskCardNumber,
  type SafeCardData
} from './schemas';

// Identity document validation
export {
  PROVINCE_DLN_PATTERNS,
  patternToRegex,
  getProvinceRegex,
  validateDriversLicense,
  getProvinceOptions,
  formatLicenseDisplay,
  REGEX_EXAMPLES,
  type CanadianProvince,
  type ProvinceInfo,
  type IdentityValidationResult
} from './identity';
