/**
 * Nivra Invoice Engine V3.0 — LOCKED PRODUCTION TEMPLATE (2026-03-18)
 * 
 * POINT D'ENTRÉE UNIQUE pour la génération de factures PDF.
 * Utilise EXCLUSIVEMENT le template V3 approuvé (TELUS-grade).
 * Les templates V2.5 et antérieurs sont définitivement retirés.
 * 
 * AUDIT: Chaque génération est loggée dans pdf_generation_logs (append-only).
 * 
 * Usage:
 *   import { generateInvoicePDF } from "@/lib/pdf/invoiceEngine";
 *   const result = await generateInvoicePDF(invoiceData);
 */

import { supabase } from "@/integrations/supabase/client";
import { generateInvoiceV3PDF } from "./invoiceTemplateV3";
import type { InvoiceDataV2, PDFGenerationResult, InvoiceType } from "./types";
import { NIVRA_COMPANY, PREPAID_LEGAL_FOOTER } from "./types";
import { createBlankInvoiceDataV2, TEMPLATE_WATERMARK } from "./blankTemplateData";

// ============================================================================
// ENGINE VERSION — LOCKED V3.0 (approved 2026-03-18)
// ============================================================================

const ENGINE_VERSION = "V3.0";

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
    const error = `[InvoiceEngine] ERREUR CRITIQUE: Date invalide détectée: ${fieldName} = "${dateStr}"`;
    console.error(error);
    // Log l'erreur dans la base
    logPDFGeneration({
      doc_type: "invoice_error",
      template_path: "validation_failed",
      template_version: ENGINE_VERSION,
      success: false,
      error_message: error,
    }).catch(() => {}); // Fire and forget
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
// REQUIRED FIELDS VALIDATION
// ============================================================================

/**
 * Valide que les champs obligatoires sont présents
 * Throw + log si des champs critiques manquent
 */
function validateRequiredFields(data: InvoiceDataV2): void {
  const errors: string[] = [];
  
  // Client obligatoire
  if (!data.customer?.full_name || data.customer.full_name.trim() === "") {
    errors.push("customer.full_name manquant");
  }
  if (!data.customer?.email || data.customer.email.trim() === "") {
    errors.push("customer.email manquant");
  }
  
  // Numéro de facture obligatoire
  if (!data.invoice_number || data.invoice_number.trim() === "") {
    errors.push("invoice_number manquant");
  }
  
  // Au moins un item
  if (!data.items || data.items.length === 0) {
    errors.push("items[] vide - au moins une ligne requise");
  }
  
  if (errors.length > 0) {
    const errorMsg = `[InvoiceEngine] ERREUR: Champs obligatoires manquants: ${errors.join(", ")}`;
    console.error(errorMsg);
    logPDFGeneration({
      doc_type: "invoice_error",
      template_path: "validation_failed",
      template_version: ENGINE_VERSION,
      invoice_number: data.invoice_number,
      customer_email: data.customer?.email,
      success: false,
      error_message: errorMsg,
    }).catch(() => {});
    throw new Error(errorMsg);
  }
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
  
  console.log(`[InvoiceEngine] Recherche template actif pour: ${templateType}`);
  
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
  
  console.log(`[InvoiceEngine] Template trouvé: ${data?.template_key} (v${data?.version})`);
  return data as TemplateConfig;
}

/**
 * Détermine la clé du template à partir du type de facture
 */
function getTemplateKeyFromType(invoiceType: InvoiceType): string {
  return invoiceType === "MONTHLY" ? "invoice_renewal_v2" : "invoice_initial_v2";
}

/**
 * Détermine le chemin du template à partir du type de facture
 */
function getTemplatePathFromType(_invoiceType: InvoiceType): string {
  return "src/lib/pdf/invoiceTemplateV3.ts";
}

// ============================================================================
// AUDIT LOGGING (APPEND-ONLY)
// ============================================================================

interface PDFGenerationLogParams {
  doc_type: string;
  entity_id?: string;
  template_path: string;
  template_version: string;
  invoice_id?: string;
  order_id?: string;
  user_id?: string;
  payment_provider?: string;
  provider_payment_id?: string;
  invoice_number?: string;
  order_number?: string;
  customer_email?: string;
  success: boolean;
  error_message?: string;
}

/**
 * Log une génération PDF dans la table d'audit (append-only)
 */
