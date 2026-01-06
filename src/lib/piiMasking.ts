/**
 * PII Masking Utility
 * 
 * Masks personally identifiable information for logs, QA reports, and debugging.
 * Use these functions whenever displaying customer data in non-production contexts.
 */

/**
 * Masks an email address, keeping first and last characters of local part
 * Example: "john.doe@example.com" → "j***e@example.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "***@***.***";
  
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***.***";
  
  if (local.length <= 2) {
    return `***@${domain}`;
  }
  
  const maskedLocal = `${local[0]}***${local[local.length - 1]}`;
  return `${maskedLocal}@${domain}`;
}

/**
 * Masks a phone number, keeping last 4 digits
 * Example: "514-555-1234" → "***-***-1234"
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "***-***-****";
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");
  
  if (digits.length < 4) return "***-***-****";
  
  const lastFour = digits.slice(-4);
  return `***-***-${lastFour}`;
}

/**
 * Masks a full name, keeping first letter of each part
 * Example: "Jean Dupont" → "J*** D***"
 */
export function maskName(name: string | null | undefined): string {
  if (!name) return "***";
  
  return name
    .split(" ")
    .map((part) => {
      if (part.length <= 1) return part;
      return `${part[0]}***`;
    })
    .join(" ");
}

/**
 * Masks a payment reference partially
 * Example: "NIVRA-PAY-QC-2026-64622" → "NIVRA-PAY-***-64622"
 */
export function maskPaymentRef(ref: string | null | undefined): string {
  if (!ref) return "***";
  
  // Keep prefix and last 5 characters
  if (ref.length <= 10) return ref;
  
  const prefix = ref.slice(0, 10);
  const suffix = ref.slice(-5);
  return `${prefix}***${suffix}`;
}

/**
 * Masks a client/account number partially
 * Example: "ACC-123456789" → "ACC-***6789"
 */
export function maskAccountNumber(num: string | null | undefined): string {
  if (!num) return "***";
  
  if (num.length <= 4) return num;
  
  const lastFour = num.slice(-4);
  const prefix = num.includes("-") ? num.split("-")[0] + "-" : "";
  return `${prefix}***${lastFour}`;
}

/**
 * Masks an address, keeping city and postal code
 * Example: "123 rue Notre-Dame, Montréal, QC H1A 1A1" → "*** rue ***, Montréal, QC H1A 1A1"
 */
export function maskAddress(address: string | null | undefined): string {
  if (!address) return "***";
  
  // Simple masking: replace street numbers
  return address.replace(/^\d+\s*/, "*** ");
}

/**
 * Helper to mask an object's PII fields for logging
 */
export function maskPIIFields(
  obj: Record<string, any>,
  fieldsToMask: {
    emails?: string[];
    phones?: string[];
    names?: string[];
    paymentRefs?: string[];
    accountNumbers?: string[];
  }
): Record<string, any> {
  const masked: Record<string, any> = { ...obj };
  
  fieldsToMask.emails?.forEach((field) => {
    if (masked[field]) {
      masked[field] = maskEmail(masked[field]);
    }
  });
  
  fieldsToMask.phones?.forEach((field) => {
    if (masked[field]) {
      masked[field] = maskPhone(masked[field]);
    }
  });
  
  fieldsToMask.names?.forEach((field) => {
    if (masked[field]) {
      masked[field] = maskName(masked[field]);
    }
  });
  
  fieldsToMask.paymentRefs?.forEach((field) => {
    if (masked[field]) {
      masked[field] = maskPaymentRef(masked[field]);
    }
  });
  
  fieldsToMask.accountNumbers?.forEach((field) => {
    if (masked[field]) {
      masked[field] = maskAccountNumber(masked[field]);
    }
  });
  
  return masked;
}
