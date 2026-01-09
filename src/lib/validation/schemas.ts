/**
 * Zod Schemas for Form Validation
 * 
 * Use these schemas with react-hook-form for consistent validation
 * 
 * SECURITY: These schemas validate format only.
 * - Never log PAN/CVV values
 * - CVV validation is client-side only
 * - Use stripCvvFromData() before any network request
 */

import { z } from 'zod';
import { 
  validateCardNumber, 
  validateExpiry, 
  validateCvv,
  detectCardBrand,
  type CardBrand
} from './card';
import { validateDob } from './dob';
import { validateDriversLicense, type CanadianProvince } from './identity';
import { normalizeCardNumber, normalizeIdNumber } from './normalize';

/**
 * Bilingual error messages
 */
export const errorMessages = {
  cardNumber: {
    required: { en: 'Card number is required', fr: 'Le numéro de carte est requis' },
    invalid: { en: 'Invalid card number', fr: 'Numéro de carte invalide' }
  },
  expiry: {
    required: { en: 'Expiry is required', fr: 'La date d\'expiration est requise' },
    invalid: { en: 'Invalid or expired date', fr: 'Date invalide ou expirée' }
  },
  cvv: {
    required: { en: 'CVV is required', fr: 'Le CVV est requis' },
    invalid: { en: 'CVV must be 3 or 4 digits', fr: 'Le CVV doit contenir 3 ou 4 chiffres' }
  },
  cardholderName: {
    required: { en: 'Cardholder name is required', fr: 'Le nom du titulaire est requis' },
    tooLong: { en: 'Name too long', fr: 'Nom trop long' }
  },
  dob: {
    required: { en: 'Date of birth is required', fr: 'La date de naissance est requise' },
    invalid: { en: 'Invalid date of birth', fr: 'Date de naissance invalide' }
  },
  province: {
    invalid: { en: 'Invalid province', fr: 'Province invalide' }
  },
  license: {
    required: { en: 'License number is required', fr: 'Le numéro de permis est requis' },
    invalid: { en: 'Invalid license number for selected province', fr: 'Numéro de permis invalide pour la province sélectionnée' }
  }
} as const;

/**
 * Get localized error message
 */
export const getErrorMessage = (
  key: keyof typeof errorMessages,
  type: string,
  locale: 'en' | 'fr' = 'fr'
): string => {
  const messages = errorMessages[key] as Record<string, { en: string; fr: string }>;
  return messages[type]?.[locale] ?? messages[type]?.en ?? 'Invalid';
};

/**
 * Create locale-aware Zod refinement message
 */
const msg = (fr: string, en: string) => ({ message: `${fr} | ${en}` });

/**
 * Credit Card Number Schema
 */
export const cardNumberSchema = z.string()
  .min(1, msg('Le numéro de carte est requis', 'Card number is required'))
  .transform(val => normalizeCardNumber(val))
  .refine(val => validateCardNumber(val).isValid, 
    msg('Numéro de carte invalide', 'Invalid card number'));

/**
 * Card Expiry Schema (MM/YY or MM/YYYY)
 */
export const cardExpirySchema = z.string()
  .min(1, msg('La date d\'expiration est requise', 'Expiry is required'))
  .refine(val => validateExpiry(val).isValid, 
    msg('Date invalide ou expirée', 'Invalid or expired date'));

/**
 * CVV Schema (3-4 digits)
 */
export const cvvSchema = z.string()
  .min(1, msg('Le CVV est requis', 'CVV is required'))
  .regex(/^\d{3,4}$/, msg('Le CVV doit contenir 3 ou 4 chiffres', 'CVV must be 3 or 4 digits'));

/**
 * Create context-aware CVV Schema based on card brand
 */
export const createCvvSchema = (cardNumber?: string) => z.string()
  .min(1, msg('Le CVV est requis', 'CVV is required'))
  .refine(val => validateCvv(val, cardNumber).isValid, 
    msg('CVV invalide', 'Invalid CVV'));

