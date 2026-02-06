/**
 * Nivra PDF Templates - Main Export
 * 
 * Four professional templates for billing documents:
 * 1. Invoice Monthly - Recurring service invoices (prepaid shown as postpaid)
 * 2. Invoice One-Time - Equipment and one-time fees
 * 3. Order Summary - Order confirmation after payment
 * 4. Contract - Full prepaid service agreement (8+ pages with annexes A-E)
 */

// Types
export * from "./types";

// Helpers
export * from "./pdfHelpers";

// Templates
export { generateInvoiceMonthlyPDF, default as InvoiceMonthlyPDF } from "./invoiceMonthlyTemplate";
export { generateInvoiceOneTimePDF, default as InvoiceOneTimePDF } from "./invoiceOneTimeTemplate";
export { generateOrderSummaryPDF, default as OrderSummaryPDF } from "./orderSummaryTemplate";
export { generateContractPDF, default as ContractPDF, type ContractData } from "./contractTemplate";

// ============================================================================
// DOCUMENT GENERATION ORCHESTRATOR
// ============================================================================

import type { 
  InvoiceMonthlyData, 
  InvoiceOneTimeData, 
  OrderSummaryData,
  PDFGenerationResult 
} from "./types";
import type { ContractData } from "./contractTemplate";
import { generateInvoiceMonthlyPDF } from "./invoiceMonthlyTemplate";
import { generateInvoiceOneTimePDF } from "./invoiceOneTimeTemplate";
import { generateOrderSummaryPDF } from "./orderSummaryTemplate";
import { generateContractPDF } from "./contractTemplate";

export type DocumentType = "invoice_monthly" | "invoice_onetime" | "order_summary" | "contract";

/**
 * Unified document generator
 * Automatically selects the correct template based on document type
 */
export function generateDocument(
  type: DocumentType,
  data: InvoiceMonthlyData | InvoiceOneTimeData | OrderSummaryData | ContractData
): PDFGenerationResult {
  switch (type) {
    case "invoice_monthly":
      return generateInvoiceMonthlyPDF(data as InvoiceMonthlyData);
    case "invoice_onetime":
      return generateInvoiceOneTimePDF(data as InvoiceOneTimeData);
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
}): DocumentType {
  if (data.isContract) {
    return "contract";
  }
  
  if (data.isOrderConfirmation) {
    return "order_summary";
  }
  
  if (data.invoiceType === "one_time" || (!data.hasRecurringServices && data.hasEquipment)) {
    return "invoice_onetime";
  }
  
  return "invoice_monthly";
}
