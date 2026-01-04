/**
 * Nivra Document Engine
 * 
 * Single source of truth for all PDF document generation:
 * - Contract (Service Agreement)
 * - Invoice (Facture)
 * - Estimate (Estimation)
 * 
 * All documents are generated dynamically based on selected services only.
 * No service that wasn't selected will appear in any document.
 */

export * from "./types";
export { type PDFState } from "./helpers";
export * from "./generator";

// Re-export main functions for convenience
export { 
  generateUnifiedPDF,
  generateContractPDF,
  generateInvoicePDF,
  generateEstimatePDF,
  getUnifiedPDFBlob,
  downloadUnifiedPDF,
  viewUnifiedPDF,
} from "./generator";

// Re-export adapters for data conversion
export {
  orderToDocumentData,
  billingToInvoiceData,
  getCompanyInfo,
  calculateQuebecTaxes,
  type OrderData,
  type BillingRecord,
  type ClientProfile,
} from "./adapters";

// Re-export terms and conditions
export {
  PDF_TERMS,
  getAllTerms,
  getEssentialTerms,
} from "./termsAndConditions";

// Sample data for testing
export {
  sampleMobileOnly,
  sampleInternetInstall,
  sampleTVBundle,
  sampleFullCombo,
  sampleInvoiceMobile,
  sampleInvoiceTVBundle,
  sampleInvoiceFullCombo,
} from "./sampleData";

// Legacy wrappers for backward compatibility
export {
  generateTelecomContractPDF,
  downloadTelecomContractPDF,
  viewTelecomContractPDF,
  getTelecomContractBlob,
  downloadInvoicePDF,
  viewInvoicePDF,
  getInvoicePDFBlob,
  downloadContractPDF,
  viewContractPDF,
  getContractPDFBlob,
  type TelecomContractData,
  type InvoiceData,
} from "./legacyWrappers";
