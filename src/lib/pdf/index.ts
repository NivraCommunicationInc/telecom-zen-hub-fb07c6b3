/**
 * Nivra PDF Templates - V2.5 CLEAN ENGINE
 * 
 * ZERO LEGACY EXPORTS - All deprecated functions REMOVED.
 * 
 * Usage:
 *   import { generateInvoicePDF } from "@/lib/pdf";
 *   const result = await generateInvoicePDF(invoiceData);
 * 
 * Templates:
 * - Invoice V2.5 (via invoiceEngine) - Automatic routing to Monthly/OneTime
 * - Order Summary - Order confirmation after payment
 * - Contract V2.5 - Full prepaid service agreement
 */

// ============================================================================
// TYPES - Core exports ONLY
// ============================================================================
export type {
  InvoiceDataV2,
  InvoiceType,
  InvoiceItem,
  ItemCategory,
  PaymentMethod,
  Payment,
  PDFGenerationResult,
  OrderSummaryData,
  Customer,
  Discount,
  Taxes,
  // Legacy types for backward-compatible hooks
  InvoiceMonthlyData,
  InvoiceOneTimeData,
  InvoiceLine,
  OneTimeItem,
} from "./types";
export { NIVRA_COMPANY, PREPAID_LEGAL_FOOTER, NIVRA_HEADER } from "./types";

// ============================================================================
// HELPERS
// ============================================================================
export { formatCurrencyCAD, formatDateFR, formatDateShort, sanitizeLegalText } from "./helpers";
export * from "./pdfHelpers";
export * from "./billingCalculator";
export * from "./annexes";

// ============================================================================
// INVOICE ENGINE V2.5 - SINGLE ENTRY POINT FOR ALL INVOICES
// ============================================================================
export { 
  generateInvoicePDF, 
  generateBlankInvoicePDF,
  safeFormatDate,
  safeFormatDateShort,
  sanitizeText,
  ENGINE_VERSION,
} from "./invoiceEngine";

// ============================================================================
// OTHER DOCUMENT TEMPLATES (Non-invoice)
// ============================================================================
export { generateOrderSummaryPDF, default as OrderSummaryPDF } from "./orderSummaryTemplate";
export { generateContractPDF, default as ContractPDF, type ContractData } from "./contractTemplate";