async function logPDFGeneration(params: PDFGenerationLogParams): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("log_pdf_generation", {
      p_doc_type: params.doc_type,
      p_entity_id: params.entity_id || null,
      p_template_path: params.template_path,
      p_template_version: params.template_version,
      p_engine_version: ENGINE_VERSION,
      p_invoice_id: params.invoice_id || null,
      p_order_id: params.order_id || null,
      p_user_id: params.user_id || null,
      p_payment_provider: params.payment_provider || null,
      p_provider_payment_id: params.provider_payment_id || null,
      p_invoice_number: params.invoice_number || null,
      p_order_number: params.order_number || null,
      p_customer_email: params.customer_email || null,
      p_success: params.success,
      p_error_message: params.error_message || null,
    });
    
    if (error) {
      console.error("[InvoiceEngine] Erreur log PDF generation:", error);
      return null;
    }
    
    console.log(`[InvoiceEngine] ✅ PDF generation loggée: ${data}`);
    return data as string;
  } catch (err) {
    console.error("[InvoiceEngine] Exception log PDF generation:", err);
    return null;
  }
}

// ============================================================================
// MAIN ENTRY POINT: generateInvoicePDF
// ============================================================================

export interface GenerateInvoicePDFOptions {
  skipValidation?: boolean;
  updateLastUsed?: boolean;
  invoice_id?: string;
  order_id?: string;
  user_id?: string;
  payment_provider?: string;
  provider_payment_id?: string;
}

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
  options: GenerateInvoicePDFOptions = {}
): Promise<PDFGenerationResult> {
  const { 
    skipValidation = false, 
    updateLastUsed = true,
    invoice_id,
    order_id,
    user_id,
    payment_provider,
    provider_payment_id,
  } = options;
  
  console.log(`[InvoiceEngine] ========================================`);
  console.log(`[InvoiceEngine] Génération facture ${data.invoice_type}: ${data.invoice_number}`);
  console.log(`[InvoiceEngine] Engine version: ${ENGINE_VERSION}`);
  console.log(`[InvoiceEngine] ========================================`);
  
  // Récupérer la config du template actif AVANT validation pour le logging
  const templateConfig = await getActiveTemplateConfig(data.invoice_type);
  const templatePath = templateConfig?.template_path || getTemplatePathFromType(data.invoice_type);
  const templateVersion = templateConfig?.version || ENGINE_VERSION;
  const templateKey = templateConfig?.template_key || getTemplateKeyFromType(data.invoice_type);
  
  try {
    // 1. Valider les champs obligatoires (sauf template vierge)
    if (!skipValidation) {
      validateRequiredFields(data);
    }
    
    // 2. Valider les dates (sauf si skip ou template vierge)
    if (!skipValidation) {
      validateDate(data.invoice_date, "invoice_date");
      validateDate(data.due_date, "due_date");
      validateDate(data.billing_period_start, "billing_period_start");
      validateDate(data.billing_period_end, "billing_period_end");
    }
    
    // 3. Sanitize les données (encodage)
    const sanitizedData = sanitizeInvoiceData(data);
    
    // 4. Vérifier les termes interdits (factures de renouvellement)
    checkForbiddenTerms(sanitizedData);
    
    if (!templateConfig) {
      console.warn(`[InvoiceEngine] Aucun template actif trouvé, utilisation du template par défaut: ${templateKey}`);
    }
    
    // 5. Générer le PDF avec le template V3 approuvé (LOCKED 2026-03-18)
    let result: PDFGenerationResult;
    
    // V3 unified template — handles both MONTHLY and ONETIME
    result = generateInvoiceV3PDF(sanitizedData);
    
    // 6. Logger la génération dans l'audit trail (APPEND-ONLY)
    await logPDFGeneration({
      doc_type: data.invoice_type === "MONTHLY" ? "invoice_renewal" : "invoice_initial",
      template_path: templatePath,
      template_version: templateVersion,
      invoice_id,
      order_id,
      user_id,
      payment_provider,
      provider_payment_id,
      invoice_number: data.invoice_number,
      customer_email: data.customer?.email,
      success: result.success,
      error_message: result.success ? undefined : result.error,
    });
    
    console.log(`[InvoiceEngine] Génération ${result.success ? "✅ RÉUSSIE" : "❌ ÉCHOUÉE"}: ${data.invoice_number} (template: ${templateKey})`);
    
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erreur inconnue lors de la génération";
    console.error("[InvoiceEngine] ❌ Erreur génération:", errorMsg);
    
    // Logger l'échec
    await logPDFGeneration({
      doc_type: data.invoice_type === "MONTHLY" ? "invoice_renewal" : "invoice_initial",
      template_path: templatePath,
      template_version: templateVersion,
      invoice_id,
      order_id,
      user_id,
      invoice_number: data.invoice_number,
      customer_email: data.customer?.email,
      success: false,
      error_message: errorMsg,
    });
    
    return {
      success: false,
      error: errorMsg,
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

export { NIVRA_COMPANY, PREPAID_LEGAL_FOOTER, ENGINE_VERSION };
export type { InvoiceDataV2, PDFGenerationResult, InvoiceType };
