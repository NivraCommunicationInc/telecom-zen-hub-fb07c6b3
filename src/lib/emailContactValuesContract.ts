/**
 * Email Contact Values Contract Test
 * 
 * This is a simple contract test that verifies the COMPANY_CONTACT
 * configuration contains expected values for email templates.
 * 
 * Run with: npx tsx src/lib/emailContactValuesContract.ts
 * 
 * Expected values:
 * - Phone: 438-544-2233
 * - Email: Support@nivratelecom.ca
 * - Address: 1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5
 */

import { COMPANY_CONTACT, ETRANSFER_CONFIG } from "../config/company";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

function assertNotContains(haystack: string, needle: string, context: string) {
  if (haystack.includes(needle)) {
    console.error(`❌ FAIL: ${context} contains forbidden value: ${needle}`);
    process.exit(1);
  }
}

console.log("\n========================================");
console.log("Email Contact Values Contract Test");
console.log("========================================\n");

// Test correct values
assert(COMPANY_CONTACT.supportPhoneDisplay === "438-544-2233", "supportPhoneDisplay is 438-544-2233");
assert(COMPANY_CONTACT.supportPhoneTel === "+14385442233", "supportPhoneTel is +14385442233");
assert(COMPANY_CONTACT.supportEmail === "support@nivratelecom.ca", "supportEmail is support@nivratelecom.ca");
assert(COMPANY_CONTACT.supportEmailDisplay === "Support@nivratelecom.ca", "supportEmailDisplay is Support@nivratelecom.ca");
assert(COMPANY_CONTACT.fullAddress === "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5", "fullAddress is correct");
assert(COMPANY_CONTACT.supportHours === "Lun–Ven : 9 h – 22 h | Sam–Dim : 9 h – 20 h", "supportHours is correct");

// Test ETRANSFER_CONFIG uses correct email
assert(ETRANSFER_CONFIG.email === "support@nivratelecom.ca", "ETRANSFER_CONFIG.email is correct");
assert(ETRANSFER_CONFIG.emailDisplay === "Support@nivratelecom.ca", "ETRANSFER_CONFIG.emailDisplay is correct");

// Test no forbidden values
const allValues = Object.values(COMPANY_CONTACT).join(" ");
const forbiddenStrings = ["1-800", "1-888", "514-757-5162", "info@nivra.ca"];

for (const forbidden of forbiddenStrings) {
  assertNotContains(allValues, forbidden, "COMPANY_CONTACT");
}

console.log("\n✅ All contract tests passed!\n");
