/**
 * Canadian Driver's License / ID Validation
 * 
 * Based on FMCSA DLN formats for Canadian provinces
 * Reference: https://www.fmcsa.dot.gov/
 * 
 * Pattern Legend:
 * - 9 = digit (0-9)
 * - A = letter (A-Z)
 * - X = alphanumeric (A-Z or 0-9)
 * - K = letter or asterisk (A-Z or *)
 */

import { normalizeIdNumber } from './normalize';

export type CanadianProvince = 
  | 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' 
  | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';

export interface ProvinceInfo {
  code: CanadianProvince;
  nameFr: string;
  nameEn: string;
  pattern: string;
  description: string;
}

/**
 * Canadian province driver's license patterns
 * Pattern after normalization (uppercase, no spaces/hyphens)
 */
export const PROVINCE_DLN_PATTERNS: Record<CanadianProvince, ProvinceInfo> = {
  AB: {
    code: 'AB',
    nameFr: 'Alberta',
    nameEn: 'Alberta',
    pattern: '999999999',
    description: '9 digits'
  },
  BC: {
    code: 'BC',
    nameFr: 'Colombie-Britannique',
    nameEn: 'British Columbia',
    pattern: '9999999',
    description: '7 digits'
  },
  MB: {
    code: 'MB',
    nameFr: 'Manitoba',
    nameEn: 'Manitoba',
    pattern: 'AKKKKAKXX9XX9',
    description: 'Complex format with letters and digits'
  },
  NB: {
    code: 'NB',
    nameFr: 'Nouveau-Brunswick',
    nameEn: 'New Brunswick',
    pattern: '9999999',
    description: '7 digits'
  },
  NL: {
    code: 'NL',
    nameFr: 'Terre-Neuve-et-Labrador',
    nameEn: 'Newfoundland and Labrador',
    pattern: 'A999999999',
    description: '1 letter + 9 digits'
  },
  NS: {
    code: 'NS',
    nameFr: 'Nouvelle-Écosse',
    nameEn: 'Nova Scotia',
    pattern: 'AKKKK999999999',
    description: '1 letter + 4 chars + 9 digits'
  },
  NT: {
    code: 'NT',
    nameFr: 'Territoires du Nord-Ouest',
    nameEn: 'Northwest Territories',
    pattern: '999999999',
    description: '9 digits'
  },
  NU: {
    code: 'NU',
    nameFr: 'Nunavut',
    nameEn: 'Nunavut',
    pattern: '99999',
    description: '5 digits'
  },
  ON: {
    code: 'ON',
    nameFr: 'Ontario',
    nameEn: 'Ontario',
    pattern: 'A99999999999999',
    description: '1 letter + 14 digits'
  },
  PE: {
    code: 'PE',
    nameFr: 'Île-du-Prince-Édouard',
    nameEn: 'Prince Edward Island',
    pattern: '99999',
    description: '5 digits'
  },
  QC: {
    code: 'QC',
    nameFr: 'Québec',
    nameEn: 'Quebec',
    pattern: 'A999999999999',
    description: '1 letter + 12 digits'
  },
  SK: {
    code: 'SK',
    nameFr: 'Saskatchewan',
    nameEn: 'Saskatchewan',
    pattern: '99999999',
    description: '8 digits'
  },
  YT: {
    code: 'YT',
    nameFr: 'Yukon',
    nameEn: 'Yukon',
    pattern: '999999',
    description: '6 digits'
  }
};

/**
 * Convert pattern character to regex fragment
 */
const patternCharToRegex = (char: string): string => {
  switch (char) {
    case '9':
      return '\\d';
    case 'A':
      return '[A-Z]';
    case 'X':
      return '[A-Z0-9]';
    case 'K':
      return '[A-Z*]';
    default:
      return char;
  }
};

/**
 * Convert FMCSA pattern to RegExp
 */
export const patternToRegex = (pattern: string): RegExp => {
  const regexStr = pattern
    .split('')
    .map(patternCharToRegex)
    .join('');
  return new RegExp(`^${regexStr}$`);
};

/**
 * Get regex for a specific province
 */
export const getProvinceRegex = (province: CanadianProvince): RegExp => {
  const info = PROVINCE_DLN_PATTERNS[province];
  return patternToRegex(info.pattern);
};

export interface IdentityValidationResult {
  isValid: boolean;
  normalizedValue?: string;
  error?: {
    en: string;
    fr: string;
  };
}

/**
 * Validate Canadian driver's license number
 */
export const validateDriversLicense = (
  value: string,
  province: CanadianProvince
): IdentityValidationResult => {
  if (!value || !value.trim()) {
    return {
      isValid: false,
      error: {
        en: 'License number is required',
        fr: 'Le numéro de permis est requis'
      }
    };
  }
  
  const provinceInfo = PROVINCE_DLN_PATTERNS[province];
  if (!provinceInfo) {
    return {
      isValid: false,
      error: {
        en: 'Invalid province selected',
        fr: 'Province sélectionnée invalide'
      }
    };
  }
  
  // Normalize: uppercase, remove spaces and hyphens
  const normalized = normalizeIdNumber(value);
  
  // Get regex for province
  const regex = getProvinceRegex(province);
  
  if (!regex.test(normalized)) {
    return {
      isValid: false,
      error: {
        en: `Invalid format for ${provinceInfo.nameEn} license (${provinceInfo.description})`,
        fr: `Format invalide pour le permis du ${provinceInfo.nameFr} (${provinceInfo.description})`
      }
    };
  }
  
  return {
    isValid: true,
    normalizedValue: normalized
  };
};

/**
 * Get list of provinces for dropdown
 */
export const getProvinceOptions = (locale: 'en' | 'fr' = 'fr'): Array<{ value: CanadianProvince; label: string }> => {
  return Object.values(PROVINCE_DLN_PATTERNS)
    .map(info => ({
      value: info.code,
      label: locale === 'fr' ? info.nameFr : info.nameEn
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

/**
 * Format license number for display (province-specific)
 * QC example: A1234-567890-12 display format
 */
export const formatLicenseDisplay = (value: string, province: CanadianProvince): string => {
  const normalized = normalizeIdNumber(value);
  
  // QC specific formatting: A1234-567890-12
  if (province === 'QC' && normalized.length === 13) {
    return `${normalized.slice(0, 5)}-${normalized.slice(5, 11)}-${normalized.slice(11)}`;
  }
  
  // ON specific formatting: A1234-56789-01234
  if (province === 'ON' && normalized.length === 15) {
    return `${normalized.slice(0, 5)}-${normalized.slice(5, 10)}-${normalized.slice(10)}`;
  }
  
  return normalized;
};

// Export regex examples for documentation
export const REGEX_EXAMPLES = {
  QC: patternToRegex('A999999999999').toString(), // /^[A-Z]\d{12}$/
  ON: patternToRegex('A99999999999999').toString(), // /^[A-Z]\d{14}$/
  AB: patternToRegex('999999999').toString(), // /^\d{9}$/
  BC: patternToRegex('9999999').toString(), // /^\d{7}$/
};
