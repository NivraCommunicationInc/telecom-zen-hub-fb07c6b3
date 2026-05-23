/**
 * Nivra PDF Templates - V3.0 TELUS-GRADE ENGINE
 *
 * Usage:
 *   import { generateOrderDocuments, downloadPDF } from "@/lib/pdf";
 */

// ============================================================================
// BOOTSTRAP — runs once, hardens every jsPDF.text() call across the app.
// MUST be the first import so the prototype patch is installed before any
// template module instantiates a document.
// ============================================================================
import "./_pdfBootstrap";

// ============================================================================
// PUBLIC SANITIZE HELPERS — explicit safe formatters templates can use
// directly when they want clearer call-sites than the implicit hardener.
// ============================================================================
export {
  safeText, safeName, safeAddress, safeMoney, safeDate, safePhone, safeEmail,
  sanitizeForPdfText, checkRequiredFields,
  PDF_MISSING_VALUE_PLACEHOLDER, PDF_REQUIRED_FIELD_FALLBACK,
} from "./_pdfSanitize";

// Factory + lower-level hardener (for code that doesn't go through `new jsPDF`)
export { createDoc } from "./_createDoc";
export { hardenDoc, isDocHardened } from "./_pdfHarden";
export { installPdfTextHardener } from "./_pdfBootstrap";

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
// LOT 1 — FINANCIAL DOCUMENTS (Approved 2026-04-21)
// ============================================================================
export { generateCreditNotePDF, type CreditNoteData } from "./creditNoteTemplate";
export { generateRefundNoticePDF, type RefundNoticeData } from "./refundNoticeTemplate";
export { generateLateNoticePDF, type LateNoticeData, type LateNoticeStage } from "./lateNoticeTemplate";
export { generateAccountStatementPDF, type AccountStatementData, type StatementTransaction } from "./accountStatementTemplate";
export { generateAnnualTaxSummaryPDF, type AnnualTaxSummaryData, type MonthlyTaxBreakdown } from "./annualTaxSummaryTemplate";

// ============================================================================
// LOTS 2-5 — ADMINISTRATIVE DOCUMENTS (Approved 2026-04-21) — 17 templates
// ============================================================================
// Lot 2 — Account
export { generateWelcomeLetterPDF, type WelcomeLetterData } from "./welcomeLetterTemplate";
export { generateAddressChangePDF, type AddressChangeData } from "./addressChangeTemplate";
export { generatePaymentMethodChangePDF, type PaymentMethodChangeData } from "./paymentMethodChangeTemplate";
export { generateServiceCertificatePDF, type ServiceCertificateData } from "./serviceCertificateTemplate";
// Lot 3 — Suspension / Cancellation
export { generateSuspensionNoticePDF, type SuspensionNoticeData } from "./suspensionNoticeTemplate";
export { generateCancellationConfirmationPDF, type CancellationConfirmationData } from "./cancellationConfirmationTemplate";
export { generateChargebackNoticePDF, type ChargebackNoticeData } from "./chargebackNoticeTemplate";
export { generateFinalRefundReceiptPDF, type FinalRefundReceiptData } from "./finalRefundReceiptTemplate";
// Lot 4 — Logistics
export { generateDeliverySlipPDF, type DeliverySlipData } from "./deliverySlipTemplate";
export { generateReturnInstructionsPDF, type ReturnInstructionsData } from "./returnInstructionsTemplate";
export { generateInstallationReportPDF, type InstallationReportData } from "./installationReportTemplate";
export { generateActivationConfirmationPDF, type ActivationConfirmationData } from "./activationConfirmationTemplate";
// Lot 5 — Legal
export { generateContractAmendmentPDF, type ContractAmendmentData } from "./contractAmendmentTemplate";
export { generateFormalDemandPDF, type FormalDemandData } from "./formalDemandTemplate";
export { generateCollectionsTransferPDF, type CollectionsTransferData } from "./collectionsTransferTemplate";
export { generateComplaintAcknowledgmentPDF, type ComplaintAcknowledgmentData } from "./complaintAcknowledgmentTemplate";
export { generatePreauthorizationConfirmationPDF, type PreauthorizationConfirmationData } from "./preauthorizationConfirmationTemplate";

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
