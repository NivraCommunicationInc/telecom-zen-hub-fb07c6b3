/**
 * @deprecated Types moved to @/lib/pdf/types.ts
 */
export type { InvoiceDataV2, PDFGenerationResult } from "../pdf/types";

// Re-export ContractData from contractTemplate
export type { ContractData, ContractData as TelecomContractData } from "../pdf/contractTemplate";

export interface UnifiedDocumentData {
  docType?: "contract" | "invoice" | "estimate";
  [key: string]: any;
}
