/**
 * Nivra PDF Templates - Main Export
 * 
 * V2.4 Templates (Standardized Data Contract):
 * - Invoice Monthly V2 - Professional layout with Navy/Teal design
 * - Invoice One-Time V2 - Equipment and one-time fees
 * - Order Summary - Order confirmation after payment
 * - Contract - Full prepaid service agreement (8+ pages with annexes A-E)
 */

// Types
export * from "./types";

// Helpers
export * from "./pdfHelpers";

// Legacy Templates (backward compatibility)
export { generateInvoiceMonthlyPDF, default as InvoiceMonthlyPDF } from "./invoiceMonthlyTemplate";
export { generateInvoiceOneTimePDF, default as InvoiceOneTimePDF } from "./invoiceOneTimeTemplate";
export { generateOrderSummaryPDF, default as OrderSummaryPDF } from "./orderSummaryTemplate";
export { generateContractPDF, default as ContractPDF, type ContractData } from "./contractTemplate";

// V2.4 Templates (New standardized format)
export { generateInvoiceMonthlyV2PDF, generateInvoiceMonthlyPDFFromLegacy } from "./invoiceMonthlyTemplateV2";
export { generateInvoiceOneTimeV2PDF, generateInvoiceOneTimePDFFromLegacy } from "./invoiceOneTimeTemplateV2";

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
import { generateInvoiceMonthlyPDF } from "./invoiceMonthlyTemplate";
import { generateInvoiceOneTimePDF } from "./invoiceOneTimeTemplate";
import { generateOrderSummaryPDF } from "./orderSummaryTemplate";
import { generateContractPDF } from "./contractTemplate";
import { generateInvoiceMonthlyV2PDF } from "./invoiceMonthlyTemplateV2";
import { generateInvoiceOneTimeV2PDF } from "./invoiceOneTimeTemplateV2";

export type DocumentType = "invoice_monthly" | "invoice_onetime" | "order_summary" | "contract" | "invoice_monthly_v2" | "invoice_onetime_v2";

/**
 * Unified document generator
 * Automatically selects the correct template based on document type
 */
export function generateDocument(
  type: DocumentType,
  data: InvoiceMonthlyData | InvoiceOneTimeData | OrderSummaryData | ContractData | InvoiceDataV2
): PDFGenerationResult {
  switch (type) {
    case "invoice_monthly":
      return generateInvoiceMonthlyPDF(data as InvoiceMonthlyData);
    case "invoice_onetime":
      return generateInvoiceOneTimePDF(data as InvoiceOneTimeData);
    case "invoice_monthly_v2":
      return generateInvoiceMonthlyV2PDF(data as InvoiceDataV2);
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
 * - If has recurring services → invoice_monthly
 * - If only equipment/fees → invoice_onetime
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
  
  if (data.useV2) {
    return isOneTime ? "invoice_onetime_v2" : "invoice_monthly_v2";
  }
  
  return isOneTime ? "invoice_onetime" : "invoice_monthly";
}
