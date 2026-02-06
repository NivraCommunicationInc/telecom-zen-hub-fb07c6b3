/**
 * Nivra PDF Templates - Main Export
 * 
 * Three professional templates for billing documents:
 * 1. Invoice Monthly - Recurring service invoices (prepaid shown as postpaid)
 * 2. Invoice One-Time - Equipment and one-time fees
 * 3. Order Summary - Order confirmation after payment
 */

// Types
export * from "./types";

// Helpers
export * from "./pdfHelpers";

// Templates
export { generateInvoiceMonthlyPDF, default as InvoiceMonthlyPDF } from "./invoiceMonthlyTemplate";
export { generateInvoiceOneTimePDF, default as InvoiceOneTimePDF } from "./invoiceOneTimeTemplate";
export { generateOrderSummaryPDF, default as OrderSummaryPDF } from "./orderSummaryTemplate";

// ============================================================================
// DOCUMENT GENERATION ORCHESTRATOR
// ============================================================================

import type { 
  InvoiceMonthlyData, 
  InvoiceOneTimeData, 
  OrderSummaryData,
  PDFGenerationResult 
} from "./types";
import { generateInvoiceMonthlyPDF } from "./invoiceMonthlyTemplate";
import { generateInvoiceOneTimePDF } from "./invoiceOneTimeTemplate";
import { generateOrderSummaryPDF } from "./orderSummaryTemplate";

export type DocumentType = "invoice_monthly" | "invoice_onetime" | "order_summary";

/**
 * Unified document generator
 * Automatically selects the correct template based on document type
 */
export function generateDocument(
  type: DocumentType,
  data: InvoiceMonthlyData | InvoiceOneTimeData | OrderSummaryData
): PDFGenerationResult {
  switch (type) {
    case "invoice_monthly":
      return generateInvoiceMonthlyPDF(data as InvoiceMonthlyData);
    case "invoice_onetime":
      return generateInvoiceOneTimePDF(data as InvoiceOneTimeData);
    case "order_summary":
      return generateOrderSummaryPDF(data as OrderSummaryData);
    default:
      return { success: false, error: `Type de document inconnu: ${type}` };
  }
}

/**
 * Determine document type from order/invoice data
 * - If has recurring services → invoice_monthly
 * - If only equipment/fees → invoice_onetime
 * - If order confirmation → order_summary
 */
export function detectDocumentType(data: {
  hasRecurringServices?: boolean;
  hasEquipment?: boolean;
  isOrderConfirmation?: boolean;
  invoiceType?: string;
}): DocumentType {
  if (data.isOrderConfirmation) {
    return "order_summary";
  }
  
  if (data.invoiceType === "one_time" || (!data.hasRecurringServices && data.hasEquipment)) {
    return "invoice_onetime";
  }
  
  return "invoice_monthly";
}
