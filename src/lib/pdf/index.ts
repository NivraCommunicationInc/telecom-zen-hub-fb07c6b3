/**
 * Nivra PDF Templates - Main Export V2.5
 * 
 * UNIFIED ENGINE - All documents generated through this module.
 * 
 * Templates:
 * - Invoice Monthly V2.5 - Professional layout with Navy/Teal design
 * - Invoice One-Time V2.5 - Equipment and one-time fees
 * - Order Summary - Order confirmation after payment
 * - Contract V2.5 - Full prepaid service agreement
 * 
 * IMPORTANT: Pour les factures, utiliser generateInvoicePDF() du invoiceEngine.ts
 * C'est le SEUL point d'entrée recommandé.
 */

// Types
export * from "./types";

// Helpers
export * from "./pdfHelpers";
export * from "./helpers";
export * from "./billingCalculator";
export * from "./annexes";

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
// LEGACY COMPATIBILITY LAYER
// These exports are provided for backward compatibility.
// All new code should use generateInvoicePDF() from invoiceEngine.
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
import { safePDFDownload, safePDFOpen } from "@/lib/pdfUtils";

export type DocumentType = "invoice_monthly" | "invoice_onetime" | "order_summary" | "contract" | "invoice_monthly_v2" | "invoice_onetime_v2";

// Legacy aliases for backward compatibility
/** @deprecated Use generateInvoicePDF() from invoiceEngine instead */
export const generateInvoiceMonthlyPDF = generateInvoiceMonthlyV2PDF;
/** @deprecated Use generateInvoicePDF() from invoiceEngine instead */  
export const generateInvoiceOneTimePDF = generateInvoiceOneTimeV2PDF;
/** @deprecated Use generateInvoicePDF() from invoiceEngine instead */
export const InvoiceMonthlyPDF = generateInvoiceMonthlyV2PDF;
/** @deprecated Use generateInvoicePDF() from invoiceEngine instead */
export const InvoiceOneTimePDF = generateInvoiceOneTimeV2PDF;

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
  
  return isOneTime ? "invoice_onetime_v2" : "invoice_monthly_v2";
}

// ============================================================================
// LEGACY WRAPPERS - For backward compatibility with old imports
// ============================================================================

/** @deprecated Use @/lib/pdf directly instead of @/lib/pdfEngine */
export interface TelecomContractData extends ContractData {}

/** @deprecated Use generateContractPDF from @/lib/pdf instead */
export function generateTelecomContractPDF(data: any): any {
  console.warn("[DEPRECATED] generateTelecomContractPDF - use generateContractPDF from @/lib/pdf");
  return { output: () => new Blob() };
}

/** @deprecated Use hooks from usePDFTemplates instead */
export function downloadTelecomContractPDF(data: any): void {
  console.warn("[DEPRECATED] downloadTelecomContractPDF - use useContractPDF hook");
}

/** @deprecated Use hooks from usePDFTemplates instead */
export function viewTelecomContractPDF(data: any): void {
  console.warn("[DEPRECATED] viewTelecomContractPDF - use useContractPDF hook");
}

/** @deprecated Use hooks from usePDFTemplates instead */
export type InvoiceData = InvoiceDataV2;

/**
 * Legacy adapter: converts old invoice format to InvoiceDataV2
 * Used by AdminBilling and other legacy code
 */
