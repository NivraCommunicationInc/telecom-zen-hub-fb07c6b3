/**
 * Date of Birth (DOB) Validation Utilities
 */

export interface DobValidationResult {
  isValid: boolean;
  error?: {
    en: string;
    fr: string;
  };
}

export interface DobConfig {
  minAge?: number;
  maxAge?: number;
  required?: boolean;
}

const DEFAULT_CONFIG: Required<DobConfig> = {
  minAge: 14,
  maxAge: 120,
  required: true
};

/**
 * Calculate age from date of birth
 */
export const calculateAge = (dob: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Validate that a Date object matches the expected year/month/day
 * This catches impossible dates like Feb 31 that JS auto-corrects
 */
const validateDateComponents = (
  date: Date,
  expectedYear: number,
  expectedMonth: number,
  expectedDay: number
): boolean => {
  return (
    date.getFullYear() === expectedYear &&
    date.getMonth() === expectedMonth - 1 &&
    date.getDate() === expectedDay
  );
};

/**
 * Parse date string in strict formats only
 * Accepts ONLY:
 * - YYYY-MM-DD (ISO, recommended)
 * - DD/MM/YYYY (Quebec format)
 * 
 * NO fallback to native Date parsing (ambiguous across browsers)
 * Rejects impossible dates like 2024-02-31
 */
export const parseDate = (value: string): Date | null => {
  if (!value) return null;
  
  const trimmed = value.trim();
  
  // Try ISO format (YYYY-MM-DD)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    
    // Basic range validation
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    
    const date = new Date(year, month - 1, day);
    
    // Validate that JS didn't auto-correct an impossible date
    if (!validateDateComponents(date, year, month, day)) return null;
    
    return date;
  }
  
  // Try DD/MM/YYYY format (Quebec)
  const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);
    
    // Basic range validation
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    
    const date = new Date(year, month - 1, day);
    
    // Validate that JS didn't auto-correct an impossible date
    if (!validateDateComponents(date, year, month, day)) return null;
    
    return date;
  }
  
  // No fallback - reject ambiguous formats
  return null;
};

/**
 * Validate date of birth
 */
export const validateDob = (
  value: string | Date | null | undefined,
  config?: DobConfig
): DobValidationResult => {
  const { minAge, maxAge, required } = { ...DEFAULT_CONFIG, ...config };
  
  // Handle empty value
  if (!value || (typeof value === 'string' && !value.trim())) {
    if (required) {
      return {
        isValid: false,
        error: {
          en: 'Date of birth is required',
          fr: 'La date de naissance est requise'
        }
      };
    }
    return { isValid: true };
  }
  
  // Parse the date
  const dob = typeof value === 'string' ? parseDate(value) : value;
  
  if (!dob || isNaN(dob.getTime())) {
    return {
      isValid: false,
      error: {
        en: 'Invalid date format',
        fr: 'Format de date invalide'
      }
    };
  }
  
  // Check for future date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (dob > today) {
    return {
      isValid: false,
      error: {
        en: 'Date of birth cannot be in the future',
        fr: 'La date de naissance ne peut pas être dans le futur'
      }
    };
  }
  
  // Calculate age
  const age = calculateAge(dob);
  
  // Check minimum age
  if (age < minAge) {
    return {
      isValid: false,
      error: {
        en: `You must be at least ${minAge} years old`,
        fr: `Vous devez avoir au moins ${minAge} ans`
      }
    };
  }
  
  // Check maximum age (sanity check)
  if (age > maxAge) {
    return {
      isValid: false,
      error: {
        en: 'Please enter a valid date of birth',
        fr: 'Veuillez entrer une date de naissance valide'
      }
    };
  }
  
  return { isValid: true };
};

/**
 * Format date for display (YYYY-MM-DD for inputs)
 */
export const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format date for display (localized)
 */
export const formatDateDisplay = (date: Date, locale: 'en' | 'fr' = 'fr'): string => {
  return date.toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};
