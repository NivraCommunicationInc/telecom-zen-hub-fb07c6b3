/**
 * PDF Text Sanitizer V2.5
 * 
 * RÈGLE GLOBALE: Aucun texte non lisible ne doit apparaître dans les PDFs.
 * Ce module fournit des fonctions de validation et de nettoyage pour tous
 * les champs texte avant rendu PDF.
 */

// ============================================================================
// REGEX PATTERNS FOR DETECTION
// ============================================================================

// Caractères de contrôle (0x00-0x1F sauf newline/tab, et 0x7F)
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// Caractères Unicode problématiques (control chars, non-printables)
const UNICODE_CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;

// Pattern pour détecter du texte corrompu (ex: &&&P&A..., séquences sans sens)
const CORRUPTED_PATTERN = /^[&%#@!*]+[A-Z&%#@!*]+|[\x00-\x1F\x7F-\x9F]/;

// Pattern pour séquences de caractères spéciaux répétés (indicateur de corruption)
const JUNK_SEQUENCE = /[&%#@!*]{3,}/g;

// ============================================================================
// CORE SANITIZATION
// ============================================================================

/**
 * Vérifie si un texte est imprimable et valide pour un PDF.
 * Retourne true si le texte est valide, false sinon.
 */
export function isPrintableText(text: string | undefined | null): boolean {
  if (!text) return true; // Empty is valid (will be replaced with —)
  
  // Check for control characters
  if (CONTROL_CHARS.test(text)) return false;
  
  // Check for Unicode control chars
  if (UNICODE_CONTROL.test(text)) return false;
  
  // Check for corrupted patterns
  if (CORRUPTED_PATTERN.test(text)) return false;
  
  // Check for junk sequences
  if (JUNK_SEQUENCE.test(text)) return false;
  
  return true;
}

/**
 * Nettoie le texte pour le rendre imprimable.
 * Supprime les caractères de contrôle, normalise les espaces.
 * Retourne "—" si le texte est irréparable.
 */
export function sanitizeForPDF(text: string | undefined | null): string {
  if (!text) return "—";
  
  // Trim first
    let cleaned = text.trim().replace(/[let cleaned = text.trim();§][0-9a-fk-or]/gi, "");
  
  if (cleaned === "") return "—";
  
  // Remove control characters
  cleaned = cleaned.replace(CONTROL_CHARS, "");
  cleaned = cleaned.replace(UNICODE_CONTROL, "");
  
  // Remove junk sequences
  cleaned = cleaned.replace(JUNK_SEQUENCE, "");
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  // If after cleaning the text is too short or empty, return placeholder
  if (cleaned.length < 2) return "—";
  
  // If still looks corrupted after cleaning, return placeholder
  if (CORRUPTED_PATTERN.test(cleaned)) {
    console.warn(`[PDF Sanitizer] Texte corrompu détecté et remplacé: "${text.substring(0, 50)}..."`);
    return "—";
  }
  
  return cleaned;
}

/**
 * Assertion pour les champs texte critiques.
 * Lève un warning et retourne un placeholder si invalide.
 * Utilisé pour les champs essentiels comme nom, adresse, etc.
 */
export function assertPrintableText(
  text: string | undefined | null, 
  fieldName: string,
  options: { required?: boolean; logLevel?: "warn" | "error" } = {}
): string {
  const { required = false, logLevel = "warn" } = options;
  
  if (!text || text.trim() === "") {
    if (required) {
      console[logLevel](`[PDF Sanitizer] Champ obligatoire vide: ${fieldName}`);
    }
    return "—";
  }
  
  if (!isPrintableText(text)) {
    console[logLevel](`[PDF Sanitizer] Texte invalide pour ${fieldName}: "${text.substring(0, 30)}..."`);
    return sanitizeForPDF(text);
  }
  
  return sanitizeForPDF(text);
}

// ============================================================================
// SPECIALIZED VALIDATORS
// ============================================================================

/**
 * Valide et nettoie un nom de client
 */
export function sanitizeClientName(name: string | undefined | null): string {
  return assertPrintableText(name, "client_name", { required: true });
}

/**
 * Valide et nettoie une adresse
 */
export function sanitizeAddress(address: string | undefined | null): string {
  return assertPrintableText(address, "address", { required: false });
}

/**
 * Valide et nettoie un email
 */
export function sanitizeEmail(email: string | undefined | null): string {
  if (!email) return "—";
  
  const cleaned = sanitizeForPDF(email);
  
  // Basic email validation
  if (!cleaned.includes("@") || !cleaned.includes(".")) {
    console.warn(`[PDF Sanitizer] Email invalide: ${email}`);
    return "—";
  }
  
  return cleaned;
}

/**
 * Valide et nettoie une référence de paiement
 */
export function sanitizePaymentReference(ref: string | undefined | null): string {
  return assertPrintableText(ref, "payment_reference", { required: false });
}

/**
 * Valide et nettoie une description de service
 */
export function sanitizeDescription(desc: string | undefined | null): string {
  return assertPrintableText(desc, "description", { required: false });
}

/**
 * Valide et nettoie des notes
 */
export function sanitizeNotes(notes: string | undefined | null): string {
  if (!notes) return "";
  return assertPrintableText(notes, "notes", { required: false });
}

// ============================================================================
// BATCH SANITIZATION
// ============================================================================

/**
 * Interface pour les données client à nettoyer
 */
interface CustomerData {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
}

/**
 * Nettoie tous les champs d'un objet client
 */
export function sanitizeCustomerData(customer: CustomerData): Required<Omit<CustomerData, 'address_line2'>> & { address_line2?: string } {
  return {
    full_name: sanitizeClientName(customer.full_name),
    email: sanitizeEmail(customer.email),
    phone: assertPrintableText(customer.phone, "phone"),
    address_line1: sanitizeAddress(customer.address_line1),
    address_line2: customer.address_line2 ? sanitizeAddress(customer.address_line2) : undefined,
    city: assertPrintableText(customer.city, "city"),
    province: assertPrintableText(customer.province, "province"),
    postal_code: assertPrintableText(customer.postal_code, "postal_code"),
  };
}

/**
 * Interface pour les données de paiement à nettoyer
 */
interface PaymentData {
  method?: string | null;
  paid_at?: string | null;
  processor_txn_id?: string | null;
  payment_reference?: string | null;
  paid_amount?: number | null;
}

/**
 * Nettoie tous les champs d'un objet paiement
 */
export function sanitizePaymentData(payment: PaymentData): {
  method: string;
  paid_at: string;
  processor_txn_id: string;
  payment_reference: string;
  paid_amount: number;
} {
  return {
    method: assertPrintableText(payment.method, "payment_method"),
    paid_at: payment.paid_at || "—",
    processor_txn_id: sanitizePaymentReference(payment.processor_txn_id),
    payment_reference: sanitizePaymentReference(payment.payment_reference),
    paid_amount: payment.paid_amount || 0,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  isPrintableText,
  sanitizeForPDF,
  assertPrintableText,
  sanitizeClientName,
  sanitizeAddress,
  sanitizeEmail,
  sanitizePaymentReference,
  sanitizeDescription,
  sanitizeNotes,
  sanitizeCustomerData,
  sanitizePaymentData,
};
