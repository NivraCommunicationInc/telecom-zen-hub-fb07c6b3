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
 * Parse date string in various formats
 * Accepts: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY (ISO preferred)
 */
export const parseDate = (value: string): Date | null => {
  if (!value) return null;
  
  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try DD/MM/YYYY format
  const slashMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try native Date parsing as fallback
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed;
  
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
