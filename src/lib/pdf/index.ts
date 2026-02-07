/**
 * Nivra PDF Templates - Main Export
 * 
 * V2.5 Templates (Unified Engine):
 * - Invoice Monthly V2 - Professional layout with Navy/Teal design
 * - Invoice One-Time V2 - Equipment and one-time fees
 * - Order Summary - Order confirmation after payment
 * - Contract - Full prepaid service agreement (8+ pages with annexes A-E)
 * 
 * IMPORTANT: Pour les factures, utiliser generateInvoicePDF() du invoiceEngine.ts
 * C'est le SEUL point d'entrée recommandé.
 */

// Types
export * from "./types";

// Helpers
export * from "./pdfHelpers";

// ============================================================================
// INVOICE ENGINE - POINT D'ENTRÉE UNIQUE POUR LES FACTURES
// ============================================================================
export { 
  generateInvoicePDF, 
  generateBlankInvoicePDF,
  safeFormatDate,
  safeFormatDateShort,
  sanitizeText,
} from "./invoiceEngine";

// ============================================================================
// V2.5 Templates (Active - utilisés par le moteur)
// ============================================================================
export { generateInvoiceMonthlyV2PDF, generateInvoiceMonthlyPDFFromLegacy } from "./invoiceMonthlyTemplateV2";
export { generateInvoiceOneTimeV2PDF, generateInvoiceOneTimePDFFromLegacy } from "./invoiceOneTimeTemplateV2";
export { generateOrderSummaryPDF, default as OrderSummaryPDF } from "./orderSummaryTemplate";
export { generateContractPDF, default as ContractPDF, type ContractData } from "./contractTemplate";

// ============================================================================
// LEGACY Templates - DÉSACTIVÉS (ne plus appeler directement)
// Ces exports sont conservés uniquement pour la rétrocompatibilité.
// Tout nouvel appel doit passer par generateInvoicePDF() du invoiceEngine.
// ============================================================================
/** @deprecated Utiliser generateInvoicePDF() à la place */
export { generateInvoiceMonthlyPDF, default as InvoiceMonthlyPDF } from "./invoiceMonthlyTemplate";
/** @deprecated Utiliser generateInvoicePDF() à la place */
export { generateInvoiceOneTimePDF, default as InvoiceOneTimePDF } from "./invoiceOneTimeTemplate";

// ============================================================================
// DOCUMENT GENERATION ORCHESTRATOR
// ============================================================================

import type { 
  InvoiceMonthlyData, 
  InvoiceOneTimeData, 
  OrderSummaryData,
  PDFGenerationResult,
  InvoiceDataV2,
} from "./types";
import type { ContractData } from "./contractTemplate";
import { generateInvoiceMonthlyV2PDF } from "./invoiceMonthlyTemplateV2";
import { generateInvoiceOneTimeV2PDF } from "./invoiceOneTimeTemplateV2";
import { generateOrderSummaryPDF } from "./orderSummaryTemplate";
import { generateContractPDF } from "./contractTemplate";

export type DocumentType = "invoice_monthly" | "invoice_onetime" | "order_summary" | "contract" | "invoice_monthly_v2" | "invoice_onetime_v2";

/**
 * Unified document generator
 * IMPORTANT: Pour les factures, préférer generateInvoicePDF() du invoiceEngine.ts
 * qui gère la validation des dates, l'encodage et le tracking des templates.
 */
export function generateDocument(
  type: DocumentType,
  data: InvoiceMonthlyData | InvoiceOneTimeData | OrderSummaryData | ContractData | InvoiceDataV2
): PDFGenerationResult {
  switch (type) {
    // Factures V2.5 (templates actifs)
    case "invoice_monthly":
    case "invoice_monthly_v2":
      return generateInvoiceMonthlyV2PDF(data as InvoiceDataV2);
    case "invoice_onetime":
    case "invoice_onetime_v2":
      return generateInvoiceOneTimeV2PDF(data as InvoiceDataV2);
    case "order_summary":
      return generateOrderSummaryPDF(data as OrderSummaryData);
    case "contract":
      return generateContractPDF(data as ContractData);
    default:
      return { success: false, error: `Type de document inconnu: ${type}` };
  }
}

/**
 * Determine document type from order/invoice data
 * - If contract generation → contract
 * - If order confirmation → order_summary
 * - If has recurring services → invoice_monthly_v2
 * - If only equipment/fees → invoice_onetime_v2
 */
export function detectDocumentType(data: {
  hasRecurringServices?: boolean;
  hasEquipment?: boolean;
  isOrderConfirmation?: boolean;
  isContract?: boolean;
  invoiceType?: string;
  useV2?: boolean;
}): DocumentType {
  if (data.isContract) {
    return "contract";
  }
  
  if (data.isOrderConfirmation) {
    return "order_summary";
  }
  
  const isOneTime = data.invoiceType === "one_time" || data.invoiceType === "ONETIME" || 
                    (!data.hasRecurringServices && data.hasEquipment);
  
  // Toujours utiliser V2 maintenant
  return isOneTime ? "invoice_onetime_v2" : "invoice_monthly_v2";
}