/**
 * Date of Birth Schema
 */
export const dobSchema = z.string()
  .min(1, msg('La date de naissance est requise', 'Date of birth is required'))
  .refine(val => validateDob(val).isValid, 
    msg('Date de naissance invalide', 'Invalid date of birth'));

/**
 * DOB with custom age requirements
 */
export const createDobSchema = (minAge: number = 14, maxAge: number = 120) => 
  z.string()
    .min(1, msg('La date de naissance est requise', 'Date of birth is required'))
    .refine(val => validateDob(val, { minAge, maxAge }).isValid, 
      msg(`L'âge doit être entre ${minAge} et ${maxAge} ans`, `Age must be between ${minAge} and ${maxAge} years`));

/**
 * Canadian Province Schema
 */
export const canadianProvinceSchema = z.enum([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'
], { errorMap: () => msg('Province invalide', 'Invalid province') });

/**
 * Driver's License Schema (requires province context)
 */
export const createDriversLicenseSchema = (province: CanadianProvince) =>
  z.string()
    .min(1, msg('Le numéro de permis est requis', 'License number is required'))
    .transform(val => normalizeIdNumber(val))
    .refine(val => validateDriversLicense(val, province).isValid, 
      msg(`Format invalide pour le permis de ${province}`, `Invalid license format for ${province}`));

/**
 * Full Credit Card Form Schema
 * Note: CVV is included for form validation but MUST be stripped before network requests
 * Use stripCvvFromData() before any API call
 */
export const creditCardFormSchema = z.object({
  cardNumber: z.string()
    .min(1, msg('Le numéro de carte est requis', 'Card number is required'))
    .refine(val => validateCardNumber(val).isValid, 
      msg('Numéro de carte invalide', 'Invalid card number')),
  expiry: z.string()
    .min(1, msg('La date d\'expiration est requise', 'Expiry is required'))
    .refine(val => validateExpiry(val).isValid, 
      msg('Date invalide ou expirée', 'Invalid or expired date')),
  cvv: z.string()
    .min(1, msg('Le CVV est requis', 'CVV is required'))
    .regex(/^\d{3,4}$/, msg('Le CVV doit contenir 3 ou 4 chiffres', 'CVV must be 3 or 4 digits')),
  cardholderName: z.string()
    .min(1, msg('Le nom du titulaire est requis', 'Cardholder name is required'))
    .max(100, msg('Nom trop long', 'Name too long'))
});

/**
 * Identity Document Form Schema
 */
export const identityDocumentSchema = z.object({
  province: canadianProvinceSchema,
  licenseNumber: z.string()
    .min(1, msg('Le numéro de permis est requis', 'License number is required')),
  dateOfBirth: z.string()
    .min(1, msg('La date de naissance est requise', 'Date of birth is required'))
    .refine(val => validateDob(val).isValid, 
      msg('Date de naissance invalide', 'Invalid date of birth'))
}).refine(data => {
  const result = validateDriversLicense(data.licenseNumber, data.province);
  return result.isValid;
}, {
  message: 'Numéro de permis invalide pour la province sélectionnée | Invalid license number for selected province',
  path: ['licenseNumber']
});

/**
 * SECURITY: Strip CVV from form data before any network request
 * This ensures CVV never leaves the client (except to payment processor)
 */
export const stripCvvFromData = <T extends Record<string, unknown>>(
  data: T
): Omit<T, 'cvv'> => {
  const { cvv, ...safeData } = data as T & { cvv?: unknown };
  return safeData as Omit<T, 'cvv'>;
};

/**
 * SECURITY: Strip all sensitive card data before logging/storage
 * Removes PAN, expiry raw values, and CVV
 */
