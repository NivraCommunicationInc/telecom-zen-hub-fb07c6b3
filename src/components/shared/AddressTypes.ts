/**
 * AddressValue - Structured address type returned by AddressAutocomplete.
 * This is the canonical type for all address data in the application.
 */
export interface AddressValue {
  /** Full formatted address string (e.g., "123 Rue Example, Montréal, QC H2X 1Y4, Canada") */
  formatted: string;
  /** Street address line 1 (number + street name, e.g., "123 Rue Example") */
  line1: string;
  /** Optional line 2 (apartment, suite, unit) - this is the only free-text field allowed */
  line2?: string;
  /** City name */
  city: string;
  /** Province/region code (e.g., "QC") */
  region: string;
  /** Postal code (e.g., "H2X 1Y4") */
  postalCode: string;
  /** Country (defaults to "Canada") */
  country: string;
  /** Latitude coordinate for mapping */
  lat?: number;
  /** Longitude coordinate for mapping */
  lng?: number;
  /** Mapbox place ID for reference */
  mapboxPlaceId?: string;
}

/**
 * Creates an empty AddressValue with default values.
 */
export const createEmptyAddressValue = (): AddressValue => ({
  formatted: "",
  line1: "",
  line2: "",
  city: "",
  region: "QC",
  postalCode: "",
  country: "Canada",
});

/**
 * Validates that an AddressValue has the minimum required fields.
 */
export const isAddressValueComplete = (address: AddressValue): boolean => {
  return !!(
    address.line1?.trim() &&
    address.city?.trim() &&
    address.region?.trim() &&
    address.postalCode?.trim() &&
    isValidCanadianPostalCode(address.postalCode)
  );
};

/**
 * Validates Canadian postal code format: A1A 1A1 or A1A1A1
 */
export const isValidCanadianPostalCode = (postalCode: string): boolean => {
  const cleaned = postalCode.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned);
};

/**
 * Formats a postal code to the standard A1A 1A1 format.
 */
export const formatPostalCode = (value: string): string => {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
};

/**
 * Normalizes province names to codes.
 */
export const normalizeProvince = (province?: string): string => {
  if (!province) return "QC";
  const lower = province.toLowerCase();
  if (lower === "quebec" || lower === "québec") return "QC";
  if (lower === "ontario") return "ON";
  // Return as-is if already a code or unknown
  return province.length === 2 ? province.toUpperCase() : province;
};