export function convertLegacyInvoiceData(legacyData: {
  invoiceNumber?: string;
  orderNumber?: string;
  paymentReference?: string;
  clientNumber?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  subtotal?: number;
  fees?: number;
  credits?: number;
  deliveryFee?: number;
  activationFee?: number;
  installationFee?: number;
  discountAmount?: number;
  preauthDiscount?: number;
  tpsAmount?: number;
  tvqAmount?: number;
  lateFeeAmount?: number;
  dueDate?: string;
  createdAt?: string;
  status?: string;
  paidAt?: string;
  notes?: string;
  servicePlan?: string;
  promoCode?: string;
  promoDescription?: string;
  paymentMethod?: string;
  cardLast4?: string;
  orderLineItems?: any[];
  billingTotalsSnapshot?: any;
}): InvoiceDataV2 {
  const now = new Date().toISOString().split("T")[0];
  const subtotal = Number(legacyData.subtotal) || 0;
  const tps = Number(legacyData.tpsAmount) || subtotal * 0.05;
  const tvq = Number(legacyData.tvqAmount) || subtotal * 0.09975;
  const total = subtotal + tps + tvq;
  
  // Build items from legacy format
  const items: import("./types").InvoiceItem[] = [];
  
  // Add service as item
  if (legacyData.servicePlan) {
    items.push({
      category: "Other" as const,
      description: legacyData.servicePlan,
      qty: 1,
      unit_price: subtotal,
      amount: subtotal,
      is_recurring: true,
    });
  }
  
  // Add equipment from orderLineItems
  if (legacyData.orderLineItems) {
    for (const li of legacyData.orderLineItems) {
      items.push({
        category: (li.category as import("./types").ItemCategory) || "Equipment",
        description: li.name || li.description || "Article",
        qty: li.qty || 1,
        unit_price: Number(li.unit_price) || Number(li.price) || 0,
        amount: Number(li.line_total) || Number(li.amount) || 0,
        is_recurring: li.is_recurring || false,
      });
    }
  }
  
  // If no items, add placeholder
  if (items.length === 0) {
    items.push({
      category: "Other",
      description: "Services télécom",
      qty: 1,
      unit_price: subtotal,
      amount: subtotal,
    });
  }
  
  return {
    invoice_type: "ONETIME",
    invoice_number: legacyData.invoiceNumber || `INV-${Date.now().toString(36).toUpperCase()}`,
    invoice_date: legacyData.createdAt?.split("T")[0] || now,
    due_date: legacyData.dueDate?.split("T")[0] || now,
    account_number: legacyData.clientNumber || "000000",
    currency: "CAD",
    status: legacyData.status === "paid" ? "Paid" : "Pending",
    customer: {
      full_name: legacyData.clientName || "Client",
      email: legacyData.clientEmail || "",
      phone: legacyData.clientPhone,
      address_line1: "",
      city: "",
      province: "QC",
      postal_code: "",
    },
    items,
    discounts: legacyData.discountAmount ? [{
      label: legacyData.promoDescription || `Rabais ${legacyData.promoCode || ""}`,
      amount: Number(legacyData.discountAmount),
    }] : undefined,
    subtotal,
    taxes: {
      gst_rate: 0.05,
      gst_amount: tps,
      qst_rate: 0.09975,
      qst_amount: tvq,
    },
    total,
    balance_due: legacyData.status === "paid" ? 0 : total,
    payments: legacyData.paidAt ? [{
      method: (legacyData.paymentMethod as import("./types").PaymentMethod) || "Manual",
      status: "Captured",
      paid_amount: total,
      paid_at: legacyData.paidAt,
      payment_reference: legacyData.paymentReference || "00000000",
    }] : undefined,
    payments_total: legacyData.paidAt ? total : 0,
  };
}

/**
 * Legacy invoice generator wrapper for AdminBilling
 * @deprecated Use generateInvoicePDF from invoiceEngine with InvoiceDataV2
 */
export async function generateLegacyInvoicePDF(legacyData: any): Promise<{ blob: Blob; filename: string }> {
  const { generateInvoicePDF } = await import("./invoiceEngine");
  const v2Data = convertLegacyInvoiceData(legacyData);
  
  const result = await generateInvoicePDF(v2Data);
  
  if (!result.success || !result.blob) {
    throw new Error(result.error || "Failed to generate PDF");
  }
  
  return {
    blob: result.blob,
    filename: `Facture_${v2Data.invoice_number}.pdf`,
  };
}

/** @deprecated Use generateInvoicePDF from invoiceEngine instead */
export function downloadInvoicePDF(data: any): void {
  console.warn("[DEPRECATED] downloadInvoicePDF - use useInvoicePDF hook");
}

/** @deprecated Use generateInvoicePDF from invoiceEngine instead */
export function viewInvoicePDF(data: any): void {
  console.warn("[DEPRECATED] viewInvoicePDF - use useInvoicePDF hook");
}

/** @deprecated Use generateInvoicePDF from invoiceEngine instead */
export function getInvoicePDFBlob(data: any): Blob {
  console.warn("[DEPRECATED] getInvoicePDFBlob - use generateInvoicePDF from invoiceEngine");
  return new Blob();
}

/** @deprecated Use generateContractPDF instead */
export function downloadContractPDF(data: any): void {
  console.warn("[DEPRECATED] downloadContractPDF - use useContractPDF hook");
}

/** @deprecated Use generateContractPDF instead */
export function viewContractPDF(data: any): void {
  console.warn("[DEPRECATED] viewContractPDF - use useContractPDF hook");
}

// Terms/Modalités compatibility
export interface TermsModalitesData {
  effectiveDate?: string;
  companyName?: string;
  orderId?: string;
  orderNumber?: string;
  accountId?: string;
  [key: string]: any; // Allow any additional properties
}

/** @deprecated Terms are now static files in public/documents */
export function generateTermsModalitesPDF(data: TermsModalitesData): { success: boolean; error?: string; output?: (type: string) => Blob } {
  console.warn("[DEPRECATED] generateTermsModalitesPDF - use static file at public/documents/modalites.pdf");
  return { 
    success: true, 
    output: (type: string) => new Blob(["Terms PDF placeholder"], { type: "application/pdf" })
  };
}

/** @deprecated Terms are now static files */
export function generateTermsModalitesPDFBlob(data: TermsModalitesData): Blob | null {
  console.warn("[DEPRECATED] generateTermsModalitesPDFBlob - use static file");
  return new Blob(["Terms PDF placeholder"], { type: "application/pdf" });
}

/** @deprecated Terms are now static files */
export function getTermsModalitesFilename(data: TermsModalitesData | string): string {
  return "Modalites-Service-Nivra.pdf";
}

export const TERMS_DOCUMENT_INFO = {
  version: "v2026-02-05",
  effectiveDate: "2026-02-05",
  title: "Modalités de service",
  subtitle: "Conditions générales",
  lastUpdated: "2026-02-05",
  id: "terms-modalites-v2026",
};
