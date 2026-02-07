/**
 * Nivra Invoice Engine V2.5
 * 
 * POINT D'ENTRÉE UNIQUE pour la génération de factures PDF.
 * Ce moteur utilise UNIQUEMENT les templates V2.5 actifs définis dans pdf_template_config.
 * Les templates legacy (V1.0) ne sont PLUS appelés.
 * 
 * Usage:
 *   import { generateInvoicePDF } from "@/lib/pdf/invoiceEngine";
 *   const result = await generateInvoicePDF(invoiceData);
 */

import { supabase } from "@/integrations/supabase/client";
import { generateInvoiceMonthlyV2PDF } from "./invoiceMonthlyTemplateV2";
import { generateInvoiceOneTimeV2PDF } from "./invoiceOneTimeTemplateV2";
import type { InvoiceDataV2, PDFGenerationResult, InvoiceType } from "./types";
import { NIVRA_COMPANY, PREPAID_LEGAL_FOOTER } from "./types";
import { createBlankInvoiceDataV2, TEMPLATE_WATERMARK } from "./blankTemplateData";

// ============================================================================
// FORBIDDEN TERMS (Prépayé - aucune dette)
// ============================================================================

const FORBIDDEN_TERMS_RENEWAL = [
  "impayé",
  "dette",
  "en retard",
  "overdue",
  "past due",
  "arriéré",
  "recouvrement",
  "collection",
];

// ============================================================================
// DATE VALIDATION & FORMATTING
// ============================================================================

/**
 * Valide qu'une chaîne est une date valide
 * Lève une erreur si la date est invalide
 */
function validateDate(dateStr: string | undefined, fieldName: string): void {
  if (!dateStr) return;
  
  // Placeholder pour template vierge - valide
  if (dateStr.includes("DATE_") || dateStr.includes("PERIODE") || dateStr.includes("DEBUT_") || dateStr.includes("FIN_")) {
    return;
  }
  
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    const error = `[InvoiceEngine] Date invalide détectée: ${fieldName} = "${dateStr}"`;
    console.error(error);
    throw new Error(error);
  }
}

/**
 * Formate une date de manière sécurisée
 * Retourne le placeholder si c'est un template vierge
 * Retourne "—" si la date est vide/invalide
 */
export function safeFormatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  
  // Placeholder pour template vierge
  if (dateStr.includes("DATE_") || dateStr.includes("PERIODE") || dateStr.includes("DEBUT_") || dateStr.includes("FIN_")) {
    return dateStr;
  }
  
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    console.warn(`[InvoiceEngine] Date invalide ignorée: "${dateStr}"`);
    return "—";
  }
  
  return parsed.toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Formate une date au format court YYYY-MM-DD
 */
export function safeFormatDateShort(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  
  // Placeholder pour template vierge
  if (dateStr.includes("DATE_") || dateStr.includes("PERIODE") || dateStr.includes("DEBUT_") || dateStr.includes("FIN_")) {
    return dateStr;
  }
  
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    console.warn(`[InvoiceEngine] Date invalide ignorée: "${dateStr}"`);
    return "—";
  }
  
  return parsed.toISOString().split("T")[0];
}

// ============================================================================
// TEXT SANITIZATION (Fix encoding issues)
// ============================================================================

/**
 * Nettoie le texte pour éviter les caractères corrompus dans le PDF
 * Supprime les caractères de contrôle, \x00, et caractères non-imprimables
 */
