/**
 * Validation Module Unit Tests
 * 
 * Run with: npx tsx src/lib/validation/validation.test.ts
 */

import {
  // Card validation
  luhnCheck,
  validateCardNumber,
  validateExpiry,
  validateCvv,
  detectCardBrand,
  
  // DOB validation
  validateDob,
  
  // Identity validation
  validateDriversLicense,
  getProvinceRegex,
  REGEX_EXAMPLES,
  
  // Normalization
  normalizeIdNumber,
  
  // Security utilities
  extractCardMetadata,
  stripSensitiveCardData
} from './index';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean) {
  try {
    const result = fn();
    if (result) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ ${name} (threw: ${e})`);
    failed++;
  }
}

console.log('\n========================================');
console.log('Validation Module Tests');
console.log('========================================\n');

// ============ CARD VALIDATION ============
console.log('--- Card Validation ---\n');

test('Luhn: Valid Visa card passes', () => {
  return luhnCheck('4111111111111111') === true;
});

test('Luhn: Invalid card fails', () => {
  return luhnCheck('4111111111111112') === false;
});

test('Luhn: Valid Mastercard passes', () => {
  return luhnCheck('5500000000000004') === true;
});

test('Luhn: Valid Amex passes', () => {
  return luhnCheck('340000000000009') === true;
});

test('Card number: Too short fails', () => {
  const result = validateCardNumber('411111111111');
  return result.isValid === false && result.error !== undefined;
});

test('Card number: With spaces passes after normalization', () => {
  return validateCardNumber('4111 1111 1111 1111').isValid === true;
});

test('Detect brand: Visa', () => {
  return detectCardBrand('4111111111111111') === 'visa';
});

test('Detect brand: Mastercard', () => {
  return detectCardBrand('5500000000000004') === 'mastercard';
});

test('Detect brand: Amex', () => {
  return detectCardBrand('340000000000009') === 'amex';
});

// Expiry tests
test('Expiry: Valid future date passes', () => {
  const futureYear = new Date().getFullYear() + 1;
  const yy = String(futureYear).slice(-2);
  return validateExpiry(`12/${yy}`).isValid === true;
});

test('Expiry: Past date fails', () => {
  return validateExpiry('01/20').isValid === false;
});

test('Expiry: Invalid month fails', () => {
  return validateExpiry('13/25').isValid === false;
});

test('Expiry: Current month passes', () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  return validateExpiry(`${month}/${year}`).isValid === true;
});

// CVV tests
test('CVV: 3 digits for Visa passes', () => {
  return validateCvv('123', '4111111111111111').isValid === true;
});

test('CVV: 4 digits for Amex passes', () => {
  return validateCvv('1234', '340000000000009').isValid === true;
});

test('CVV: 3 digits for Amex fails', () => {
  return validateCvv('123', '340000000000009').isValid === false;
});

test('CVV: Non-digits fail', () => {
  return validateCvv('12a', '4111111111111111').isValid === false;
});

// ============ DOB VALIDATION ============
console.log('\n--- DOB Validation ---\n');

test('DOB: Valid adult date passes', () => {
  return validateDob('1990-05-15').isValid === true;
});

test('DOB: Future date fails', () => {
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  return validateDob(futureDate.toISOString().split('T')[0]).isValid === false;
});

test('DOB: Too young (< 14) fails', () => {
  const youngDate = new Date();
  youngDate.setFullYear(youngDate.getFullYear() - 10);
  return validateDob(youngDate.toISOString().split('T')[0]).isValid === false;
});

test('DOB: Too old (> 120) fails', () => {
  return validateDob('1850-01-01').isValid === false;
});

// IMPOSSIBLE DATE TESTS
test('DOB: Impossible date Feb 31 fails', () => {
  return validateDob('2024-02-31').isValid === false;
});

test('DOB: Impossible date Feb 30 fails', () => {
  return validateDob('2024-02-30').isValid === false;
});

test('DOB: Impossible date Apr 31 fails', () => {
  return validateDob('2024-04-31').isValid === false;
});

test('DOB: Valid Feb 29 leap year passes', () => {
  return validateDob('2024-02-29').isValid === true;
});

test('DOB: Invalid Feb 29 non-leap year fails', () => {
  return validateDob('2023-02-29').isValid === false;
});

test('DOB: Impossible date month 13 fails', () => {
  return validateDob('2024-13-01').isValid === false;
});

test('DOB: DD/MM/YYYY format with impossible date fails', () => {
  return validateDob('31/02/2024').isValid === false;
});

test('DOB: Empty required fails', () => {
  return validateDob('', { required: true }).isValid === false;
});

test('DOB: Empty optional passes', () => {
  return validateDob('', { required: false }).isValid === true;
});

// ============ IDENTITY VALIDATION ============
console.log('\n--- Identity (Driver\'s License) Validation ---\n');

// QC tests
test('QC License: Valid format (letter + 12 digits) passes', () => {
  return validateDriversLicense('A123456789012', 'QC').isValid === true;
});

test('QC License: With hyphens normalizes and passes', () => {
  const result = validateDriversLicense('A1234-567890-12', 'QC');
  return result.isValid === true && result.normalizedValue === 'A123456789012';
});

test('QC License: Lowercase normalizes to uppercase', () => {
  const result = validateDriversLicense('a123456789012', 'QC');
  return result.isValid === true && result.normalizedValue === 'A123456789012';
});

test('QC License: Wrong format (only digits) fails', () => {
  return validateDriversLicense('1234567890123', 'QC').isValid === false;
});

test('QC License: Too short fails', () => {
  return validateDriversLicense('A12345678901', 'QC').isValid === false;
});

// ON tests
test('ON License: Valid format (letter + 14 digits) passes', () => {
  return validateDriversLicense('A12345678901234', 'ON').isValid === true;
});

test('ON License: Wrong format fails', () => {
  return validateDriversLicense('A1234567890123', 'ON').isValid === false;
});

// AB tests
test('AB License: Valid 9 digits passes', () => {
  return validateDriversLicense('123456789', 'AB').isValid === true;
});

test('AB License: With spaces normalizes and passes', () => {
  const result = validateDriversLicense('123 456 789', 'AB');
  return result.isValid === true && result.normalizedValue === '123456789';
});

// BC tests
test('BC License: Valid 7 digits passes', () => {
  return validateDriversLicense('1234567', 'BC').isValid === true;
});

// Empty/invalid tests
test('License: Empty value fails', () => {
  return validateDriversLicense('', 'QC').isValid === false;
});

// ============ REGEX EXAMPLES ============
console.log('\n--- Regex Examples (for documentation) ---\n');

console.log('QC regex:', REGEX_EXAMPLES.QC);
console.log('ON regex:', REGEX_EXAMPLES.ON);
console.log('AB regex:', REGEX_EXAMPLES.AB);
console.log('BC regex:', REGEX_EXAMPLES.BC);

test('QC regex matches correct pattern', () => {
  const regex = getProvinceRegex('QC');
  return regex.test('A123456789012') === true;
});

test('ON regex matches correct pattern', () => {
  const regex = getProvinceRegex('ON');
  return regex.test('A12345678901234') === true;
});

// ============ SECURITY UTILITIES ============
console.log('\n--- Security Utilities ---\n');

test('extractCardMetadata: returns correct metadata', () => {
  const metadata = extractCardMetadata('4111 1111 1111 1111', '12/25');
  return metadata !== null && 
    metadata.brand === 'visa' && 
    metadata.last4 === '1111' && 
    metadata.expMonth === 12 && 
    metadata.expYear === 2025;
});

test('extractCardMetadata: works with MMYYYY format', () => {
  const metadata = extractCardMetadata('5500000000000004', '122026');
  return metadata !== null && 
    metadata.brand === 'mastercard' && 
    metadata.last4 === '0004' && 
    metadata.expMonth === 12 && 
    metadata.expYear === 2026;
});

test('extractCardMetadata: returns null for invalid expiry', () => {
  const metadata = extractCardMetadata('4111111111111111', '1');
  return metadata === null;
});

test('extractCardMetadata: returns null for month 00', () => {
  const metadata = extractCardMetadata('4111111111111111', '00/25');
  return metadata === null;
});

test('extractCardMetadata: returns null for month 13', () => {
  const metadata = extractCardMetadata('4111111111111111', '13/25');
  return metadata === null;
});

test('stripSensitiveCardData: removes all sensitive fields', () => {
  const formData = {
    cardNumber: '4111111111111111',
    expiry: '12/25',
    cvv: '123',
    cardholderName: 'John Doe',
    orderId: '12345'
  };
  const safe = stripSensitiveCardData(formData);
  return !('cardNumber' in safe) && 
    !('expiry' in safe) && 
    !('cvv' in safe) && 
    safe.cardholderName === 'John Doe' &&
    safe.orderId === '12345';
});

// ============ SUMMARY ============
console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