export const stripSensitiveCardData = <T extends Record<string, unknown>>(
  data: T
): Omit<T, 'cvv' | 'cardNumber' | 'expiry' | 'card_number'> => {
  const { cvv, cardNumber, expiry, card_number, ...safeData } = data as T & { 
    cvv?: unknown; 
    cardNumber?: unknown; 
    expiry?: unknown;
    card_number?: unknown;
  };
  return safeData as Omit<T, 'cvv' | 'cardNumber' | 'expiry' | 'card_number'>;
};

/**
 * Card metadata safe to store/send to backend
 * This is the ONLY card info that should be sent to your server
 */
export interface CardMetadata {
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
}

/**
 * Extract safe metadata from card data
 * Use this to get the only info that can be stored/sent to backend
 * 
 * IMPORTANT: The actual card number/expiry/cvv should ONLY go to
 * the payment processor (Stripe, etc.) for tokenization
 */
export const extractCardMetadata = (
  cardNumber: string,
  expiry: string
): CardMetadata | null => {
  const normalizedCard = normalizeCardNumber(cardNumber);
  
  if (normalizedCard.length < 4) return null;
  
  // Parse expiry (MM/YY or MM/YYYY)
  const expiryMatch = expiry.replace(/\D/g, '');
  let expMonth: number;
  let expYear: number;
  
  if (expiryMatch.length === 4) {
    expMonth = parseInt(expiryMatch.slice(0, 2), 10);
    expYear = 2000 + parseInt(expiryMatch.slice(2, 4), 10);
  } else if (expiryMatch.length === 6) {
    expMonth = parseInt(expiryMatch.slice(0, 2), 10);
    expYear = parseInt(expiryMatch.slice(2, 6), 10);
  } else {
    return null;
  }
  
  return {
    brand: detectCardBrand(normalizedCard),
    last4: normalizedCard.slice(-4),
    expMonth,
    expYear
  };
};

/**
 * Mask card number for display (show last 4 digits only)
 */
export const maskCardNumber = (cardNumber: string): string => {
  const digits = normalizeCardNumber(cardNumber);
  if (digits.length < 4) return '****';
  return `**** **** **** ${digits.slice(-4)}`;
};

/**
 * SECURITY: Prepare card data for payment processor
 * This is the structure to send to Stripe/payment processor for tokenization
 * NEVER send this to your own backend - only to the processor
 */
export interface PaymentProcessorData {
  number: string;      // Full card number (normalized)
  exp_month: number;
  exp_year: number;
  cvc: string;
  name?: string;
}

/**
 * Convert form data to payment processor format
 * The returned data should ONLY be sent to the payment processor (Stripe, etc.)
 * NEVER to your own backend
 */
export const toPaymentProcessorData = (
  cardNumber: string,
  expiry: string,
  cvv: string,
  cardholderName?: string
): PaymentProcessorData | null => {
  const normalizedCard = normalizeCardNumber(cardNumber);
  const expiryMatch = expiry.replace(/\D/g, '');
  
  let expMonth: number;
  let expYear: number;
  
  if (expiryMatch.length === 4) {
    expMonth = parseInt(expiryMatch.slice(0, 2), 10);
    expYear = 2000 + parseInt(expiryMatch.slice(2, 4), 10);
  } else if (expiryMatch.length === 6) {
    expMonth = parseInt(expiryMatch.slice(0, 2), 10);
    expYear = parseInt(expiryMatch.slice(2, 6), 10);
  } else {
    return null;
  }
  
  return {
    number: normalizedCard,
    exp_month: expMonth,
    exp_year: expYear,
    cvc: cvv.replace(/\D/g, ''),
    ...(cardholderName ? { name: cardholderName } : {})
  };
};

/**
 * Type exports for form data
 */
export type CreditCardFormData = z.infer<typeof creditCardFormSchema>;
export type IdentityDocumentFormData = z.infer<typeof identityDocumentSchema>;

/**
 * Safe card data type (metadata only, for backend storage)
 */
export type SafeCardData = CardMetadata & { cardholderName?: string };
