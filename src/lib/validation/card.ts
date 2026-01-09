/**
 * Credit Card Validation Utilities
 * 
 * SECURITY CRITICAL:
 * - NEVER log full card numbers or CVV
 * - These validations are CLIENT-SIDE only for UX
 * - Final validation MUST be done by payment processor (tokenization)
 * - CVV should NEVER be sent to backend - only to payment processor
 */

import { normalizeCardNumber, parseExpiry } from './normalize';

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

/**
 * Luhn algorithm for card number validation
 */
export const luhnCheck = (cardNumber: string): boolean => {
  const digits = normalizeCardNumber(cardNumber);
  
  if (digits.length === 0) return false;
  
  let sum = 0;
  let isEven = false;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
};

/**
 * Detect card brand from number prefix
 */
export const detectCardBrand = (cardNumber: string): CardBrand => {
  const digits = normalizeCardNumber(cardNumber);
  
  if (!digits) return 'unknown';
  
  // Visa: starts with 4
  if (/^4/.test(digits)) return 'visa';
  
  // Mastercard: 51-55 or 2221-2720
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return 'mastercard';
  
  // Amex: 34 or 37
  if (/^3[47]/.test(digits)) return 'amex';
  
  // Discover: 6011, 622126-622925, 644-649, 65
  if (/^6011|^65|^64[4-9]|^622/.test(digits)) return 'discover';
  
  return 'unknown';
};

/**
 * Get expected CVV length for card brand
 */
export const getCvvLength = (brand: CardBrand): number => {
  return brand === 'amex' ? 4 : 3;
};

export interface CardValidationResult {
  isValid: boolean;
  error?: {
    en: string;
    fr: string;
  };
}

/**
 * Validate card number (format + Luhn)
 */
export const validateCardNumber = (value: string): CardValidationResult => {
  const digits = normalizeCardNumber(value);
  
  if (!digits) {
    return {
      isValid: false,
      error: {
        en: 'Card number is required',
        fr: 'Le numéro de carte est requis'
      }
    };
  }
  
  if (digits.length < 13 || digits.length > 19) {
    return {
      isValid: false,
      error: {
        en: 'Card number must be between 13 and 19 digits',
        fr: 'Le numéro de carte doit contenir entre 13 et 19 chiffres'
      }
    };
  }
  
  if (!luhnCheck(digits)) {
    return {
      isValid: false,
      error: {
        en: 'Invalid card number',
        fr: 'Numéro de carte invalide'
      }
    };
  }
  
  return { isValid: true };
};

/**
 * Validate expiry date (not expired, valid month)
 */
export const validateExpiry = (value: string): CardValidationResult => {
  const parsed = parseExpiry(value);
  
  if (!parsed) {
    return {
      isValid: false,
      error: {
        en: 'Enter expiry as MM/YY',
        fr: 'Entrez la date au format MM/AA'
      }
    };
  }
  
  const { month, year } = parsed;
  
  if (month < 1 || month > 12) {
    return {
      isValid: false,
      error: {
        en: 'Month must be between 01 and 12',
        fr: 'Le mois doit être entre 01 et 12'
      }
    };
  }
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // Card is valid through the end of the expiry month
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return {
      isValid: false,
      error: {
        en: 'Card has expired',
        fr: 'La carte est expirée'
      }
    };
  }
  
  // Reasonable future limit (20 years)
  if (year > currentYear + 20) {
    return {
      isValid: false,
      error: {
        en: 'Invalid expiry year',
        fr: 'Année d\'expiration invalide'
      }
    };
  }
  
  return { isValid: true };
};

/**
 * Validate CVV based on card brand
 */
export const validateCvv = (value: string, cardNumber?: string): CardValidationResult => {
  const digits = value.replace(/\D/g, '');
  
  if (!digits) {
    return {
      isValid: false,
      error: {
        en: 'CVV is required',
        fr: 'Le CVV est requis'
      }
    };
  }
  
  const brand = cardNumber ? detectCardBrand(cardNumber) : 'unknown';
  const expectedLength = getCvvLength(brand);
  
  // For unknown brand, accept 3 or 4 digits
  if (brand === 'unknown') {
    if (digits.length < 3 || digits.length > 4) {
      return {
        isValid: false,
        error: {
          en: 'CVV must be 3 or 4 digits',
          fr: 'Le CVV doit contenir 3 ou 4 chiffres'
        }
      };
    }
  } else if (digits.length !== expectedLength) {
    return {
      isValid: false,
      error: {
        en: `CVV must be ${expectedLength} digits for this card`,
        fr: `Le CVV doit contenir ${expectedLength} chiffres pour cette carte`
      }
    };
  }
  
  return { isValid: true };
};

/**
 * Full card validation (all fields)
 * Returns first error found or success
 */
export const validateCard = (
  cardNumber: string,
  expiry: string,
  cvv: string
): CardValidationResult => {
  const numberResult = validateCardNumber(cardNumber);
  if (!numberResult.isValid) return numberResult;
  
  const expiryResult = validateExpiry(expiry);
  if (!expiryResult.isValid) return expiryResult;
  
  const cvvResult = validateCvv(cvv, cardNumber);
  if (!cvvResult.isValid) return cvvResult;
  
  return { isValid: true };
};
