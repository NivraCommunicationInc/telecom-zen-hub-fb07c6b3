/**
 * Zod Schemas for Form Validation
 * 
 * Use these schemas with react-hook-form for consistent validation
 * 
 * SECURITY: These schemas validate format only.
 * - Never log PAN/CVV values
 * - CVV validation is client-side only
 */

import { z } from 'zod';
import { 
  validateCardNumber, 
  validateExpiry, 
  validateCvv,
  detectCardBrand 
} from './card';
import { validateDob } from './dob';
import { validateDriversLicense, type CanadianProvince } from './identity';
import { normalizeCardNumber, normalizeIdNumber } from './normalize';

/**
 * Credit Card Number Schema
 */
export const cardNumberSchema = z.string()
  .transform(val => normalizeCardNumber(val))
  .refine(val => {
    const result = validateCardNumber(val);
    return result.isValid;
  }, {
    message: 'Invalid card number'
  });

/**
 * Card Expiry Schema (MM/YY or MM/YYYY)
 */
export const cardExpirySchema = z.string()
  .refine(val => {
    const result = validateExpiry(val);
    return result.isValid;
  }, {
    message: 'Invalid or expired date'
  });

/**
 * CVV Schema (context-aware based on card brand)
 */
export const createCvvSchema = (cardNumber?: string) => z.string()
  .refine(val => {
    const result = validateCvv(val, cardNumber);
    return result.isValid;
  }, {
    message: 'Invalid CVV'
  });

/**
 * Basic CVV Schema (3-4 digits)
 */
export const cvvSchema = z.string()
  .regex(/^\d{3,4}$/, 'CVV must be 3 or 4 digits');

/**
 * Date of Birth Schema
 */
export const dobSchema = z.string()
  .refine(val => {
    const result = validateDob(val);
    return result.isValid;
  }, {
    message: 'Invalid date of birth'
  });

/**
 * DOB with custom age requirements
 */
export const createDobSchema = (minAge: number = 14, maxAge: number = 120) => 
  z.string().refine(val => {
    const result = validateDob(val, { minAge, maxAge });
    return result.isValid;
  }, {
    message: `Age must be between ${minAge} and ${maxAge} years`
  });

/**
 * Canadian Province Schema
 */
export const canadianProvinceSchema = z.enum([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'
]);

/**
 * Driver's License Schema (requires province context)
 */
export const createDriversLicenseSchema = (province: CanadianProvince) =>
  z.string()
    .transform(val => normalizeIdNumber(val))
    .refine(val => {
      const result = validateDriversLicense(val, province);
      return result.isValid;
    }, {
      message: `Invalid license format for ${province}`
    });

/**
 * Full Credit Card Form Schema
 * Note: CVV is included for form validation but should NEVER be sent to backend
 */
export const creditCardFormSchema = z.object({
  cardNumber: z.string()
    .min(1, 'Card number is required')
    .refine(val => validateCardNumber(val).isValid, {
      message: 'Invalid card number'
    }),
  expiry: z.string()
    .min(1, 'Expiry is required')
    .refine(val => validateExpiry(val).isValid, {
      message: 'Invalid or expired date'
    }),
  cvv: z.string()
    .min(1, 'CVV is required')
    .regex(/^\d{3,4}$/, 'CVV must be 3 or 4 digits'),
  cardholderName: z.string()
    .min(1, 'Cardholder name is required')
    .max(100, 'Name too long')
});

/**
 * Identity Document Form Schema
 */
export const identityDocumentSchema = z.object({
  province: canadianProvinceSchema,
  licenseNumber: z.string().min(1, 'License number is required'),
  dateOfBirth: z.string()
    .min(1, 'Date of birth is required')
    .refine(val => validateDob(val).isValid, {
      message: 'Invalid date of birth'
    })
}).refine(data => {
  const result = validateDriversLicense(data.licenseNumber, data.province);
  return result.isValid;
}, {
  message: 'Invalid license number for selected province',
  path: ['licenseNumber']
});

/**
 * Type exports for form data
 */
export type CreditCardFormData = z.infer<typeof creditCardFormSchema>;
export type IdentityDocumentFormData = z.infer<typeof identityDocumentSchema>;
