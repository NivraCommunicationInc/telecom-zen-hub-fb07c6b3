/**
 * Secure ID Generator - Nivra PDF Document Standards
 * 
 * RÈGLE GLOBALE: Tous les identifiants numériques doivent:
 * - ❌ Ne JAMAIS commencer par 0 ou 1
 * - ✅ Toujours commencer par 2–9
 * - Avoir une longueur fixe selon le type
 * - Être 100% numérique et unique
 * 
 * @module secureIdGenerator
 */

// ============================================================================
// TYPES
// ============================================================================

export type DocumentIdType = 
  | 'account'              // 6 chiffres
  | 'order'                // 5 chiffres
  | 'invoice'              // 7 chiffres
  | 'contract'             // 9 chiffres
  | 'payment_confirmation' // 10 chiffres
  | 'payment_reference';   // 8 chiffres

export interface IdLengthConfig {
  account: 6;
  order: 5;
  invoice: 7;
  contract: 9;
  payment_confirmation: 10;
  payment_reference: 8;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Longueurs fixes par type d'identifiant
 */
export const ID_LENGTHS: IdLengthConfig = {
  account: 6,
  order: 5,
  invoice: 7,
  contract: 9,
  payment_confirmation: 10,
  payment_reference: 8,
} as const;

/**
 * Chiffres autorisés pour le premier caractère (2-9)
 */
const FIRST_DIGIT_CHARS = ['2', '3', '4', '5', '6', '7', '8', '9'] as const;

/**
 * Tous les chiffres pour les caractères suivants (0-9)
 */
const ALL_DIGIT_CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

// ============================================================================
// CORE GENERATOR FUNCTIONS
// ============================================================================

/**
 * Génère un chiffre aléatoire entre 2 et 9 (premier caractère)
 */
export function generateFirstDigit(): string {
  const index = Math.floor(Math.random() * FIRST_DIGIT_CHARS.length);
  return FIRST_DIGIT_CHARS[index];
}

/**
 * Génère les chiffres restants (0-9)
 */
export function generateRemainingDigits(count: number): string {
  let result = '';
  for (let i = 0; i < count; i++) {
    const index = Math.floor(Math.random() * ALL_DIGIT_CHARS.length);
    result += ALL_DIGIT_CHARS[index];
  }
  return result;
}

/**
 * Génère un identifiant numérique sécurisé avec le premier chiffre 2-9
 * 
 * @param length - Longueur totale de l'identifiant
 * @returns Identifiant numérique de la longueur spécifiée
 * 
 * @example
 * generateSecureNumericId(6) // "234567"
 * generateSecureNumericId(10) // "9012345678"
 */
export function generateSecureNumericId(length: number): string {
  if (length < 1) {
    throw new Error('Length must be at least 1');
  }
  
  const firstDigit = generateFirstDigit();
  
  if (length === 1) {
    return firstDigit;
  }
  
  const remainingDigits = generateRemainingDigits(length - 1);
  const result = firstDigit + remainingDigits;
  
  // GARDE-FOU: Vérification finale
  if (result[0] === '0' || result[0] === '1') {
    console.error('[SecureIdGenerator] GUARD VIOLATION: ID starts with 0 or 1, regenerating...');
    return generateSecureNumericId(length);
  }
  
  return result;
}

// ============================================================================
// TYPED DOCUMENT ID GENERATORS
// ============================================================================

/**
 * Génère un numéro de compte sécurisé (6 chiffres, commence par 2-9)
 * 
 * @example
 * generateAccountNumber() // "234567"
 */
export function generateAccountNumber(): string {
  return generateSecureNumericId(ID_LENGTHS.account);
}

/**
 * Génère un numéro de commande sécurisé (5 chiffres, commence par 2-9)
 * 
 * @example
 * generateOrderNumber() // "23456"
 */
export function generateOrderNumber(): string {
  return generateSecureNumericId(ID_LENGTHS.order);
}

/**
 * Génère un numéro de facture sécurisé (7 chiffres, commence par 2-9)
 * 
 * @example
 * generateInvoiceNumber() // "2345678"
 */
export function generateInvoiceNumber(): string {
  return generateSecureNumericId(ID_LENGTHS.invoice);
}

/**
 * Génère un numéro de contrat sécurisé (9 chiffres, commence par 2-9)
 * 
 * @example
 * generateContractNumber() // "234567890"
 */
export function generateContractNumber(): string {
  return generateSecureNumericId(ID_LENGTHS.contract);
}

/**
 * Génère un numéro de confirmation de paiement sécurisé (10 chiffres, commence par 2-9)
 * 
 * @example
 * generatePaymentConfirmation() // "2345678901"
 */
export function generatePaymentConfirmation(): string {
  return generateSecureNumericId(ID_LENGTHS.payment_confirmation);
}

/**
 * Génère une référence de paiement sécurisée (8 chiffres, commence par 2-9)
 * Dérivée de la facture: premier chiffre aléatoire 2-9 + 7 premiers chiffres de invoice_number
 * 
 * @param invoiceNumber - Numéro de facture (optionnel, si fourni les 7 premiers chiffres sont utilisés)
 * @returns Référence de paiement de 8 chiffres
 * 
 * @example
 * generatePaymentReference() // "23456789"
 * generatePaymentReference("2345678") // "5234567" (premier aléatoire + 7 premiers de invoice)
 */
export function generatePaymentReference(invoiceNumber?: string): string {
  if (invoiceNumber && invoiceNumber.length >= 7) {
    // Dérivée: premier chiffre aléatoire 2-9 + 7 premiers chiffres de la facture
    const firstDigit = generateFirstDigit();
    const derivedPart = invoiceNumber.substring(0, 7).replace(/\D/g, '');
    
    if (derivedPart.length >= 7) {
      return firstDigit + derivedPart.substring(0, 7);
    }
  }
  
  // Fallback: génération complète
  return generateSecureNumericId(ID_LENGTHS.payment_reference);
}

// ============================================================================
// VALIDATION & UTILITIES
// ============================================================================

/**
 * Valide qu'un identifiant respecte les règles de sécurité
 * 
 * @param id - L'identifiant à valider
 * @param expectedLength - La longueur attendue (optionnelle)
 * @returns true si l'identifiant est valide
 */
export function isValidSecureId(id: string, expectedLength?: number): boolean {
  // Vérifier que c'est une chaîne non vide
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  // Vérifier la longueur si spécifiée
  if (expectedLength !== undefined && id.length !== expectedLength) {
    return false;
  }
  
  // Vérifier que c'est 100% numérique
  if (!/^\d+$/.test(id)) {
    return false;
  }
  
  // Vérifier que le premier caractère est 2-9
  const firstChar = id[0];
  if (firstChar === '0' || firstChar === '1') {
    return false;
  }
  
  return true;
}

/**
 * Valide un identifiant et le régénère s'il est invalide
 * 
 * @param id - L'identifiant à valider
 * @param type - Le type de document pour déterminer la longueur
 * @returns L'identifiant original s'il est valide, sinon un nouveau
 */
export function ensureValidSecureId(id: string | undefined | null, type: DocumentIdType): string {
  const expectedLength = ID_LENGTHS[type];
  
  if (id && isValidSecureId(id, expectedLength)) {
    return id;
  }
  
  return generateSecureNumericId(expectedLength);
}

/**
 * Génère un ensemble complet d'identifiants pour un document
 * Utile pour les previews et les tests
 */
export interface DocumentIdSet {
  account_number: string;
  order_number: string;
  invoice_number: string;
  contract_number: string;
  payment_confirmation: string;
  payment_reference: string;
}

export function generateDocumentIdSet(): DocumentIdSet {
  const invoice_number = generateInvoiceNumber();
  
  return {
    account_number: generateAccountNumber(),
    order_number: generateOrderNumber(),
    invoice_number,
    contract_number: generateContractNumber(),
    payment_confirmation: generatePaymentConfirmation(),
    payment_reference: generatePaymentReference(invoice_number),
  };
}

// ============================================================================
// FORMATTING UTILITIES (Optional prefixes for display)
// ============================================================================

/**
 * Formate un ID avec un préfixe optionnel pour l'affichage
 * Note: Les PDFs utilisent des IDs numériques purs, mais certaines UI peuvent afficher des préfixes
 */
export function formatWithPrefix(id: string, prefix: string): string {
  return `${prefix}${id}`;
}

/**
 * Préfixes standards (pour référence, non utilisés dans les PDFs)
 */
export const DISPLAY_PREFIXES = {
  account: 'ACC-',
  order: 'ORD-',
  invoice: 'INV-',
  contract: 'CTR-',
  payment: 'PAY-',
} as const;

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  generateSecureNumericId,
  generateAccountNumber,
  generateOrderNumber,
  generateInvoiceNumber,
  generateContractNumber,
  generatePaymentConfirmation,
  generatePaymentReference,
  generateDocumentIdSet,
  isValidSecureId,
  ensureValidSecureId,
  ID_LENGTHS,
};
