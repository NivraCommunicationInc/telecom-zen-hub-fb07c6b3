/**
 * @deprecated This module has been moved to @/lib/pdf
 * Use imports from @/lib/pdf instead of @/lib/pdfEngine
 * 
 * This file exists only for backward compatibility during migration.
 */

// Re-export everything from the unified pdf module
export * from "./pdf";

// Legacy type aliases
export type { ContractData as TelecomContractData } from "./pdf";
export type { InvoiceDataV2 as InvoiceData } from "./pdf";

// Types that were in pdfEngine/types.ts
export interface UnifiedDocumentData {
  docType?: "contract" | "invoice" | "estimate";
  [key: string]: any;
}

// Legacy wrappers that were in pdfEngine/legacyWrappers.ts
import { safePDFDownload, safePDFOpen } from "@/lib/pdfUtils";

/** @deprecated Use useContractPDF hook instead */
export function viewContractPDF(data: any): void {
  console.warn("[DEPRECATED] viewContractPDF - use useContractPDF hook from usePDFTemplates");
}

/** @deprecated Use useInvoicePDF hook instead */
export function viewInvoicePDF(data: any): void {
  console.warn("[DEPRECATED] viewInvoicePDF - use useInvoicePDF hook from usePDFTemplates");
}
