/**
 * Nivra PDF Templates - V3.0 TELUS-GRADE ENGINE
 * 
 * Usage:
 *   import { generateOrderDocuments, downloadPDF } from "@/lib/pdf";
 */

// ============================================================================
// COMPANY INFO — Single Source of Truth
// ============================================================================
export { NIVRA, TAX, PDF_THEME } from "./companyInfo";

// ============================================================================
// TYPES
// ============================================================================
export type {
  InvoiceDataV2, InvoiceType, InvoiceItem, ItemCategory,
  PaymentMethod, Payment, PDFGenerationResult, OrderSummaryData,
  Customer, Discount, Taxes,
} from "./types";
export { NIVRA_COMPANY, PREPAID_LEGAL_FOOTER, NIVRA_HEADER } from "./types";

// ============================================================================
// V3 TEMPLATES (TELUS-GRADE)
// ============================================================================
export { generateInvoiceV3PDF, generateInvoiceMonthlyV3PDF, generateInvoiceOneTimeV3PDF } from "./invoiceTemplateV3";
export { generateContractV3PDF, type ContractDataV3 } from "./contractTemplateV3";
export { generateContractSummaryPDF, type ContractSummaryData } from "./contractSummaryTemplate";
export { generateServiceTermsPDF, CURRENT_TERMS_VERSION } from "./serviceTermsTemplate";
export { generateReceiptPDF, type ReceiptData } from "./receiptTemplate";
export { generateCanonicalInvoicePDF, generateCanonicalContractPDF, fetchCanonicalDocumentData, buildCanonicalInvoiceData, buildCanonicalContractData } from "./canonicalDocumentService";
export { generateCanonicalReceiptPDF, generateCanonicalOrderSummaryPDF } from "./canonicalDocumentExtensions";
export { type OrderSummaryV3Data } from "./orderSummaryTemplate";

// ============================================================================
// DOCUMENT BUILDER — Order→PDF Pipeline (generates all 4+1 documents)
// ============================================================================
export { generateOrderDocuments, downloadPDF, buildInvoiceData, buildContractData, buildOrderSummaryData, buildContractSummaryData, buildReceiptData, fetchOrderDocumentData } from "./documentBuilder";
export type { OrderDocuments } from "./documentBuilder";

// ============================================================================
// BACKWARD COMPAT EXPORTS — all delegate to V3 approved templates
// ============================================================================
export { formatCurrencyCAD, formatDateFR, formatDateShort, sanitizeLegalText } from "./helpers";
export * from "./pdfHelpers";
export * from "./annexes";
export {
  isPrintableText, sanitizeForPDF, assertPrintableText,
  sanitizeClientName, sanitizeAddress, sanitizeEmail,
  sanitizePaymentReference, sanitizeDescription,
  sanitizeCustomerData, sanitizePaymentData,
} from "./pdfTextSanitizer";
export { generateInvoicePDF, generateBlankInvoicePDF, safeFormatDate, safeFormatDateShort, sanitizeText, ENGINE_VERSION } from "./invoiceEngine";
export { generateOrderSummaryPDF, default as OrderSummaryPDF } from "./orderSummaryTemplate";
export { generateContractPDF, default as ContractPDF, type ContractData } from "./contractTemplate";