export function sanitizeText(text: string | undefined | null): string {
  if (!text) return "";
  
  // Remplacer les caractères problématiques
  return text
    // Supprimer les caractères de contrôle (0x00-0x1F sauf newline/tab)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Remplacer les caractères Unicode problématiques
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    // Normaliser les espaces
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sanitize toutes les chaînes dans un objet InvoiceDataV2
 */
function sanitizeInvoiceData(data: InvoiceDataV2): InvoiceDataV2 {
  return {
    ...data,
    invoice_number: sanitizeText(data.invoice_number),
    account_number: sanitizeText(data.account_number),
    status: sanitizeText(data.status) as InvoiceDataV2["status"],
    customer: {
      ...data.customer,
      full_name: sanitizeText(data.customer.full_name),
      email: sanitizeText(data.customer.email),
      phone: sanitizeText(data.customer.phone),
      address_line1: sanitizeText(data.customer.address_line1),
      address_line2: sanitizeText(data.customer.address_line2),
      city: sanitizeText(data.customer.city),
      province: sanitizeText(data.customer.province),
      postal_code: sanitizeText(data.customer.postal_code),
    },
    items: data.items.map(item => ({
      ...item,
      description: sanitizeText(item.description),
      period: sanitizeText(item.period),
      reference: sanitizeText(item.reference),
      service_address: sanitizeText(item.service_address),
    })),
    discounts: data.discounts?.map(d => ({
      ...d,
      label: sanitizeText(d.label),
      applies_to: sanitizeText(d.applies_to),
    })),
    payment_instructions: sanitizeText(data.payment_instructions),
  };
}

// ============================================================================
// FORBIDDEN TERMS CHECK
// ============================================================================

/**
 * Vérifie qu'aucun terme interdit n'est présent dans les données de facture de renouvellement
 */
function checkForbiddenTerms(data: InvoiceDataV2): void {
  const isRenewal = data.invoice_type === "MONTHLY";
  if (!isRenewal) return;
  
  const textToCheck = [
    data.status,
    data.payment_instructions,
    ...data.items.map(i => i.description),
    ...(data.discounts?.map(d => d.label) || []),
  ].join(" ").toLowerCase();
  
  for (const term of FORBIDDEN_TERMS_RENEWAL) {
    if (textToCheck.includes(term.toLowerCase())) {
      console.warn(`[InvoiceEngine] Terme interdit détecté dans facture de renouvellement: "${term}"`);
      // On ne throw pas, mais on log pour audit
    }
  }
}

// ============================================================================
// TEMPLATE CONFIG RUNTIME
// ============================================================================

interface TemplateConfig {
  template_key: string;
  template_type: string;
  template_path: string;
  version: string;
  is_active: boolean;
}

/**
 * Récupère la configuration du template actif depuis la base de données
 */
async function getActiveTemplateConfig(invoiceType: InvoiceType): Promise<TemplateConfig | null> {
  const templateType = invoiceType === "MONTHLY" ? "invoice_renewal" : "invoice_initial";
  
  const { data, error } = await supabase
    .from("pdf_template_config")
    .select("*")
    .eq("template_type", templateType)
    .eq("is_active", true)
    .single();
  
  if (error) {
    console.error("[InvoiceEngine] Erreur récupération config template:", error);
    return null;
  }
  
  return data as TemplateConfig;
}

/**
 * Met à jour le timestamp last_used_at après génération
 */
async function updateTemplateLastUsed(templateKey: string): Promise<void> {
  try {
    await supabase.rpc("update_template_last_used_at", { p_template_key: templateKey });
  } catch (error) {
    console.warn("[InvoiceEngine] Erreur mise à jour last_used_at:", error);
  }
}

// ============================================================================
// MAIN ENTRY POINT: generateInvoicePDF
// ============================================================================

/**
 * POINT D'ENTRÉE UNIQUE pour générer une facture PDF
 * 
 * @param data - Données de la facture au format InvoiceDataV2
 * @param options - Options de génération
 * @returns PDFGenerationResult avec blob, filename, et success
 * 
 * @example
 * ```ts
 * const result = await generateInvoicePDF({
 *   invoice_type: "MONTHLY",
 *   invoice_number: "INV-2026-0001",
 *   // ... autres champs
 * });
 * 
 * if (result.success && result.blob) {
 *   downloadPDF(result.blob, result.filename);
 * }
 * ```
 */
export async function generateInvoicePDF(
  data: InvoiceDataV2,
  options: {
    skipValidation?: boolean;
    updateLastUsed?: boolean;
  } = {}
): Promise<PDFGenerationResult> {
  const { skipValidation = false, updateLastUsed = true } = options;
  
  console.log(`[InvoiceEngine] Génération facture ${data.invoice_type}: ${data.invoice_number}`);
  
  try {
    // 1. Valider les dates (sauf si skip ou template vierge)
    if (!skipValidation) {
      validateDate(data.invoice_date, "invoice_date");
      validateDate(data.due_date, "due_date");
      validateDate(data.billing_period_start, "billing_period_start");
      validateDate(data.billing_period_end, "billing_period_end");
    }
    
    // 2. Sanitize les données (encodage)
    const sanitizedData = sanitizeInvoiceData(data);
    
    // 3. Vérifier les termes interdits (factures de renouvellement)
    checkForbiddenTerms(sanitizedData);
    
    // 4. Récupérer la config du template actif
    const templateConfig = await getActiveTemplateConfig(sanitizedData.invoice_type);
    
    if (!templateConfig) {
      console.warn("[InvoiceEngine] Aucun template actif trouvé, utilisation du template par défaut V2.5");
    }
    
    // 5. Générer le PDF avec le template V2.5 approprié
    let result: PDFGenerationResult;
    
    if (sanitizedData.invoice_type === "MONTHLY") {
      result = generateInvoiceMonthlyV2PDF(sanitizedData);
    } else {
      result = generateInvoiceOneTimeV2PDF(sanitizedData);
    }
    
    // 6. Mettre à jour last_used_at si succès
    if (result.success && updateLastUsed && templateConfig) {
      await updateTemplateLastUsed(templateConfig.template_key);
    }
    
    console.log(`[InvoiceEngine] Génération ${result.success ? "réussie" : "échouée"}: ${data.invoice_number}`);
    
    return result;
  } catch (error) {
    console.error("[InvoiceEngine] Erreur génération:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue lors de la génération",
    };
  }
}

// ============================================================================
// BLANK TEMPLATE GENERATION
// ============================================================================

/**
 * Génère un template vierge (gabarit) pour inspection
 * Utilise des placeholders au lieu de données réelles
 */
export async function generateBlankInvoicePDF(
  invoiceType: InvoiceType
): Promise<PDFGenerationResult> {
  console.log(`[InvoiceEngine] Génération template vierge: ${invoiceType}`);
  
  const blankData = createBlankInvoiceDataV2(invoiceType);
  
  // Générer avec skip validation car les placeholders ne sont pas des dates valides
  return generateInvoicePDF(blankData, { skipValidation: true, updateLastUsed: false });
}

// ============================================================================
// EXPORTS
// ============================================================================

export { NIVRA_COMPANY, PREPAID_LEGAL_FOOTER };
export type { InvoiceDataV2, PDFGenerationResult, InvoiceType };
